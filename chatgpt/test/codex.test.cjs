const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const nodeCrypto = require('node:crypto');
const vm = require('node:vm');
const path = require('node:path');

const SOURCE = readFileSync(path.join(__dirname, '..', 'pbw', 'plugin.js'), 'utf8');
const NOW = 1_800_000_000_000;
const ACCOUNT = 'acct-1';
const REDIRECT = 'http://localhost:1455/auth/callback';
const RC = 'https://chatgpt.com/backend-api/codex/remote/control';
const ENTROPY = nodeCrypto.randomBytes(96);
const WHAM = 'https://chatgpt.com/backend-api/wham';

function jwt(claims) {
  return 'h.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.s';
}

function accessToken(exp = NOW / 1000 + 3600) {
  return jwt({ exp, 'https://api.openai.com/auth': { chatgpt_account_id: ACCOUNT, chatgpt_user_id: 'user-1' }, 'https://api.openai.com/profile': { email: 'eric@example.com' } });
}

function json(status, body) {
  return { status, json: async () => body };
}

function verify(spkiBase64, payloadBase64, signatureBase64) {
  const key = nodeCrypto.createPublicKey({ key: Buffer.from(spkiBase64, 'base64'), format: 'der', type: 'spki' });
  return nodeCrypto.verify('sha256', Buffer.from(payloadBase64, 'base64'), key, Buffer.from(signatureBase64, 'base64'));
}

function challenge(path, extra = {}) {
  return {
    type: 'remoteControlClientEnrollment', nonce: 'n-1', purpose: 'p', audience: 'aud', challenge_id: 'ch-1',
    target_origin: 'https://chatgpt.com', target_path: '/backend-api/codex/remote/control' + path,
    account_user_id: 'au-1', client_id: 'client-1', challenge_token: 'ct-1', challenge_expires_at: 99, ...extra,
  };
}

/** A relay that answers the app-server JSON-RPC requests the plugin sends. */
function relay(threads, onQueue) {
  return class FakeSocket {
    constructor(url, protocols, options) {
      FakeSocket.last = this;
      this.url = url;
      this.headers = options.headers;
      this.sent = [];
      queueMicrotask(() => this.onmessage({ data: JSON.stringify({
        type: 'device_key_challenge', nonce: 'cn', audience: 'aud', sessionId: 'sess', targetOrigin: 'https://chatgpt.com',
        targetPath: '/backend-api/codex/remote/control/client', accountUserId: 'au-1', clientId: 'client-1',
        tokenSha256Base64url: 'th', tokenExpiresAt: 5, scopes: ['rc'],
      }) }));
    }
    send(text) {
      const frame = JSON.parse(text);
      this.sent.push(frame);
      const message = frame.message;
      if (!message || message.id === undefined) return;
      const reply = (result) => queueMicrotask(() => this.onmessage({ data: JSON.stringify({
        type: 'server_message', client_id: 'client-1', env_id: frame.env_id, stream_id: frame.stream_id, seq_id: 7, cursor: 'c-1',
        message: { id: message.id, result },
      }) }));
      if (message.method === 'initialize' && FakeSocket.unpaired) {
        queueMicrotask(() => this.onmessage({ data: JSON.stringify({ type: 'server_message', client_id: 'client-1', seq_id: 2, message: {
          method: 'error', params: { error: { message: 'Remote environment is not paired for this client' }, threadId: '__remote_control_transport__', willRetry: false } } }) }));
        return;
      }
      if (message.method === 'initialize') reply({ userAgent: 'codex' });
      if (message.method === 'thread/list') reply({ data: threads, nextCursor: null });
      if (message.method === 'thread/queue/add') {
        if (onQueue) onQueue(message.params);
        reply({ queuedSubmission: { id: 'q-1', input: message.params.input, clientUserMessageId: message.params.clientUserMessageId } });
      }
    }
    close() { this.closed = true; }
  };
}

function fixture({ routes = {}, storage = new Map(), WebSocket = class {}, clock = { now: NOW } } = {}) {
  const calls = [];
  const backend = {
    'GET https://chatgpt.com/api/auth/session': () => json(200, { accessToken: accessToken(), sessionToken: 'session-2' }),
    'POST https://auth.openai.com/oauth/token': () => json(200, { access_token: 'step-up-token', refresh_token: 'r', id_token: 'i' }),
    [`POST ${RC}/client/enroll/start`]: () => json(200, { client_id: 'client-1', account_user_id: 'au-1', device_key_challenge: challenge('/client/enroll/finish') }),
    [`POST ${RC}/client/enroll/finish`]: () => json(200, { client_id: 'client-1', account_user_id: 'au-1', remote_control_token: 'rc-token', expires_at: new Date(NOW + 3600_000).toISOString(), scopes: ['rc'] }),
    [`GET ${RC}/environments`]: () => json(200, [{ id: 'env-1', name: 'taz-runner', online: true, busy: false, os: 'linux', kind: 'single' }]),
    'GET https://chatgpt.com/backend-api/wham/tasks/list': () => json(200, { items: [] }),
    'GET https://chatgpt.com/backend-api/conversations': () => json(200, { items: [] }),
    ...routes,
  };
  const fetch = async (url, init = {}) => {
    const key = `${init.method || 'GET'} ${url.split('?')[0]}`;
    calls.push({ key, url, init });
    const handler = backend[key];
    assert.ok(handler, 'unexpected request ' + key);
    return handler(init);
  };
  let action, config, source;
  vm.runInNewContext(SOURCE, {
    fetch, WebSocket, btoa, atob, queueMicrotask,
    Date: Object.assign(function () {}, { now: () => clock.now, parse: Date.parse }),
    Pebble: {
      secureStorage: {
        getItem: async (k) => (storage.has(k) ? storage.get(k) : null),
        setItem: async (k, v) => { storage.set(k, v); },
        removeItem: async (k) => { storage.delete(k); },
      },
      registerActionHandler: (fn) => (action = fn),
      registerConfigHandler: (fn) => (config = fn),
      registerSourceHandler: (fn) => (source = fn),
    },
  });
  const configure = (message) => new Promise((resolve, reject) =>
    config(message, (r) => (r && r.error ? reject(new Error(r.error)) : resolve(r))));
  const run = (name, args) => new Promise((resolve) => action(
    { action: name, args },
    { ok: (value) => resolve({ ok: true, ...value }), error: (code, message) => resolve({ code, message }) },
  ));
  async function signIn() {
    return configure({ type: 'codex_connect', session_token: 'session-1' });
  }
  async function enroll(entropy = ENTROPY) {
    const begun = new URL((await configure({ type: 'codex_enroll_begin', entropy: entropy.toString('base64') })).url);
    return configure({ type: 'codex_enroll_finish', url: `  ${REDIRECT}?code=enroll-code&scope=x&state=${begun.searchParams.get('state')}\n` });
  }
  const agentChats = () => new Promise((resolve) => source({ category: 'agent', item: 'chats' }, {
    data: resolve, error: (code, message) => resolve({ code, message }),
  }));
  const agentConfigured = () => new Promise((resolve) => source({ category: 'agent', item: 'configured' }, {
    data: (r) => resolve(r.instances[0].properties), error: (code, message) => resolve({ code, message }),
  }));
  return { calls, storage, backend, clock, configure, run, signIn, enroll, agentChats, agentConfigured };
}

