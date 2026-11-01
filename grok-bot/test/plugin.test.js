const test = require("node:test");
const assert = require("node:assert/strict");

const { createService, safeError } = require("../src/plugin/index.js");

const BOX = "https://abc-pod-def.us12.cursorvm.com";

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

const reply = (id, content) => ({ id, kind: "send-message", message: { type: "text", content } });

/**
 * A fake Cursor backend + box. Each sendPrompt appends the prompt as a `user` entry and records
 * it in the acceptance ledger; `onSend` lets a test decide what the bot then writes.
 */
function fakeGrokBot(options = {}) {
  const calls = [];
  const transcript = [reply("e1", "old reply")];
  const ledger = new Map();
  let ids = 1;
  async function fetch(url, init) {
    const body = JSON.parse(init.body);
    calls.push({ url, headers: init.headers, body });
    const json = (status, value) => ({ ok: status < 300, status, text: async () => JSON.stringify(value) });
    if (url === "https://api2.cursor.sh/aiserver.v1.GrokBotService/EnsureSandBox") {
      if (options.onEnsure) options.onEnsure();
      if (!/^Bearer (cursor-token|eyJ[\w-]*\.[\w-]+\.[\w-]*)$/.test(init.headers.authorization)) return json(401, {});
      return json(200, options.ensure || { gatewayUrl: BOX + "/", gatewayToken: "box-token", anyrunNetworkToken: "net" });
    }
    assert.ok(url.startsWith(BOX + "/api/"), url);
    assert.equal(init.headers.authorization, "Bearer box-token");
    assert.equal(init.headers["x-anyrun-network-token"], "net");
    const method = url.slice(BOX.length + 5);
    if (options.fail && options.fail(method)) return json(options.failStatus || 502, {});
    switch (method) {
      case "listAgents":
        return json(200, { agents: [{ id: "g1", name: "Team", memberIds: ["a1"] }, { id: "a1", name: "Ada" }] });
      case "getAgentTranscriptTail":
        return json(200, { entries: transcript });
      case "promptAcceptanceStatus": {
        const record = ledger.get(body.clientNonce);
        return json(200, record ? { outcome: "found", record } : { outcome: "missing" });
      }
      case "sendPrompt": {
        const id = "p" + ids++;
        transcript.push({ id, kind: "user", text: body.prompt });
        ledger.set(body.clientNonce, { status: options.rejected ? "rejected" : "accepted", echoEntryId: id });
        if (options.onSend) options.onSend(body.prompt, transcript);
        else transcript.push(reply("r" + id, "re: " + body.prompt));
        return json(200, { accepted: true });
      }
    }
    throw new Error("unexpected " + url);
  }
  return { fetch, calls, transcript };
}

async function connected(grok) {
  const storage = memoryStorage();
  await createService(storage, grok.fetch).config({ type: "connect", accessToken: "cursor-token" });
  return createService(storage, grok.fetch);
}

test("connects, picks the first bot, sends and returns a receipt; replies are read separately", async () => {
  const grok = fakeGrokBot();
  const service = createService(memoryStorage(), grok.fetch);
  const settings = await service.config({ type: "connect", accessToken: "cursor-token" });
  assert.equal(settings.selected, "a1");
  assert.equal(settings.defaultName, "Ada");
  assert.deepEqual(settings.bots, [
    { id: "g1", name: "Team", group: true, nickname: "" },
    { id: "a1", name: "Ada", group: false, nickname: "" },
  ]);

  const result = await service.action({ action: "send_to_agent", args: { message: "hello" } });
  assert.equal(result.text, "Message sent to Ada. Read Grok Bot's replies later for its answer.");
  const sent = grok.calls.find((c) => c.url.endsWith("/api/sendPrompt"));
  assert.equal(sent.body.agentId, "a1");
  assert.ok(sent.body.clientNonce);

  const read = await service.action({ action: "read_grok_bot", args: { limit: 5 } });
  assert.equal(read.text, "Ada: old reply\n\nre: hello ⌚");
});

test("reports a send the bot rejected as not sent", async () => {
  const service = await connected(fakeGrokBot({ rejected: true }));
  const err = await service.action({ action: "send_to_agent", args: { message: "x" } }).catch((e) => e);
  assert.match(safeError(err).message, /did not accept/);
});

