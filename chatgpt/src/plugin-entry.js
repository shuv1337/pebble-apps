'use strict';

require('./text-encoder');
var PluginError = require('./util').PluginError;
var createDotsService = require('./dots').createDotsService;
var createCodexAuth = require('./codex-auth').createCodexAuth;
var createCodexRemote = require('./codex-remote').createCodexRemote;
var createCodexCloud = require('./codex-cloud').createCodexCloud;
var createCodexChats = require('./codex-chats').createCodexChats;
var createChatGptChats = require('./chatgpt-chats').createChatGptChats;
var reach = require('./reach');

var DOT_ID = 'dot';
var NEW_CHAT_ID = 'new-chat';
var NEW_CHAT_NAME = 'New ChatGPT chat';
var CHATS_FRESH_MS = 5 * 60 * 1000;
var PART_LABELS = { computers: 'Computers: ', cloud: 'Codex Cloud: ', chatgpt: 'ChatGPT chats: ' };

function chatInstance(id, name, title) {
  return { instanceId: id, properties: { name: { shortText: { text: name } }, title: { shortText: { text: title } } } };
}

function createPlugin(storage, fetch, now, WebSocketImpl) {
  var auth = createCodexAuth(storage, fetch, now);
  var dots = createDotsService(storage, fetch, auth);
  var remote = createCodexRemote(storage, fetch, now, WebSocketImpl, auth);
  var cloud = createCodexCloud(fetch, auth);
  var chatgpt = createChatGptChats(storage, fetch, now, auth);
  var chats = createCodexChats(storage, remote, cloud, chatgpt, auth, now);

  async function codexStatus() {
    var account = await auth.load();
    var connected = await remote.load();
    var saved = await chats.prefs();
    var chosen = saved.defaultChat;
    var nick = chosen && saved.nicknames[chats.keyOf(chosen)];
    return {
      signedIn: !!account,
      email: account ? account.email : '',
      remoteControl: !!connected,
      paired: !!(connected && connected.paired),
      defaultChat: chosen ? Object.assign({}, chosen, { nickname: nick ? nick.nickname : '' }) : null,
    };
  }

  /**
   * Where a send with no chat named goes, from local state only: the chosen destination when it is
   * set up, else the other one. [target] is null when neither is.
   */
  async function destination() {
    var dot = await dots.status();
    var saved = await chats.prefs();
    var account = await auth.load();
    var codex = account && saved.defaultChat;
    var dotTarget = dot.configured ? { kind: 'dot', name: dot.dotName } : null;
    var nick = codex && saved.nicknames[chats.keyOf(codex)];
    var codexTarget = codex ? { kind: 'codex', chat: codex, name: nick ? nick.nickname : codex.label } : null;
    var target = saved.destination === 'codex' ? codexTarget || dotTarget : dotTarget || codexTarget;
    return {
      target: target,
      // What settings show as picked: the saved choice, else the one a send would use.
      chosen: saved.destination || (dot.configured || !account ? 'dot' : 'codex'),
      choosable: !!(dotTarget && codexTarget),
      hint: target ? 'Connected' : account ? 'Choose a Codex chat in settings' : 'Sign in in settings',
    };
  }

  async function status() {
    var where = await destination();
    return {
      dots: await dots.status(),
      codex: await codexStatus(),
      destination: { kind: where.target ? where.target.kind : null, chosen: where.chosen, choosable: where.choosable },
    };
  }

  /**
   * Signs in for everything, then looks for the account's Dot: no Dot (or no reaching it) still
   * signs in, and [dotError] says why. Another account drops the old one's Dot, computers and chats.
   */
  async function connect(sessionToken) {
    return signIn(function () { return auth.connect(sessionToken); });
  }

  async function signIn(signInWith) {
    var before = await auth.load();
    var after = await signInWith();
    if (!before || before.account !== after.account || before.user !== after.user) {
      await remote.disconnect();
      await dots.disconnect();
      await chats.forget();
    }
    try {
      await dots.connect();
      return status();
    } catch (error) {
      if (error.code === 'AUTH_REQUIRED') throw error;
      return Object.assign(await status(), { dotError: safeError(error).message });
    }
  }

  async function config(message) {
    switch (message && message.type) {
      case 'status':
        return status();
      case 'connect':
      case 'dots_connect':
      case 'codex_connect':
        return connect(message.session_token);
      case 'device_begin':
        return auth.beginDevice();
      case 'device_poll': {
        var ready = await auth.pollDevice();
        return ready ? signIn(function () { return auth.adopt(ready); }) : { pending: true };
      }
      case 'codex_enroll_begin':
        return auth.beginEnroll(message.entropy);
      case 'codex_enroll_finish': {
        var finished = await auth.finishEnroll(message.url);
        await remote.enroll(finished.stepUpToken, finished.seed);
        return status();
      }
      case 'codex_chats': {
        var found = await chats.list();
        return {
          chats: found.chats,
          errors: found.errors.map(function (e) { return PART_LABELS[e.part] + safeError(e.error).message; }),
        };
      }
      case 'codex_chat_save':
        await chats.update(message.chat, message.nickname, !!message.makeDefault);
        return { ok: true };
      case 'codex_default':
        await chats.update(message.chat, undefined, true);
        return status();
      case 'destination':
        await chats.setDestination(message.destination);
        return status();
      case 'codex_pair':
        return { computers: await remote.pair(message.code) };
      case 'codex_computers':
        return { computers: await remote.computers() };
      case 'disconnect':
      case 'dots_disconnect':
      case 'codex_disconnect':
        await remote.disconnect();
        await dots.disconnect();
        await auth.signOut();
        await chats.forget();
        return status();
      default:
        throw PluginError('INVALID_ARGS', 'Unknown settings request.');
    }
  }

  var actions = {
    send_to_agent: sendToAgent,
    start_codex_cloud_task: cloud.create,
  };

  /** No chat_id goes to the chosen destination; "dot" or the Dot's name to the Dot; "new-chat" starts a ChatGPT chat; anything else names a chat in the list. */
  async function sendToAgent(args) {
    var text = args.message;
    if (typeof text !== 'string' || !text.trim() || text.length > 16000) {
      throw PluginError('INVALID_ARGS', 'Provide a message between 1 and 16,000 characters.');
    }
    if (args.chat_id !== undefined && args.chat_id !== null && typeof args.chat_id !== 'string') {
      throw PluginError('INVALID_ARGS', 'Name a ChatGPT chat.');
    }
    text += ' ⌚';
    var wanted = (args.chat_id || '').trim().toLowerCase();
    if (!wanted) {
      var target = (await destination()).target;
      if (!target) {
        throw PluginError('INVALID_ARGS', 'Nowhere to send yet. Sign in with ChatGPT, then set up a Dot or pick a default chat, in plugin settings.');
      }
      return target.kind === 'dot' ? dots.send({ message: text }) : chats.deliver(target.chat, text);
    }
    var dot = await dots.status();
    if (wanted === DOT_ID || (dot.configured && wanted === dot.dotName.toLowerCase())) {
      return dots.send({ message: text });
    }
    if (wanted === NEW_CHAT_ID || wanted === NEW_CHAT_NAME.toLowerCase()) return chatgpt.send({ message: text });
    return chats.send({ message: text, chat: args.chat_id });
  }

  async function action(request) {
    var handler = request && actions[request.action];
    if (!handler) {
      console.error('Unsupported action: ' + (request && request.action));
      throw PluginError('INVALID_ARGS', 'Unknown action.');
    }
    return handler(request.args || {});
  }

  async function source(request) {
    if (!request || request.category !== 'agent') {
      console.error('Unsupported source: ' + (request && request.category));
      throw PluginError('INVALID_ARGS', 'Unsupported ChatGPT source.');
    }
    if (request.item === 'configured') {
      var where = await destination();
      return { validUntilMs: now() + 60 * 1000, instances: [{ instanceId: 'chatgpt', properties: {
        name: { shortText: { text: where.target ? where.target.name : '' } },
        configured: { boolean: { value: !!where.target }, shortText: { text: where.hint } },
      } }] };
    }
    var dot = await dots.status();
    if (request.item !== 'chats') {
      console.error('Unsupported source: agent/' + request.item);
      throw PluginError('INVALID_ARGS', 'Unsupported ChatGPT source.');
    }
    var instances = dot.configured ? [chatInstance(DOT_ID, dot.dotName, dot.dotName)] : [];
    if (await auth.load()) instances.push(chatInstance(NEW_CHAT_ID, NEW_CHAT_NAME, NEW_CHAT_NAME));
    (await codexChats()).forEach(function (chat) {
      instances.push(chatInstance(chat.id, chat.nickname || chat.label, chat.label));
    });
    return { validUntilMs: now() + 900 * 1000, instances: instances };
  }

  /** A recent cached list as is; otherwise a fresh one, or the stale cache if no Codex half answers. */
  async function codexChats() {
    var cache = await chats.cached();
    if (cache && now() - cache.at < CHATS_FRESH_MS) return cache.chats;
    var stale = cache ? cache.chats : [];
    try {
      var fresh = await chats.list();
      return fresh.errors.length < 2 ? fresh.chats : stale;
    } catch (_) {
      return stale;
    }
  }

  return { config: config, action: action, source: source };
}