test('Codex signs in with the ChatGPT web session, like the Dot', async () => {
  const f = fixture();
  const status = await f.signIn();
  assert.deepEqual(JSON.parse(JSON.stringify(status.codex)), { signedIn: true, email: 'eric@example.com', remoteControl: false, paired: false, defaultChat: null });
  assert.equal(f.calls[0].init.headers.Cookie, '__Secure-next-auth.session-token=session-1');
  assert.equal(JSON.parse(f.storage.get('chatgpt.codex.session.v1')).sessionToken, 'session-2');
  await assert.rejects(() => f.configure({ type: 'codex_connect', session_token: 'bad;cookie' }), /invalid session/);
});

test('device sign-in: pending until approved in the browser, then signs in and renews with its refresh token', async () => {
  let approved = false;
  let refreshed = 0;
  const f = fixture({ routes: {
    'POST https://auth.openai.com/api/accounts/deviceauth/usercode': () => json(200, { device_auth_id: 'dev-1', user_code: 'ABCD-1234', interval: '5' }),
    'POST https://auth.openai.com/api/accounts/deviceauth/token': () =>
      approved ? json(200, { authorization_code: 'auth-code', code_verifier: 'verifier-1', code_challenge: 'c' }) : json(403, { error: { code: 'deviceauth_authorization_pending' } }),
    'POST https://auth.openai.com/oauth/token': (init) => {
      const body = new URLSearchParams(init.body);
      if (body.get('grant_type') === 'refresh_token') {
        refreshed++;
        assert.equal(body.get('refresh_token'), 'refresh-1');
        return json(200, { access_token: accessToken(f.clock.now / 1000 + 3600), refresh_token: 'refresh-2' });
      }
      assert.equal(body.get('code'), 'auth-code');
      assert.equal(body.get('code_verifier'), 'verifier-1');
      assert.equal(body.get('redirect_uri'), 'https://auth.openai.com/deviceauth/callback');
      return json(200, { access_token: accessToken(NOW / 1000 + 600), refresh_token: 'refresh-1' });
    },
  } });
  const begun = await f.configure({ type: 'device_begin' });
  assert.deepEqual({ ...begun }, { code: 'ABCD-1234', url: 'https://auth.openai.com/codex/device' });
  assert.deepEqual({ ...(await f.configure({ type: 'device_poll' })) }, { pending: true });
  approved = true;
  const status = await f.configure({ type: 'device_poll' });
  assert.equal(status.codex.signedIn, true);
  assert.equal(JSON.parse(f.storage.get('chatgpt.codex.session.v1')).refreshToken, 'refresh-1');
  f.clock.now = NOW + 10 * 60 * 1000;
  await f.agentChats();
  assert.equal(refreshed, 1);
  assert.equal(JSON.parse(f.storage.get('chatgpt.codex.session.v1')).refreshToken, 'refresh-2');
});

test('connecting computers takes its PKCE and device key from the settings page entropy', async () => {
  const f = fixture();
  await f.signIn();
  const begun = new URL((await f.configure({ type: 'codex_enroll_begin', entropy: ENTROPY.toString('base64') })).url);
  assert.equal(begun.origin + begun.pathname, 'https://auth.openai.com/oauth/authorize');
  assert.equal(begun.searchParams.get('client_id'), 'app_EMoamEEZ73f0CkXaXp7hrann');
  assert.equal(begun.searchParams.get('scope'), 'codex.remote_control.enroll');
  assert.equal(begun.searchParams.get('max_age'), '0');
  assert.equal(begun.searchParams.get('state'), ENTROPY.subarray(32, 48).toString('base64url'));
  await f.configure({ type: 'codex_enroll_finish', url: `${REDIRECT}?code=enroll-code&state=${begun.searchParams.get('state')}` });

  const exchange = new URLSearchParams(f.calls.find((c) => c.key === 'POST https://auth.openai.com/oauth/token').init.body);
  assert.equal(exchange.get('code_verifier'), ENTROPY.subarray(0, 32).toString('base64url'));
  assert.equal(nodeCrypto.createHash('sha256').update(exchange.get('code_verifier')).digest('base64url'), begun.searchParams.get('code_challenge'));
  const finish = f.calls.find((c) => c.key === `POST ${RC}/client/enroll/finish`);
  const body = JSON.parse(finish.init.body);
  assert.equal(body.step_up_token, 'step-up-token');
  assert.equal(finish.init.headers['x-codex-client-id'], 'client-1');
  assert.equal(finish.init.headers['ChatGPT-Account-Id'], ACCOUNT);
  const signed = JSON.parse(Buffer.from(body.device_key_proof.signed_payload_base64, 'base64'));
  assert.equal(signed.domain, 'codex-device-key-sign-payload/v1');
  assert.equal(signed.payload.type, 'remoteControlClientEnrollment');
  assert.ok(verify(body.device_identity.public_key_spki_der_base64, body.device_key_proof.signed_payload_base64, body.device_key_proof.signature_der_base64));
  assert.equal((await f.configure({ type: 'status' })).codex.remoteControl, true);
});