test("refuses to send when the box lookup used up the time budget", async () => {
  const realNow = Date.now;
  let skew = 0;
  Date.now = () => realNow() + skew;
  try {
    let lookups = 0;
    // Sign-in is quick; the send's box lookup then takes 15s of the 18s budget.
    const slow = fakeGrokBot({ onEnsure: () => (lookups++ > 0 ? (skew += 15000) : 0) });
    const service = await connected(slow);
    const err = await service.action({ action: "send_to_agent", args: { message: "x" } }).catch((e) => e);
    assert.match(safeError(err).message, /not sent/);
    assert.ok(!slow.calls.some((c) => c.url.endsWith("/api/sendPrompt")));
  } finally {
    Date.now = realNow;
  }
});

test("rejects a box URL outside cursorvm.com", async () => {
  const grok = fakeGrokBot({ ensure: { gatewayUrl: "https://evil.example.com", gatewayToken: "t" } });
  const service = createService(memoryStorage(), grok.fetch);
  await assert.rejects(service.config({ type: "connect", accessToken: "cursor-token" }), /not available/);
  assert.equal(grok.calls.length, 1);
});

test("expired sign-in and uncertain send are reported distinctly", async () => {
  const err = await createService(memoryStorage(), fakeGrokBot().fetch)
    .config({ type: "connect", accessToken: "stale" })
    .catch((e) => e);
  assert.equal(safeError(err).code, "AUTH_REQUIRED");

  const broken = await connected(fakeGrokBot({ fail: (m) => m === "sendPrompt" }));
  const sendErr = await broken.action({ action: "send_to_agent", args: { message: "x" } }).catch((e) => e);
  assert.match(safeError(sendErr).message, /uncertain/);
});

test("requires sign-in and valid args", async () => {
  const service = createService(memoryStorage(), fakeGrokBot().fetch);
  const noAuth = await service.action({ action: "read_grok_bot", args: {} }).catch((e) => e);
  assert.equal(safeError(noAuth).code, "AUTH_REQUIRED");
  const bad = await service.action({ action: "send_to_agent", args: { message: " " } }).catch((e) => e);
  assert.equal(safeError(bad).code, "INVALID_ARGS");
});

test("finishSignIn polls once: pending until Cursor hands over the token, then connects", async () => {
  const grok = fakeGrokBot();
  const polls = [];
  const fetch = async (url, init) => {
    if (!url.startsWith("https://api2.cursor.sh/auth/poll")) return grok.fetch(url, init);
    polls.push(url);
    return polls.length < 3
      ? { status: 404, json: async () => ({}) }
      : { status: 200, json: async () => ({ accessToken: "cursor-token" }) };
  };
  const uuid = "123e4567-e89b-42d3-a456-426614174000";
  const verifier = "v".repeat(43);
  const service = createService(memoryStorage(), fetch);
  assert.deepEqual(await service.config({ type: "finishSignIn", uuid, verifier }), { pending: true });
  assert.deepEqual(await service.config({ type: "finishSignIn", uuid, verifier }), { pending: true });
  const settings = await service.config({ type: "finishSignIn", uuid, verifier });
  assert.equal(polls.length, 3);
  assert.equal(polls[0], `https://api2.cursor.sh/auth/poll?uuid=${uuid}&verifier=${verifier}`);
  assert.equal(settings.configured, true);
  await assert.rejects(
    createService(memoryStorage(), fetch).config({ type: "finishSignIn", uuid: "x", verifier }),
    /not started correctly/,
  );
});

test("agent/configured is false until signed in with a bot selected", async () => {
  const storage = memoryStorage();
  const grok = fakeGrokBot();
  const before = await createService(storage, grok.fetch).source({ category: "agent", item: "configured" });
  assert.equal(before.instances.length, 1);
  assert.equal(before.instances[0].properties.configured.boolean.value, false);
  await createService(storage, grok.fetch).config({ type: "connect", accessToken: "cursor-token" });
  const after = await createService(storage, grok.fetch).source({ category: "agent", item: "configured" });
  assert.equal(after.instances[0].properties.configured.boolean.value, true);
  assert.equal(after.instances[0].properties.name.shortText.text, "Ada");
});

