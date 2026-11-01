'use strict';

var sha256 = require('@noble/hashes/sha2.js').sha256;
var util = require('./util');
var PluginError = util.PluginError;

var SESSION_URL = 'https://chatgpt.com/api/auth/session';
var SESSION_COOKIE = '__Secure-next-auth.session-token';
var ISSUER = 'https://auth.openai.com';
// The Codex CLI's public OAuth client, which only redirects to the CLI's loopback callback.
var CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
var REDIRECT = 'http://localhost:1455/auth/callback';
var ORIGINATOR = 'Codex Desktop';
var AUTH_KEY = 'chatgpt.codex.session.v1';
// Up to v0.3 the Dot kept its own copy of the session here; the Dot's room stays under this key.
var DOT_KEY = 'chatgpt-dots.connection.v1';
var PENDING_KEY = 'chatgpt.codex.pending.v1';
var PENDING_TTL_MS = 30 * 60 * 1000;
var DEVICE_KEY = 'chatgpt.codex.device.v1';
var DEVICE_TTL_MS = 15 * 60 * 1000;
// auth.openai.com's Cloudflare front refuses requests without a browser-like agent.
var USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
var RENEW_BEFORE_MS = 5 * 60 * 1000;
// Settings-page entropy, split into a PKCE verifier, an OAuth state and the device-key seed.
var VERIFIER_BYTES = 32;
var STATE_BYTES = 16;
var SEED_BYTES = 48;
var ENTROPY_BYTES = VERIFIER_BYTES + STATE_BYTES + SEED_BYTES;

function authRequired() {
  return PluginError('AUTH_REQUIRED', 'ChatGPT sign-in expired. Sign in again in plugin settings.');
}

function signInFirst() {
  return PluginError('AUTH_REQUIRED', 'Sign in with ChatGPT in plugin settings.');
}

function validToken(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 16384 && !/[\r\n;]/.test(value);
}

/** The account in a ChatGPT web access token, or null if it isn't one. */
function accountOf(accessToken) {
  var claims = validToken(accessToken) ? util.jwtClaims(accessToken) : null;
  var auth = claims && claims['https://api.openai.com/auth'];
  if (!auth || !auth.chatgpt_account_id || typeof claims.exp !== 'number') return null;
  var profile = claims['https://api.openai.com/profile'] || {};
  return {
    account: auth.chatgpt_account_id,
    user: auth.chatgpt_user_id || '',
    email: typeof profile.email === 'string' ? profile.email : '',
    expiresAt: claims.exp * 1000,
  };
}

/**
 * The one ChatGPT sign-in the Dot, ChatGPT chats and Codex run as: either the web session cookie
 * `Pebble.webSignIn` captures, traded at chatgpt.com for an access token, or the Codex CLI's device
 * sign-in, approved in the browser (where passkeys work) and renewed with its refresh token. Only one copy is stored, so
 * a renewal (which rotates the session token) can't leave another feature with a stale one.
 */