test('the device key follows the page entropy, not anything the plugin makes up', async () => {
  const keyFor = async (entropy) => {
    const f = fixture();
    await f.signIn();
    await f.enroll(entropy);
    return JSON.parse(f.calls.find((c) => c.key.endsWith('/enroll/finish')).init.body).device_identity.public_key_spki_der_base64;
  };
  assert.equal(await keyFor(ENTROPY), await keyFor(ENTROPY));
  assert.notEqual(await keyFor(ENTROPY), await keyFor(nodeCrypto.randomBytes(96)));
});

test('a pasted address for another sign-in, or too little entropy, is refused', async () => {
  const f = fixture();
  await f.signIn();
  await assert.rejects(() => f.configure({ type: 'codex_enroll_begin', entropy: 'AAAA' }), /too little randomness/);
  await f.configure({ type: 'codex_enroll_begin', entropy: ENTROPY.toString('base64') });
  await assert.rejects(() => f.configure({ type: 'codex_enroll_finish', url: `${REDIRECT}?code=x&state=forged` }), /Paste the whole address/);
  await assert.rejects(() => f.configure({ type: 'codex_enroll_finish', url: 'localhost' }), /Paste the whole address/);
  assert.ok(!f.calls.some((c) => c.key.includes('oauth/token')));
});

test('an enrollment challenge for another path is refused', async () => {
  const f = fixture({ routes: { [`POST ${RC}/client/enroll/start`]: () => json(200, { client_id: 'client-1', account_user_id: 'au-1', device_key_challenge: challenge('/elsewhere') }) } });
  await f.signIn();
  await assert.rejects(() => f.enroll(), /unexpected challenge/);
  assert.ok(!f.calls.some((c) => c.key.endsWith('/client/enroll/finish')));
});

const threads = [
  { id: 'th-old', name: null, preview: 'fix the BLE reconnect bug', status: { type: 'notLoaded' }, ephemeral: false, updatedAt: NOW / 1000 - 7200 },
  { id: 'th-live', name: 'Index feed polish', preview: 'x', status: { type: 'idle' }, ephemeral: false, updatedAt: NOW / 1000 - 60 },
];
const cloudTasks = { [`GET ${WHAM}/tasks/list`]: () => json(200, { items: [
  { id: 'task_e_1', title: 'Fix login', updated_at: NOW / 1000 - 600, task_status_display: { latest_turn_status_display: { turn_id: 'turn-9' } } },
  { id: 'task_e_2', title: 'Old', archived: true },
] }), [`POST ${WHAM}/tasks`]: () => json(200, { task: { id: 'task_e_1' } }) };

async function chatsOf(f) {
  return (await f.configure({ type: 'codex_chats' })).chats;
}

test('the chat list merges computer sessions and Cloud tasks, most recent first', async () => {
  const f = fixture({ WebSocket: relay(threads), routes: cloudTasks });
  await f.signIn();
  await f.enroll();
  const chats = await chatsOf(f);
  assert.deepEqual(JSON.parse(JSON.stringify(chats.map((c) => [c.kind, c.id, c.state]))), [
    ['session', 'th-live', 'open'], ['task', 'task_e_1', 'cloud'], ['session', 'th-old', 'not open'],
  ]);
  assert.equal(chats[0].computer, 'taz-runner');
  assert.equal(chats[0].updatedAt, NOW - 60_000);
});

test('a Codex chat picked from agent/chats is reached through the relay', async () => {
  let queued;
  const Socket = relay(threads, (params) => { queued = params; });
  const f = fixture({ WebSocket: Socket });
  await f.signIn();
  await f.enroll();
  assert.equal((await f.run('send_to_agent', { message: 'go' })).code, 'INVALID_ARGS');
  assert.equal(queued, undefined);
  await chatsOf(f);
  const live = (await f.agentChats()).instances.find((i) => i.properties.title.shortText.text === 'Index feed polish');

  const result = await f.run('send_to_agent', { message: 'run the tests', chat_id: live.instanceId });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.text, 'Sent to Codex session "Index feed polish" on taz-runner.');
  assert.equal(queued.threadId, 'th-live');
  assert.deepEqual(JSON.parse(JSON.stringify(queued.input)), [{ type: 'text', text: 'run the tests ⌚', textElements: [] }]);

  const socket = Socket.last;
  assert.equal(socket.url, 'wss://chatgpt.com/backend-api/codex/remote/control/client');
  assert.equal(socket.headers['x-codex-client-session-token'], 'Bearer rc-token');
  assert.equal(socket.headers['chatgpt-account-id'], ACCOUNT);
  assert.equal(socket.headers['x-codex-name'], 'Pebble Plugin');
  const [proof, init, initialized, list, add, closed] = socket.sent;
  const enrolled = JSON.parse(f.calls.find((c) => c.key.endsWith('/enroll/finish')).init.body);
  assert.equal(proof.type, 'device_key_proof');
  assert.ok(verify(enrolled.device_identity.public_key_spki_der_base64, proof.signedPayloadBase64, proof.signatureDerBase64));
  assert.equal(JSON.parse(Buffer.from(proof.signedPayloadBase64, 'base64')).payload.sessionId, 'sess');
  assert.equal(init.message.method, 'initialize');
  assert.equal(init.message.params.capabilities.experimentalApi, true);
  assert.equal(init.message.params.clientInfo.title, 'Pebble Plugin');
  assert.deepEqual([init.seq_id, initialized.seq_id, list.seq_id, add.seq_id], [1, 2, 3, 4]);
  assert.equal(init.env_id, 'env-1');
  assert.equal(add.cursor, 'c-1');
  assert.equal(initialized.message.method, 'initialized');
  assert.equal(closed.type, 'client_closed');
  assert.ok(socket.closed);
});