test("agent/chats lists the account's bots by id and name", async () => {
  const service = await connected(fakeGrokBot());
  const chats = await service.source({ category: "agent", item: "chats" });
  assert.deepEqual(
    chats.instances.map((i) => [i.instanceId, i.properties.name.shortText.text]),
    [["g1", "Team"], ["a1", "Ada"]],
  );
  const noAuth = await createService(memoryStorage(), fakeGrokBot().fetch)
    .source({ category: "agent", item: "chats" })
    .catch((e) => e);
  assert.equal(safeError(noAuth).code, "AUTH_REQUIRED");
});

test("chat_id picks a bot by id or name; unknown names never send", async () => {
  const grok = fakeGrokBot();
  const service = await connected(grok);
  const sends = () => grok.calls.filter((c) => c.url.endsWith("/api/sendPrompt")).map((c) => c.body.agentId);
  assert.match((await service.action({ action: "send_to_agent", args: { message: "x", chat_id: "g1" } })).text, /Team/);
  await service.action({ action: "send_to_agent", args: { message: "x", chat_id: " team " } });
  await service.action({ action: "send_to_agent", args: { message: "x", chat_id: null } });
  assert.deepEqual(sends(), ["g1", "g1", "a1"]);
  const err = await service.action({ action: "send_to_agent", args: { message: "x", chat_id: "nobody" } }).catch((e) => e);
  assert.equal(safeError(err).code, "INVALID_ARGS");
  assert.equal(sends().length, 3);
});

test("read_grok_bot reads the bot named by chat_id, defaulting to the selected bot", async () => {
  const grok = fakeGrokBot();
  const service = await connected(grok);
  const tails = () => grok.calls.filter((c) => c.url.endsWith("/api/getAgentTranscriptTail")).map((c) => c.body.id);
  assert.match((await service.action({ action: "read_grok_bot", args: { chat_id: "Team" } })).text, /^Team: /);
  await service.action({ action: "read_grok_bot", args: {} });
  assert.deepEqual(tails(), ["g1", "a1"]);
  const err = await service.action({ action: "read_grok_bot", args: { chat_id: "nobody" } }).catch((e) => e);
  assert.equal(safeError(err).code, "INVALID_ARGS");
});

const CHATS = { category: "agent", item: "chats" };
const ids = (r) => r.instances.map((i) => i.instanceId);
const tick = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r)); };
const botsCache = (cache) => JSON.parse(cache.getItem("grokbot.bots.v1"));
/** A fetch that holds listAgents until released, then answers with `agents`. */
function gatedList(grok, agents) {
  let release;
  const gate = new Promise((r) => (release = r));
  const fetch = async (url, init) => {
    if (!url.endsWith("/api/listAgents")) return grok.fetch(url, init);
    await gate;
    return { ok: true, status: 200, text: async () => JSON.stringify({ agents }) };
  };
  return { fetch, release };
}

const MINUTE = 60 * 1000;
/** Runs fn with Date.now shifted forward by `ms`. */
async function later(ms, fn) {
  const realNow = Date.now;
  Date.now = () => realNow() + ms;
  try {
    return await fn();
  } finally {
    Date.now = realNow;
  }
}
const offline = async () => { throw new Error("offline"); };

async function connectedWithCache() {
  const storage = memoryStorage();
  const cache = memoryStorage();
  const grok = fakeGrokBot();
  await createService(storage, grok.fetch, cache).config({ type: "connect", accessToken: "cursor-token" });
  return { storage, cache, grok };
}

test("agent/chats serves a recent cached list without the network", async () => {
  const { storage, cache } = await connectedWithCache();
  let calls = 0;
  const service = createService(storage, async () => { calls++; throw new Error("no network"); }, cache);
  assert.deepEqual(ids(await later(4 * MINUTE, () => service.source(CHATS))), ["g1", "a1"]);
  assert.equal(calls, 0);
});

