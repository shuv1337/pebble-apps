const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
test('a stalled refresh rejects so the page can release its controls, and a later refresh succeeds', async () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/config.html'), 'utf8');
  const source = html.match(/      async function send\(message\) \{[\s\S]*?\n      \}/)[0];
  let expire, reply, cleared = 0;
  const context = vm.createContext({
    Pebble: { sendMessage: () => new Promise(resolve => { reply = resolve; }) },
    setTimeout: (callback, delay) => { assert.equal(delay, 20000); expire = callback; return 1; },
    clearTimeout: () => { cleared++; },
  });
  vm.runInContext(source + '; globalThis.send = send;', context);
  const pending = context.send({ type: 'listBots' });
  expire();
  await assert.rejects(pending, /too long/);
  reply({ bots: [] });
  const next = context.send({ type: 'listBots' });
  reply({ bots: [{ id: 'new' }] });
  assert.equal((await next).bots[0].id, 'new');
  assert.equal(cleared, 2);
});