test('a nickname reaches its chat, and moves if given to another chat', async () => {
  let queued;
  const f = fixture({ WebSocket: relay(threads, (params) => { queued = params; }), routes: cloudTasks });
  await f.signIn();
  await f.enroll();
  const chats = await chatsOf(f);
  await f.configure({ type: 'codex_chat_save', chat: chats.find((c) => c.id === 'th-old'), nickname: 'BLE' });
  const named = await f.run('send_to_agent', { message: 'go', chat_id: 'ble' });
  assert.match(named.text, /Queued for Codex session "fix the BLE reconnect bug" on taz-runner; it runs when the session is next opened/);
  assert.equal(queued.threadId, 'th-old');

  await f.configure({ type: 'codex_chat_save', chat: chats.find((c) => c.id === 'task_e_1'), nickname: 'ble' });
  const listed = await chatsOf(f);
  assert.equal(listed.find((c) => c.id === 'th-old').nickname, '');
  assert.equal(listed.find((c) => c.id === 'task_e_1').nickname, 'ble');
  const moved = await f.run('send_to_agent', { message: 'also update docs', chat_id: 'BLE' });
  assert.equal(moved.text, 'Sent a follow-up to Codex Cloud task "Fix login".');
  const body = JSON.parse(f.calls.at(-1).init.body);
  assert.deepEqual(body.follow_up, { task_id: 'task_e_1', turn_id: 'turn-9', run_environment_in_qa_mode: false });
});

test('a chat is also found by its title, and an unknown name lists the choices', async () => {
  const f = fixture({ WebSocket: relay(threads), routes: cloudTasks });
  await f.signIn();
  await f.enroll();
  assert.equal((await f.run('send_to_agent', { message: 'go', chat_id: 'feed polish' })).text, 'Sent to Codex session "Index feed polish" on taz-runner.');
  const unknown = await f.run('send_to_agent', { message: 'go', chat_id: 'nothing like it' });
  assert.equal(unknown.code, 'INVALID_ARGS');
  assert.match(unknown.message, /"Index feed polish", "Fix login", "fix the BLE reconnect bug"/);
});

test('pairing claims the computer\'s code, manual or from the QR link', async () => {
  const bodies = [];
  const f = fixture({ routes: { [`POST ${RC}/client/pair`]: (init) => { bodies.push(JSON.parse(init.body)); return json(200, {}); } } });
  await f.signIn();
  await f.enroll();
  assert.equal((await f.configure({ type: 'status' })).codex.paired, false);
  const paired = await f.configure({ type: 'codex_pair', code: ' abcd-efgh ' });
  assert.equal(paired.computers[0].name, 'taz-runner');
  assert.equal((await f.configure({ type: 'status' })).codex.paired, true);
  await f.configure({ type: 'codex_pair', code: 'https://chatgpt.com/codex/pair?pairing_code=pc_123&x=1' });
  assert.deepEqual(bodies, [{ client_id: 'client-1', manual_pairing_code: 'ABCD-EFGH' }, { client_id: 'client-1', pairing_code: 'pc_123' }]);
  assert.equal(f.calls.find((c) => c.key === `POST ${RC}/client/pair`).init.headers['x-codex-client-id'], 'client-1');
  await assert.rejects(() => f.configure({ type: 'codex_pair', code: 'two words' }), /Paste the pairing code/);
});

test('an expired pairing code is explained', async () => {
  const f = fixture({ routes: { [`POST ${RC}/client/pair`]: () => json(400, { detail: 'expired' }) } });
  await f.signIn();
  await f.enroll();
  await assert.rejects(() => f.configure({ type: 'codex_pair', code: 'ABCD-EFGH' }), /did not work/);
});

test('a computer that has not paired this phone fails fast instead of hanging', async () => {
  const Socket = relay(threads);
  Socket.unpaired = true;
  const f = fixture({ WebSocket: Socket, routes: cloudTasks });
  await f.signIn();
  await f.enroll();
  const listed = await f.configure({ type: 'codex_chats' });
  assert.deepEqual(JSON.parse(JSON.stringify(listed.chats.map((c) => c.id))), ['task_e_1']);
  assert.match(listed.errors[0], /has not paired this phone/);
  assert.ok(Socket.last.closed);
});

test('a computer that has not paired is skipped when another has', async () => {
  let opened = 0;
  const Base = relay(threads);
  class Socket extends Base {
    constructor(url, protocols, options) {
      super(url, protocols, options);
      Base.unpaired = ++opened === 1;
    }
  }
  const f = fixture({
    WebSocket: Socket,
    routes: { [`GET ${RC}/environments`]: () => json(200, [
      { id: 'env-1', name: 'MacBook-Air.local', online: true }, { id: 'env-2', name: 'taz-runner', online: true },
    ]) },
  });
  await f.signIn();
  await f.enroll();
  const listed = await f.configure({ type: 'codex_chats' });
  assert.deepEqual(JSON.parse(JSON.stringify(listed.errors)), []);
  assert.ok(listed.chats.every((c) => c.computer === 'taz-runner'));
  assert.equal((await f.configure({ type: 'status' })).codex.paired, true);
});