test("agent/chats relists when the cache is stale or missing, and caches the result", async () => {
  const { storage, cache, grok } = await connectedWithCache();
  const gated = gatedList(grok, [{ id: "n1", name: "New" }]);
  gated.release();
  const service = createService(storage, gated.fetch, cache);
  assert.deepEqual(ids(await later(6 * MINUTE, () => service.source(CHATS))), ["n1"]);
  assert.deepEqual(botsCache(cache).bots.map((b) => b.id), ["n1"]);

  cache.removeItem("grokbot.bots.v1");
  assert.deepEqual(ids(await createService(storage, grok.fetch, cache).source(CHATS)), ["g1", "a1"]);
  assert.ok(botsCache(cache));
});

test("agent/chats falls back to a stale cache when relisting fails, and errors with none", async () => {
  const { storage, cache } = await connectedWithCache();
  const service = createService(storage, offline, cache);
  assert.deepEqual(ids(await later(60 * MINUTE, () => service.source(CHATS))), ["g1", "a1"]);
  cache.removeItem("grokbot.bots.v1");
  const err = await service.source(CHATS).catch((e) => e);
  assert.equal(safeError(err).code, "PLUGIN_UNAVAILABLE");
});

test("a failing bot cache never changes a send receipt or a source read", async () => {
  const storage = memoryStorage();
  const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); } };
  const grok = fakeGrokBot();
  const service = createService(storage, grok.fetch, broken);
  await service.config({ type: "connect", accessToken: "cursor-token" });
  const sent = await service.action({ action: "send_to_agent", args: { message: "x", chat_id: "Team" } });
  assert.match(sent.text, /^Message sent to Team/);
  assert.deepEqual(ids(await service.source(CHATS)), ["g1", "a1"]);
  await service.config({ type: "disconnect" });
});

test("a listing for a sign-in replaced in another session is not cached", async () => {
  const { storage, cache, grok } = await connectedWithCache();
  // Session A keeps its startup snapshot of the connection; `persisted` reads what's stored now.
  const snapshot = storage.getItem("grokbot.connection.v1");
  const sessionA = { getItem: () => snapshot, setItem() {}, removeItem() {}, persisted: async (k) => storage.getItem(k) };
  const listA = gatedList(grok, [{ id: "old", name: "Old account" }]);
  const pending = later(6 * MINUTE, () => createService(sessionA, listA.fetch, cache).source(CHATS));

  // Session B disconnects and signs in again before A's listing lands.
  const sessionB = createService(storage, grok.fetch, cache);
  await sessionB.config({ type: "disconnect" });
  assert.equal(cache.getItem("grokbot.bots.v1"), null);
  await sessionB.config({ type: "connect", accessToken: "cursor-token" });
  listA.release();
  assert.deepEqual(ids(await pending), ["old"]);
  assert.deepEqual(botsCache(cache).bots.map((b) => b.id), ["g1", "a1"]);
  assert.deepEqual(ids(await createService(storage, offline, cache).source(CHATS)), ["g1", "a1"]);
});

test("an older listing finishing last does not overwrite a newer one", async () => {
  const { storage, cache, grok } = await connectedWithCache();
  const realNow = Date.now;
  let clock = realNow() + 10 * MINUTE;
  Date.now = () => ++clock;
  try {
    const older = gatedList(grok, [{ id: "older", name: "Older" }]);
    const newer = gatedList(grok, [{ id: "newer", name: "Newer" }]);
    const a = createService(storage, older.fetch, cache).source(CHATS);
    await tick();
    const b = createService(storage, newer.fetch, cache).source(CHATS);
    await tick();
    newer.release();
    await b;
    older.release();
    await a;
  } finally {
    Date.now = realNow;
  }
  assert.deepEqual(botsCache(cache).bots.map((b) => b.id), ["newer"]);
});