/** Never forward responses, tokens or exception text from ChatGPT or Codex. */
function safeError(error) {
  // Coded messages can quote chat names; uncaught ones can quote responses.
  console.error('ChatGPT request failed: ' + ((error && error.code) || (error && error.name) || error));
  if (error && error.code) return { code: error.code, message: error.message };
  return {
    code: 'PLUGIN_UNAVAILABLE',
    message: 'Could not reach ChatGPT. If sending, delivery may be uncertain; check before trying again.',
  };
}

// Probes have no deadline, so a failed action answers from the last check and starts a new one.
function withBlockedHost(error, safe, storage, request) {
  if (error && error.code) return safe;
  var blocked = reach.notAllowedHost(error);
  try {
    if (!blocked) blocked = reach.lastBlocked(storage);
    reach.checkReach(storage, request).catch(function () {});
  } catch (_) {}
  return blocked ? { code: safe.code, message: reach.blockedMessage(blocked) + ' If sending, delivery may be uncertain; check before trying again.' } : safe;
}

if (typeof Pebble !== 'undefined') {
  var plugin = createPlugin(Pebble.secureStorage, fetch, Date.now, WebSocket);

  Pebble.registerActionHandler(function (request, response) {
    plugin.action(request).then(response.ok, function (error) {
      var safe = safeError(error);
      try { safe = withBlockedHost(error, safe, globalThis.localStorage, fetch); } catch (e) {}
      response.error(safe.code, safe.message);
    });
  });

  Pebble.registerSourceHandler(function (request, respond) {
    plugin.source(request).then(respond.data, function (error) {
      var safe = safeError(error);
      respond.error(safe.code, safe.message);
    });
  });

  Pebble.registerConfigHandler(function (message, respond) {
    if (message && message.type === 'reach') {
      reach.checkReach(globalThis.localStorage, fetch).catch(function () { return null; })
        .then(function (blocked) { respond({ blocked: blocked }); });
      return;
    }
    plugin.config(message).then(respond, function (error) {
      respond({ error: safeError(error).message });
    });
  });
}

module.exports = { createPlugin: createPlugin, safeError: safeError, withBlockedHost: withBlockedHost };