test('no online computer is explained before any socket opens', async () => {
  let opened = false;
  const f = fixture({
    WebSocket: class { constructor() { opened = true; } },
    routes: { [`GET ${RC}/environments`]: () => json(200, [{ id: 'env-1', name: 'taz-runner', online: false }]) },
  });
  await f.signIn();
  await f.enroll();
  await f.configure({ type: 'codex_chat_save', chat: { kind: 'session', id: 'th-live', computer: 'taz-runner', label: 'x' }, nickname: 'feed' });
  const result = await f.run('send_to_agent', { message: 'go', chat_id: 'feed' });
  assert.match(result.message, /None of your computers is online/);
  assert.equal(opened, false);
});

test('sending to a computer session before connecting computers asks to connect them', async () => {
  const f = fixture();
  await f.signIn();
  await f.configure({ type: 'codex_chat_save', chat: { kind: 'session', id: 'th-live', computer: 'taz-runner', label: 'x' }, nickname: 'feed' });
  assert.equal((await f.run('send_to_agent', { message: 'go', chat_id: 'feed' })).code, 'AUTH_REQUIRED');
});

test('an expiring ChatGPT access token is renewed from the session before the call', async () => {
  const storage = new Map();
  const f = fixture({ storage, routes: { 'GET https://chatgpt.com/backend-api/wham/environments': () => json(200, []) } });
  await f.signIn();
  const saved = JSON.parse(storage.get('chatgpt.codex.session.v1'));
  saved.expiresAt = NOW + 60_000;
  storage.set('chatgpt.codex.session.v1', JSON.stringify(saved));
  await f.run('start_codex_cloud_task', { prompt: 'x' });
  const renewals = f.calls.filter((c) => c.key === 'GET https://chatgpt.com/api/auth/session');
  assert.equal(renewals.at(-1).init.headers.Cookie, '__Secure-next-auth.session-token=session-2');
});

test('agent/chats lists Codex chats with their ids, named by nickname or title', async () => {
  const f = fixture({ WebSocket: relay(threads), routes: cloudTasks });
  await f.signIn();
  await f.enroll();
  const chats = await chatsOf(f);
  await f.configure({ type: 'codex_chat_save', chat: chats.find((c) => c.id === 'th-old'), nickname: 'ble' });
  const listed = await f.agentChats();
  assert.deepEqual(Array.from(listed.instances, (i) => [i.instanceId, i.properties.name.shortText.text, i.properties.title.shortText.text]), [
    ['new-chat', 'New ChatGPT chat', 'New ChatGPT chat'],
    ['th-live', 'Index feed polish', 'Index feed polish'],
    ['task_e_1', 'Fix login', 'Fix login'],
    ['th-old', 'ble', 'fix the BLE reconnect bug'],
  ]);
  assert.equal((await f.run('send_to_agent', { message: 'go', chat_id: 'task_e_1' })).text, 'Sent a follow-up to Codex Cloud task "Fix login".');
});

const ids = async (f) => Array.from((await f.agentChats()).instances, (i) => i.instanceId);
const MINUTE = 60_000;

test('agent/chats lists fresh with no cache, serves a cache under 5 minutes old, and relists after', async () => {
  const f = fixture({ routes: cloudTasks });
  await f.signIn();
  assert.deepEqual(await ids(f), ['new-chat', 'task_e_1']);
  f.backend[`GET ${WHAM}/tasks/list`] = () => json(200, { items: [{ id: 'task_new', title: 'New', updated_at: NOW / 1000 }] });
  f.clock.now = NOW + 4 * MINUTE;
  const before = f.calls.length;
  assert.deepEqual(await ids(f), ['new-chat', 'task_e_1']);
  assert.equal(f.calls.length, before);
  f.clock.now = NOW + 6 * MINUTE;
  assert.deepEqual(await ids(f), ['new-chat', 'task_new']);
});

test('a stale cache is served when the fresh listing reaches no part', async () => {
  const f = fixture({ WebSocket: relay(threads), routes: cloudTasks });
  await f.signIn();
  await f.enroll();
  await chatsOf(f);
  f.backend[`GET ${RC}/environments`] = () => json(500, {});
  f.backend[`GET ${WHAM}/tasks/list`] = () => json(500, {});
  f.backend['GET https://chatgpt.com/backend-api/conversations'] = () => json(500, {});
  f.clock.now = NOW + 6 * MINUTE;
  assert.deepEqual(await ids(f), ['new-chat', 'th-live', 'task_e_1', 'th-old']);
});

test('another session switching account hides this account\'s cache and drops its in-flight listing', async () => {
  const storage = new Map();
  const a = fixture({ routes: cloudTasks, storage });
  await a.signIn();
  await chatsOf(a);
  const b = fixture({ storage });
  b.backend['GET https://chatgpt.com/api/auth/session'] = () => json(200, { sessionToken: 'session-3', accessToken: jwt({
    exp: NOW / 1000 + 3600, 'https://api.openai.com/auth': { chatgpt_account_id: 'acct-2', chatgpt_user_id: 'user-2' },
  }) });
  // Another session's sign-in that, unlike codex_connect, leaves the cache in place.
  const other = JSON.parse(storage.get('chatgpt.codex.session.v1'));
  storage.set('chatgpt.codex.session.v1', JSON.stringify({ ...other, account: 'acct-2', user: 'user-2' }));
  a.backend[`GET ${WHAM}/tasks/list`] = () => json(200, { items: [] });
  assert.deepEqual(await ids(a), ['new-chat']);

  storage.set('chatgpt.codex.session.v1', JSON.stringify(other));
  storage.delete(CACHE_KEY);
  const answer = heldTasks(a);
  const pending = a.agentChats();
  await flush();
  await b.signIn();
  answer(0, 'acct1');
  await pending;
  assert.ok(!storage.has(CACHE_KEY));
});