test("through the Pebble wrapper, sends and source reads never write credentials", async () => {
  const vm = require("node:vm");
  const { readFileSync } = require("node:fs");
  const grok = fakeGrokBot();
  const secure = new Map();
  let failWrites = false;
  const handlers = {};
  const Pebble = {
    secureStorage: {
      getItem: async (k) => secure.get(k) ?? null,
      setItem: async (k, v) => { if (failWrites) throw new Error("keystore"); secure.set(k, v); },
      removeItem: async (k) => secure.delete(k),
    },
    registerActionHandler: (fn) => (handlers.action = fn),
    registerSourceHandler: (fn) => (handlers.source = fn),
    registerConfigHandler: (fn) => (handlers.config = fn),
  };
  const local = memoryStorage();
  vm.runInNewContext(readFileSync(require.resolve("../src/plugin/index.js"), "utf8"),
    { Pebble, fetch: grok.fetch, localStorage: local, Date, Math, JSON, Promise, Map, encodeURIComponent });
  await new Promise((resolve) => handlers.config({ type: "connect", accessToken: "cursor-token" }, resolve));

  failWrites = true;
  const sent = await new Promise((resolve) => handlers.action({ action: "send_to_agent", args: { message: "x", chat_id: "g1" } },
    { ok: (r) => resolve(r), error: (code, message) => resolve({ code, message }) }));
  assert.match(sent.text, /^Message sent to Team/);
  const chats = await new Promise((resolve) => handlers.source(CHATS, { data: resolve, error: (code, message) => resolve({ code, message }) }));
  assert.deepEqual(ids(chats), ["g1", "a1"]);
  await tick();
  assert.ok(botsCache(local));
});

test("nicknames route sends, name agent/chats and agent/configured, and move between bots", async () => {
  const grok = fakeGrokBot();
  const service = await connected(grok);
  const sends = () => grok.calls.filter((c) => c.url.endsWith("/api/sendPrompt")).map((c) => c.body.agentId);
  const saved = await service.config({ type: "saveNickname", id: "g1", nickname: " Work " });
  assert.equal(saved.bots.find((b) => b.id === "g1").nickname, "Work");
  await service.action({ action: "send_to_agent", args: { message: "x", chat_id: "WORK" } });
  await service.action({ action: "send_to_agent", args: { message: "x", chat_id: "wor" } });
  assert.deepEqual(sends(), ["g1", "g1"]);
  const chats = await service.source({ category: "agent", item: "chats" });
  assert.deepEqual(chats.instances.map((i) => i.properties.name.shortText.text), ["Work", "Ada"]);

  await service.config({ type: "saveNickname", id: "a1", nickname: "work" });
  await service.config({ type: "selectBot", id: "a1" });
  const configured = await service.source({ category: "agent", item: "configured" });
  assert.equal(configured.instances[0].properties.name.shortText.text, "work");
  await service.action({ action: "send_to_agent", args: { message: "x", chat_id: "work" } });
  assert.deepEqual(sends(), ["g1", "g1", "a1"]);
  const cleared = await service.config({ type: "saveNickname", id: "a1", nickname: "" });
  assert.equal(cleared.defaultName, "Ada");
});

test("exact id beats nickname, nickname beats name, and ambiguous partials never send", async () => {
  const grok = fakeGrokBot();
  const service = await connected(grok);
  const sends = () => grok.calls.filter((c) => c.url.endsWith("/api/sendPrompt")).map((c) => c.body.agentId);
  await service.config({ type: "saveNickname", id: "a1", nickname: "Teamwork" });
  await service.action({ action: "send_to_agent", args: { message: "x", chat_id: "teamwork" } });
  await service.action({ action: "send_to_agent", args: { message: "x", chat_id: "team" } });
  assert.deepEqual(sends(), ["a1", "g1"]);
  await service.config({ type: "saveNickname", id: "a1", nickname: "pal" });
  await service.config({ type: "saveNickname", id: "g1", nickname: "palace" });
  const err = await service.action({ action: "send_to_agent", args: { message: "x", chat_id: "pa" } }).catch((e) => e);
  assert.equal(safeError(err).code, "INVALID_ARGS");
  assert.equal(sends().length, 2);
});

test("nicknames that are another bot's id or name, or too long, are refused; they survive sign-in again", async () => {
  const storage = memoryStorage();
  const grok = fakeGrokBot();
  const service = createService(storage, grok.fetch);
  await service.config({ type: "connect", accessToken: "cursor-token" });
  for (const nickname of ["Team", "g1", "x".repeat(41)]) {
    const err = await service.config({ type: "saveNickname", id: "a1", nickname }).catch((e) => e);
    assert.equal(safeError(err).code, "INVALID_ARGS", nickname);
  }
  assert.equal((await service.config({ type: "saveNickname", id: "a1", nickname: "Ada" })).bots[1].nickname, "Ada");
  const missing = await service.config({ type: "saveNickname", id: "zz", nickname: "x" }).catch((e) => e);
  assert.equal(safeError(missing).code, "INVALID_ARGS");
  const again = await service.config({ type: "connect", accessToken: "cursor-token" });
  assert.equal(again.bots[1].nickname, "Ada");
});