function createCodexAuth(storage, fetch, now) {
  // Concurrent calls in one session share one renewal instead of each rotating the session token.
  var renewing = null;

  /** The saved session; a v0.3 Dot's own copy is adopted when it is the more recently renewed, then dropped. */
  async function load() {
    var raw = await storage.getItem(AUTH_KEY);
    var state = raw ? JSON.parse(raw) : null;
    var dotRaw = await storage.getItem(DOT_KEY);
    var dot = dotRaw ? JSON.parse(dotRaw) : null;
    if (!dot || !dot.sessionToken) return state;
    if (!state || dot.expiresAt > state.expiresAt) {
      state = {
        account: dot.account, user: dot.user, email: dot.email || '', expiresAt: dot.expiresAt,
        accessToken: dot.accessToken, sessionToken: dot.sessionToken,
      };
      await storage.setItem(AUTH_KEY, JSON.stringify(state));
    }
    await storage.setItem(DOT_KEY, JSON.stringify({ account: dot.account, user: dot.user, room: dot.room, dotName: dot.dotName }));
    return state;
  }

  async function exchange(sessionToken) {
    var response = await fetch(SESSION_URL, { headers: { 'Cookie': SESSION_COOKIE + '=' + sessionToken } });
    if (response.status !== 200) throw authRequired();
    var session = await response.json();
    var signedIn = session && validToken(session.sessionToken) ? accountOf(session.accessToken) : null;
    if (!signedIn || signedIn.expiresAt - now() < 60 * 1000) throw authRequired();
    signedIn.accessToken = session.accessToken;
    signedIn.sessionToken = session.sessionToken;
    return signedIn;
  }

  async function tokenRequest(fields) {
    var response = await fetch(ISSUER + '/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
      body: util.form(fields),
    });
    if (response.status < 200 || response.status >= 300) throw authRequired();
    var tokens = await response.json();
    if (!tokens || !validToken(tokens.access_token)) throw authRequired();
    return tokens;
  }

  function fromTokens(tokens, previousRefresh) {
    var signedIn = accountOf(tokens.access_token);
    var refreshToken = validToken(tokens.refresh_token) ? tokens.refresh_token : previousRefresh;
    if (!signedIn || !validToken(refreshToken) || signedIn.expiresAt - now() < 60 * 1000) throw authRequired();
    signedIn.accessToken = tokens.access_token;
    signedIn.refreshToken = refreshToken;
    return signedIn;
  }

  async function refresh(refreshToken) {
    return fromTokens(await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: CLIENT_ID }), refreshToken);
  }

  /** Starts a device sign-in: the user enters [code] at [url] in their browser. */
  async function beginDevice() {
    var response = await fetch(ISSUER + '/api/accounts/deviceauth/usercode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify({ client_id: CLIENT_ID }),
    });
    if (response.status !== 200) {
      throw PluginError('PLUGIN_UNAVAILABLE', 'OpenAI did not start a sign-in (HTTP ' + response.status + '). Try again shortly.');
    }
    var body = await response.json();
    if (!body || !validToken(body.device_auth_id) || !validToken(body.user_code)) {
      throw PluginError('PLUGIN_UNAVAILABLE', 'OpenAI sent an unreadable sign-in. Try again shortly.');
    }
    await storage.setItem(DEVICE_KEY, JSON.stringify({ id: body.device_auth_id, code: body.user_code, at: now() }));
    return { code: body.user_code, url: ISSUER + '/codex/device' };
  }

  /** One check on the device sign-in: null while the user hasn't approved it, else the signed-in state (not saved). */
  async function pollDevice() {
    var raw = await storage.getItem(DEVICE_KEY);
    var pending = raw ? JSON.parse(raw) : null;
    if (!pending || now() - pending.at > DEVICE_TTL_MS) {
      throw PluginError('AUTH_REQUIRED', 'That sign-in took too long. Start signing in again.');
    }
    var response = await fetch(ISSUER + '/api/accounts/deviceauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify({ device_auth_id: pending.id, user_code: pending.code }),
    });
    if (response.status === 403 || response.status === 404) return null;
    if (response.status !== 200) throw authRequired();
    var grant = await response.json();
    if (!grant || !validToken(grant.authorization_code) || !validToken(grant.code_verifier)) throw authRequired();
    var tokens = await tokenRequest({
      grant_type: 'authorization_code',
      code: grant.authorization_code,
      redirect_uri: ISSUER + '/deviceauth/callback',
      client_id: CLIENT_ID,
      code_verifier: grant.code_verifier,
    });
    await storage.removeItem(DEVICE_KEY);
    return fromTokens(tokens);
  }

  async function adopt(state) {
    await storage.setItem(AUTH_KEY, JSON.stringify(state));
    return state;
  }

  async function connect(sessionToken) {
    if (!validToken(sessionToken)) {
      throw PluginError('AUTH_REQUIRED', 'ChatGPT sign-in returned an invalid session. Please try again.');
    }
    var state = await exchange(sessionToken);
    await storage.setItem(AUTH_KEY, JSON.stringify(state));
    return state;
  }

  /** A signed-in state with an access token good for at least a few minutes. */
  async function current() {
    var state = await load();
    if (!state) throw signInFirst();
    if (state.expiresAt - now() > RENEW_BEFORE_MS) return state;
    return renew();
  }

  /** A fresh access token now, for a call ChatGPT rejected anyway. */
  function renew() {
    if (!renewing) {
      renewing = (async function () {
        var state = await load();
        if (!state) throw signInFirst();
        var renewed = state.refreshToken ? await refresh(state.refreshToken) : await exchange(state.sessionToken);
        if (renewed.account !== state.account || renewed.user !== state.user) throw authRequired();
        await storage.setItem(AUTH_KEY, JSON.stringify(renewed));
        return renewed;
      })().finally(function () { renewing = null; });
    }
    return renewing;
  }

  /**
   * The browser sign-in that authorizes enrolling this phone for remote control. [entropy] is random
   * bytes from the settings page (base64): plugins have no secure randomness of their own on iOS.
   */
  async function beginEnroll(entropy) {
    var bytes = typeof entropy === 'string' ? util.fromBase64(entropy) : [];
    if (bytes.length < ENTROPY_BYTES) throw PluginError('INVALID_ARGS', 'Settings page sent too little randomness.');
    var verifier = util.base64url(bytes.slice(0, VERIFIER_BYTES));
    var state = util.base64url(bytes.slice(VERIFIER_BYTES, VERIFIER_BYTES + STATE_BYTES));
    var seed = util.base64(bytes.slice(VERIFIER_BYTES + STATE_BYTES, ENTROPY_BYTES));
    await storage.setItem(PENDING_KEY, JSON.stringify({ verifier: verifier, state: state, seed: seed, at: now() }));
    return {
      url: ISSUER + '/oauth/authorize?' + util.form({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT,
        scope: 'codex.remote_control.enroll',
        code_challenge: util.base64url(sha256(util.utf8(verifier))),
        code_challenge_method: 'S256',
        state: state,
        originator: ORIGINATOR,
        reauth: 'remote_control',
        max_age: '0',
        codex_cli_simplified_flow: 'true',
      }),
    };
  }

  /** Trades the callback address the browser ended on for the step-up token, and the device-key seed. */
  async function finishEnroll(callbackUrl) {
    var raw = await storage.getItem(PENDING_KEY);
    var pending = raw ? JSON.parse(raw) : null;
    if (!pending || now() - pending.at > PENDING_TTL_MS) {
      throw PluginError('AUTH_REQUIRED', 'That sign-in took too long. Start connecting again.');
    }
    var text = typeof callbackUrl === 'string' ? callbackUrl.trim() : '';
    var query = text.indexOf('?') >= 0 ? text.slice(text.indexOf('?') + 1).split('#')[0] : '';
    var params = {};
    query.split('&').forEach(function (pair) {
      var eq = pair.indexOf('=');
      if (eq > 0) params[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '));
    });
    if (params.error) throw PluginError('AUTH_REQUIRED', params.error_description || 'Sign-in was refused.');
    if (!params.code || params.state !== pending.state) {
      throw PluginError('INVALID_ARGS', 'Paste the whole address the browser ended on, starting with http://localhost:1455.');
    }
    var response = await fetch(ISSUER + '/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: util.form({
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: REDIRECT,
        client_id: CLIENT_ID,
        code_verifier: pending.verifier,
      }),
    });
    if (response.status < 200 || response.status >= 300) {
      throw PluginError('AUTH_REQUIRED', 'OpenAI did not accept that sign-in (HTTP ' + response.status + '). Start connecting again.');
    }
    var tokens = await response.json();
    if (!tokens || !tokens.access_token) throw PluginError('AUTH_REQUIRED', 'OpenAI did not return a sign-in. Start connecting again.');
    await storage.removeItem(PENDING_KEY);
    return { stepUpToken: tokens.access_token, seed: util.fromBase64(pending.seed) };
  }

  async function signOut() {
    await storage.removeItem(AUTH_KEY);
    await storage.removeItem(PENDING_KEY);
    await storage.removeItem(DEVICE_KEY);
  }

  return {
    beginDevice: beginDevice, pollDevice: pollDevice, adopt: adopt,
    load: load, connect: connect, current: current, renew: renew, beginEnroll: beginEnroll, finishEnroll: finishEnroll, signOut: signOut,
  };
}

/** Headers every Codex backend call carries. */
function codexHeaders(state) {
  return {
    'Authorization': 'Bearer ' + state.accessToken,
    'ChatGPT-Account-Id': state.account,
    'originator': ORIGINATOR,
    'Content-Type': 'application/json',
  };
}

module.exports = { createCodexAuth: createCodexAuth, codexHeaders: codexHeaders, ENTROPY_BYTES: ENTROPY_BYTES };