test('a Codex Cloud task starts in the named environment on its default branch', async () => {
  const f = fixture({
    routes: {
      [`GET ${WHAM}/environments`]: () => json(200, [
        { id: 'e-1', label: 'coreapp', repo_map: { r: { default_branch: 'develop' } }, env_vars: { SECRET: 'x' } },
        { id: 'e-2', label: 'appstore-backend' },
      ]),
      [`POST ${WHAM}/tasks`]: () => json(200, { task: { id: 'task_e_1' } }),
    },
  });
  await f.signIn();
  const result = await f.run('start_codex_cloud_task', { prompt: 'add a test', environment: 'coreapp' });
  assert.equal(result.text, 'Started a Codex Cloud task in coreapp.');
  const body = JSON.parse(f.calls.at(-1).init.body);
  assert.deepEqual(body.new_task, { environment_id: 'e-1', branch: 'develop', run_environment_in_qa_mode: false });
  assert.equal(body.input_items[0].content[0].text, 'add a test');
  assert.ok(!JSON.stringify(result).includes('SECRET'));
});

test('signing out of Codex forgets the account, the computers and the cached chats', async () => {
  const f = fixture({ WebSocket: relay(threads), routes: cloudTasks });
  await f.signIn();
  await f.enroll();
  await chatsOf(f);
  const status = await f.configure({ type: 'codex_disconnect' });
  assert.equal(status.codex.signedIn, false);
  assert.equal(status.codex.remoteControl, false);
  assert.equal((await f.agentChats()).instances.length, 0);
});

test('an agent/chats id wins over a nickname that spells the same id', async () => {
  let queued;
  const f = fixture({ WebSocket: relay(threads, (params) => { queued = params; }), routes: cloudTasks });
  await f.signIn();
  await f.enroll();
  const chats = await chatsOf(f);
  await f.configure({ type: 'codex_chat_save', chat: chats.find((c) => c.id === 'th-old'), nickname: 'th-live' });
  await f.run('send_to_agent', { message: 'go', chat_id: 'th-live' });
  assert.equal(queued.threadId, 'th-live');
  await f.configure({ type: 'codex_chat_save', chat: chats.find((c) => c.id === 'th-old'), nickname: 'my task_e_1 notes' });
  assert.equal((await f.run('send_to_agent', { message: 'go', chat_id: 'task_e_1' })).text, 'Sent a follow-up to Codex Cloud task "Fix login".');
});

const DOT_KEY = 'chatgpt-dots.connection.v1';
const SAVED_DOT = { account: ACCOUNT, user: 'user-1', room: 'room-1', dotName: 'Sol' };
const CACHE_KEY = 'chatgpt.codex.chats.cache.v1';
const flush = async () => { for (let i = 0; i < 50; i++) await new Promise((resolve) => setImmediate(resolve)); };
const stall = () => new Promise(() => {});

test('with a cache under 5 minutes old, a stalled Codex backend does not hold up agent/chats or the Dot', async () => {
  const f = fixture({ WebSocket: relay(threads), routes: cloudTasks });
  await f.signIn();
  f.storage.set(DOT_KEY, JSON.stringify(SAVED_DOT));
  await f.enroll();
  await chatsOf(f);
  f.backend[`GET ${RC}/environments`] = stall;
  f.backend[`GET ${WHAM}/tasks/list`] = stall;
  const again = await f.agentChats();
  assert.deepEqual(Array.from(again.instances, (i) => i.instanceId), ['dot', 'new-chat', 'th-live', 'task_e_1', 'th-old']);
});

test('the Dot is listed even when no other part can be listed', async () => {
  const f = fixture({ routes: {
    [`GET ${WHAM}/tasks/list`]: () => json(500, {}),
    'GET https://chatgpt.com/backend-api/conversations': () => json(500, {}),
  } });
  await f.signIn();
  f.storage.set(DOT_KEY, JSON.stringify(SAVED_DOT));
  assert.deepEqual(Array.from((await f.agentChats()).instances, (i) => [i.instanceId, i.properties.name.shortText.text]),
    [['dot', 'Sol'], ['new-chat', 'New ChatGPT chat']]);
  assert.ok(!f.storage.has(CACHE_KEY));
});

test('a live id not yet cached still wins over a nickname that spells it', async () => {
  let queued;
  const f = fixture({ WebSocket: relay(threads, (params) => { queued = params; }), routes: cloudTasks });
  await f.signIn();
  await f.enroll();
  await f.configure({ type: 'codex_chat_save', chat: { kind: 'session', id: 'th-old', computer: 'taz-runner', label: 'x' }, nickname: 'th-live' });
  assert.ok(!f.storage.has(CACHE_KEY));
  await f.run('send_to_agent', { message: 'go', chat_id: 'th-live' });
  assert.equal(queued.threadId, 'th-live');
});

/** A Cloud task list that answers each request only when the test says, in any order. */
function heldTasks(f) {
  const held = [];
  f.backend[`GET ${WHAM}/tasks/list`] = () => new Promise((resolve) => held.push(resolve));
  return (i, title) => held[i](json(200, { items: [{ id: 'task_' + title, title, updated_at: NOW / 1000 }] }));
}
const cachedIds = (f) => JSON.parse(f.storage.get(CACHE_KEY)).chats.map((c) => c.id);

test('a listing still running when Codex is signed out does not bring the cache back', async () => {
  const f = fixture();
  await f.signIn();
  const answer = heldTasks(f);
  const pending = f.agentChats();
  await flush();
  await f.configure({ type: 'codex_disconnect' });
  answer(0, 'stale');
  await pending;
  assert.ok(!f.storage.has(CACHE_KEY));
});

test('an older listing finishing last does not overwrite a newer one', async () => {
  const f = fixture();
  await f.signIn();
  const answer = heldTasks(f);
  const first = f.agentChats();
  const second = f.agentChats();
  await flush();
  answer(1, 'newer');
  await second;
  answer(0, 'older');
  await first;
  assert.deepEqual(cachedIds(f), ['task_newer']);
});