const jwt = (sub) => "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify({ sub, exp: 1 })).toString("base64url") + ".sig";

test("a nickname that another bot was later renamed to is refused as ambiguous, without sending", async () => {
  let agents = [{ id: "g1", name: "Team", memberIds: ["a1"] }, { id: "a1", name: "Ada" }];
  const grok = fakeGrokBot();
  const fetch = async (url, init) => url.endsWith("/api/listAgents")
    ? { ok: true, status: 200, text: async () => JSON.stringify({ agents }) }
    : grok.fetch(url, init);
  const storage = memoryStorage();
  const service = createService(storage, fetch);
  await service.config({ type: "connect", accessToken: "cursor-token" });
  await service.config({ type: "saveNickname", id: "a1", nickname: "work" });
  agents = [{ id: "g1", name: "Work", memberIds: ["a1"] }, { id: "a1", name: "Ada" }];
  for (const action of ["send_to_agent", "read_grok_bot"]) {
    const err = await service.action({ action, args: { message: "x", chat_id: "work" } }).catch((e) => e);
    assert.equal(safeError(err).code, "INVALID_ARGS", action);
    assert.match(safeError(err).message, /both a nickname and another bot/);
  }
  assert.ok(!grok.calls.some((c) => c.url.endsWith("/api/sendPrompt")));
  // A nickname for a bot that's gone is ignored: the name resolves to the bot that has it.
  agents = [{ id: "g1", name: "Work", memberIds: ["a1"] }];
  await service.action({ action: "send_to_agent", args: { message: "x", chat_id: "work" } });
  assert.equal(grok.calls.filter((c) => c.url.endsWith("/api/sendPrompt"))[0].body.agentId, "g1");
});

test("signing in again as the same account keeps the default and nicknames", async () => {
  const service = createService(memoryStorage(), fakeGrokBot().fetch);
  await service.config({ type: "connect", accessToken: jwt("user_1") });
  await service.config({ type: "saveNickname", id: "a1", nickname: "lab" });
  await service.config({ type: "selectBot", id: "g1" });
  const again = await service.config({ type: "connect", accessToken: jwt("user_1") });
  assert.equal(again.selected, "g1");
  assert.equal(again.bots.find((b) => b.id === "a1").nickname, "lab");
});

test("signing in as another account with the same bot ids doesn't reuse nicknames or the default", async () => {
  const service = createService(memoryStorage(), fakeGrokBot().fetch);
  await service.config({ type: "connect", accessToken: jwt("user_1") });
  await service.config({ type: "saveNickname", id: "a1", nickname: "lab" });
  await service.config({ type: "selectBot", id: "g1" });
  const other = await service.config({ type: "connect", accessToken: jwt("user_2") });
  assert.equal(other.selected, "a1");
  assert.ok(other.bots.every((b) => b.nickname === ""));
  const err = await service.action({ action: "send_to_agent", args: { message: "x", chat_id: "lab" } }).catch((e) => e);
  assert.equal(safeError(err).code, "INVALID_ARGS");
});

test("untagged nicknames are adopted by the account that signs in", async () => {
  const storage = memoryStorage();
  storage.setItem("grokbot.connection.v1", JSON.stringify({ accessToken: "cursor-token", botId: "g1", nicknames: { a1: "lab" } }));
  const again = await createService(storage, fakeGrokBot().fetch).config({ type: "connect", accessToken: jwt("user_1") });
  assert.equal(again.selected, "g1");
  assert.equal(again.bots.find((b) => b.id === "a1").nickname, "lab");
});

const permissions = (states) => ({ query: async (key) => states[key] ?? "granted" });