test('signing in to a different ChatGPT account for Codex clears the cached chats', async () => {
  const f = fixture({ routes: cloudTasks });
  await f.signIn();
  await chatsOf(f);
  await f.signIn();
  assert.deepEqual(cachedIds(f), ['task_e_1']);
  f.backend['GET https://chatgpt.com/api/auth/session'] = () => json(200, { sessionToken: 'session-3', accessToken: jwt({
    exp: NOW / 1000 + 3600, 'https://api.openai.com/auth': { chatgpt_account_id: 'acct-2', chatgpt_user_id: 'user-2' },
  }) });
  await f.signIn();
  assert.ok(!f.storage.has(CACHE_KEY));
});

test('a cache that cannot be written never fails a send or the source', async () => {
  class FullDisk extends Map {
    set(key, value) {
      if (key === CACHE_KEY) throw new Error('disk full');
      return super.set(key, value);
    }
  }
  const f = fixture({ WebSocket: relay(threads), routes: cloudTasks, storage: new FullDisk() });
  await f.signIn();
  await f.enroll();
  assert.equal((await f.run('send_to_agent', { message: 'go', chat_id: 'feed polish' })).ok, true);
  assert.deepEqual(await ids(f), ['new-chat', 'th-live', 'task_e_1', 'th-old']);
});

const PREFS_KEY = 'chatgpt.codex.chats.v1';
const DOT_ROUTE = 'POST https://chatgpt.com/backend-api/messaging/rooms/room-1/messages';
function signInDot(f) {
  f.storage.set(DOT_KEY, JSON.stringify({
    accessToken: accessToken(), sessionToken: 's', account: ACCOUNT, user: 'user-1', email: '',
    expiresAt: NOW + 3600_000, room: 'room-1', dotName: 'Sol',
  }));
  f.backend[DOT_ROUTE] = (init) => json(200, { id: 'm-1', request_id: JSON.parse(init.body).request_id });
}
const configured = async (f) => {
  const p = await f.agentConfigured();
  return [p.configured.boolean.value, p.name.shortText.text, p.configured.shortText.text];
};

test('a Codex-only user with a default chat is configured, and a send with no chat_id reaches it', async () => {
  let queued;
  const f = fixture({ WebSocket: relay(threads, (params) => { queued = params; }), routes: cloudTasks });
  assert.deepEqual(await configured(f), [false, '', 'Sign in in settings']);
  await f.signIn();
  await f.enroll();
  assert.deepEqual(await configured(f), [false, '', 'Choose a Codex chat in settings']);
  const chats = await chatsOf(f);
  await f.configure({ type: 'codex_chat_save', chat: chats.find((c) => c.id === 'th-live'), nickname: '', makeDefault: true });
  assert.equal((await chatsOf(f)).find((c) => c.isDefault).id, 'th-live');
  assert.deepEqual(await configured(f), [true, 'Index feed polish', 'Connected']);
  assert.equal((await f.configure({ type: 'status' })).destination.choosable, false);
  const result = await f.run('send_to_agent', { message: 'run the tests' });
  assert.equal(result.text, 'Sent to Codex session "Index feed polish" on taz-runner.');
  assert.equal(queued.threadId, 'th-live');
});

test('with the Dot and a Codex default both set up, the chosen destination gets sends with no chat_id', async () => {
  let queued;
  const f = fixture({ WebSocket: relay(threads, (params) => { queued = params; }), routes: cloudTasks });
  signInDot(f);
  await f.signIn();
  await f.enroll();
  const chats = await chatsOf(f);
  await f.configure({ type: 'codex_chat_save', chat: chats.find((c) => c.id === 'th-old'), nickname: 'ble', makeDefault: true });
  assert.deepEqual(JSON.parse(JSON.stringify((await f.configure({ type: 'status' })).destination)), { kind: 'dot', chosen: 'dot', choosable: true });
  assert.deepEqual(await configured(f), [true, 'Sol', 'Connected']);
  assert.equal((await f.run('send_to_agent', { message: 'hi' })).text, 'Message sent to Sol.');
  assert.equal(queued, undefined);

  assert.equal((await f.configure({ type: 'destination', destination: 'codex' })).destination.kind, 'codex');
  assert.deepEqual(await configured(f), [true, 'ble', 'Connected']);
  assert.match((await f.run('send_to_agent', { message: 'hi' })).text, /fix the BLE reconnect bug/);
  assert.equal(queued.threadId, 'th-old');
  await assert.rejects(() => f.configure({ type: 'destination', destination: 'email' }), /Choose the Dot/);
});

test('the chosen destination falls back to the other when it is not set up', async () => {
  let queued;
  const f = fixture({ WebSocket: relay(threads, (params) => { queued = params; }), routes: cloudTasks });
  signInDot(f);
  await f.signIn();
  await f.enroll();
  await f.configure({ type: 'codex_chat_save', chat: { kind: 'session', id: 'th-live', computer: 'taz-runner', label: 'Index feed polish' }, makeDefault: true });
  await f.configure({ type: 'destination', destination: 'dot' });
  f.storage.delete(DOT_KEY);
  assert.deepEqual(await configured(f), [true, 'Index feed polish', 'Connected']);
  await f.run('send_to_agent', { message: 'hi' });
  assert.equal(queued.threadId, 'th-live');

  const g = fixture();
  signInDot(g);
  await g.signIn();
  await g.configure({ type: 'destination', destination: 'codex' });
  assert.deepEqual(await configured(g), [true, 'Sol', 'Connected']);
  assert.equal((await g.run('send_to_agent', { message: 'hi' })).text, 'Message sent to Sol.');
});

test('with neither the Dot nor a Codex default, a send with no chat_id fails and sends nothing', async () => {
  const f = fixture({ WebSocket: relay(threads), routes: cloudTasks });
  const none = await f.run('send_to_agent', { message: 'hi' });
  assert.equal(none.code, 'INVALID_ARGS');
  assert.match(none.message, /Sign in with ChatGPT, then set up a Dot or pick a default chat/);
  assert.equal(f.calls.length, 0);
  await f.signIn();
  const before = f.calls.length;
  assert.equal((await f.run('send_to_agent', { message: 'hi' })).code, 'INVALID_ARGS');
  assert.equal(f.calls.length, before);
});

test('a default chat saved by v0.2.0 is honoured and survives saving a nickname', async () => {
  let queued;
  const f = fixture({ WebSocket: relay(threads, (params) => { queued = params; }), routes: cloudTasks });
  f.storage.set(PREFS_KEY, JSON.stringify({
    defaultChat: { kind: 'session', id: 'th-old', computer: 'taz-runner', label: 'fix the BLE reconnect bug' }, nicknames: {},
  }));
  await f.signIn();
  await f.enroll();
  assert.deepEqual(await configured(f), [true, 'fix the BLE reconnect bug', 'Connected']);
  const chats = await chatsOf(f);
  await f.configure({ type: 'codex_chat_save', chat: chats.find((c) => c.id === 'th-live'), nickname: 'feed' });
  assert.equal(JSON.parse(f.storage.get(PREFS_KEY)).accounts['acct-1:user-1'].defaultChat.id, 'th-old');
  await f.run('send_to_agent', { message: 'hi' });
  assert.equal(queued.threadId, 'th-old');
});

test('settings set the default chat without touching its nickname, and report what is chosen', async () => {
  const f = fixture({ WebSocket: relay(threads), routes: cloudTasks });
  assert.equal((await f.configure({ type: 'status' })).destination.chosen, 'dot');
  await f.signIn();
  await f.enroll();
  let status = await f.configure({ type: 'status' });
  assert.deepEqual(JSON.parse(JSON.stringify(status.destination)), { kind: null, chosen: 'codex', choosable: false });
  const chats = await chatsOf(f);
  const old = chats.find((c) => c.id === 'th-old');
  await f.configure({ type: 'codex_chat_save', chat: old, nickname: 'ble' });
  status = await f.configure({ type: 'codex_default', chat: old });
  assert.equal(status.codex.defaultChat.id, 'th-old');
  assert.equal(status.codex.defaultChat.nickname, 'ble');
  assert.deepEqual(JSON.parse(JSON.stringify(status.destination)), { kind: 'codex', chosen: 'codex', choosable: false });
  signInDot(f);
  status = await f.configure({ type: 'status' });
  assert.deepEqual(JSON.parse(JSON.stringify(status.destination)), { kind: 'dot', chosen: 'dot', choosable: true });
  assert.deepEqual(await configured(f), [true, 'Sol', 'Connected']);
});

const ACCOUNT_A = () => json(200, { accessToken: accessToken(), sessionToken: 'session-2' });
const ACCOUNT_B = () => json(200, { sessionToken: 'session-3', accessToken: jwt({
  exp: NOW / 1000 + 3600, 'https://api.openai.com/auth': { chatgpt_account_id: 'acct-2', chatgpt_user_id: 'user-2' },
}) });
async function signInAs(f, account) {
  f.backend['GET https://chatgpt.com/api/auth/session'] = account;
  await f.signIn();
}

test('another Codex account does not see the default chat or nicknames; the same account gets them back', async () => {
  const f = fixture({ WebSocket: relay(threads), routes: cloudTasks });
  await f.signIn();
  await f.enroll();
  const chats = await chatsOf(f);
  await f.configure({ type: 'codex_chat_save', chat: chats.find((c) => c.id === 'th-old'), nickname: 'ble', makeDefault: true });
  await f.configure({ type: 'codex_chat_save', chat: chats.find((c) => c.id === 'task_e_1'), nickname: 'zed' });
  assert.deepEqual(await configured(f), [true, 'ble', 'Connected']);

  await f.configure({ type: 'codex_disconnect' });
  await signInAs(f, ACCOUNT_B);
  const status = await f.configure({ type: 'status' });
  assert.equal(status.codex.defaultChat, null);
  assert.deepEqual(await configured(f), [false, '', 'Choose a Codex chat in settings']);
  assert.equal((await f.run('send_to_agent', { message: 'hi' })).code, 'INVALID_ARGS');
  const prefs = await f.configure({ type: 'codex_chats' });
  assert.ok(prefs.chats.every((c) => !c.nickname && !c.isDefault));
  assert.equal((await f.run('send_to_agent', { message: 'hi', chat_id: 'zed' })).code, 'INVALID_ARGS');
  await f.configure({ type: 'codex_chat_save', chat: chats.find((c) => c.id === 'task_e_1'), nickname: 'mine' });

  await signInAs(f, ACCOUNT_A);
  assert.deepEqual(await configured(f), [true, 'ble', 'Connected']);
  const back = (await f.configure({ type: 'codex_chats' })).chats;
  assert.equal(back.find((c) => c.id === 'task_e_1').nickname, 'zed');
});

test('legacy v0.2.0 prefs are adopted by the first account that reads them, and no other', async () => {
  const f = fixture({ routes: cloudTasks });
  f.storage.set(PREFS_KEY, JSON.stringify({
    defaultChat: { kind: 'task', id: 'task_e_1', computer: '', label: 'Fix login' }, nicknames: {}, destination: 'codex',
  }));
  assert.deepEqual(await configured(f), [false, '', 'Sign in in settings']);
  assert.equal(JSON.parse(f.storage.get(PREFS_KEY)).accounts, undefined);
  await f.signIn();
  assert.deepEqual(await configured(f), [true, 'Fix login', 'Connected']);
  assert.deepEqual(Object.keys(JSON.parse(f.storage.get(PREFS_KEY)).accounts), ['acct-1:user-1']);

  await signInAs(f, ACCOUNT_B);
  assert.deepEqual(await configured(f), [false, '', 'Choose a Codex chat in settings']);
  assert.equal((await f.configure({ type: 'status' })).destination.chosen, 'codex');
  await signInAs(f, ACCOUNT_A);
  assert.deepEqual(await configured(f), [true, 'Fix login', 'Connected']);
});