test("reach: with Pebble.permissions, the first domain not granted is named for sure, without any request", async () => {
  const { blockedHost } = require("../src/plugin/index.js");
  const request = () => { throw new Error("no request expected"); };
  assert.equal(await blockedHost(request, permissions({})), null);
  assert.deepEqual(await blockedHost(request, permissions({ "Internet/cursorvm.com": "denied" })), { host: "cursorvm.com", sure: true });
  assert.deepEqual(await blockedHost(request, permissions({ "Internet/cursor.sh": "prompt", "Internet/cursorvm.com": "denied" })), { host: "cursor.sh", sure: true });
});

test("reach: without it, first failure wins as a guess, a stalled probe does not block, the last check is remembered", async () => {
  const { blockedHost, checkReach, lastBlocked, PROBES } = require("../src/plugin/index.js");
  assert.equal(await blockedHost(async () => ({ status: 404 }), null), null);
  assert.deepEqual(await blockedHost(() => Promise.reject(new TypeError("blocked")), null), { host: "cursor.sh", sure: false });
  PROBES.push(["stalled.example", "https://stalled.example/"]);
  try {
    assert.equal((await blockedHost((url) => url.includes("stalled") ? new Promise(() => {}) : Promise.reject(new TypeError("blocked")), null)).host, "cursor.sh");
  } finally {
    PROBES.pop();
  }
  const storage = memoryStorage();
  await checkReach(storage, () => Promise.reject(new TypeError("blocked")));
  assert.deepEqual(lastBlocked(storage), { host: "cursor.sh", sure: false });
  await checkReach(storage, async () => ({ status: 200 }));
  assert.equal(lastBlocked(storage), null);
  storage.setItem("grok-bot.blocked.v1", "cursor.sh");
  assert.equal(lastBlocked(storage), null);
});

test("reach: an unreachable action names the blocked domain, keeping any uncertainty warning", async () => {
  const { withBlockedHost } = require("../src/plugin/index.js");
  const storage = memoryStorage();
  const guess = JSON.stringify({ host: "cursor.sh", sure: false });
  storage.setItem("grok-bot.blocked.v1", guess);
  const message = 'Grok Bot doesn\'t have permission to connect to cursor.sh. Turn on "Connect to cursor.sh" in Grok Bot\'s Permissions, or check your internet connection.';
  const network = new TypeError("fetch failed");
  assert.equal(withBlockedHost(network, safeError(network), storage, async () => ({ status: 200 })).message, message);
  await tick();
  assert.equal(storage.getItem("grok-bot.blocked.v1"), null);
  storage.setItem("grok-bot.blocked.v1", guess);
  const service = await connected(fakeGrokBot({ onSend() { throw new TypeError("dropped"); } }));
  const err = await service.action({ action: "send_to_agent", args: { message: "x", chat_id: "g1" } }).catch((e) => e);
  assert.equal(withBlockedHost(err, safeError(err), storage, () => new Promise(() => {})).message, message + " Grok Bot delivery is uncertain. Check Grok Bot before sending again.");
  assert.equal(withBlockedHost(Object.assign(err, { unreachable: false }), safeError(err), storage, () => {}).message, safeError(err).message);
});

test("reach: a request refused as not allowed names its declared domain for sure, with no cached check", async () => {
  const { withBlockedHost } = require("../src/plugin/index.js");
  const notAllowed = (url) => Object.assign(new Error("fetch not allowed: " + url), { name: "NotAllowedError" });
  const sure = (host) => 'Grok Bot doesn\'t have permission to connect to ' + host + '. Turn on "Connect to ' + host + '" in Grok Bot\'s Permissions.';
  const refused = notAllowed("https://api2.cursor.sh/aiserver.v1.GrokBotService/EnsureSandBox");
  assert.equal(withBlockedHost(refused, safeError(refused), memoryStorage(), async () => ({ status: 200 })).message, sure("cursor.sh"));
  const service = await connected(fakeGrokBot({ onSend() { throw notAllowed(BOX + "/api/sendPrompt"); } }));
  const err = await service.action({ action: "send_to_agent", args: { message: "x", chat_id: "g1" } }).catch((e) => e);
  assert.equal(withBlockedHost(err, safeError(err), memoryStorage(), () => new Promise(() => {})).message,
    sure("cursorvm.com") + " Grok Bot delivery is uncertain. Check Grok Bot before sending again.");
});
