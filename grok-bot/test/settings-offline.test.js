const test = require('node:test');
const assert = require('node:assert/strict');
const { createService } = require('../src/plugin/index.js');
function storage() {
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
}
test('saved bot list supports settings after reopening while Cursor is unreachable', async () => {
  const secure = storage(), cache = storage();
  const fetch = async url => ({ ok: true, text: async () => JSON.stringify(url.endsWith('EnsureSandBox')
    ? { gatewayUrl: 'https://test.cursorvm.com', gatewayToken: 'box' }
    : { agents: [{ id: 'a', name: 'First' }, { id: 'b', name: 'Second' }] }) });
  await createService(secure, fetch, cache).config({ type: 'connect', accessToken: 'token' });
  const reopened = createService(secure, async () => { throw new Error('Socket timeout'); }, cache);
  assert.equal((await reopened.config({ type: 'status' })).bots.length, 2);
  assert.equal((await reopened.config({ type: 'selectBot', id: 'b' })).selected, 'b');
  await reopened.config({ type: 'saveNickname', id: 'b', nickname: 'Buddy' });
  assert.equal((await reopened.config({ type: 'status' })).bots.find(b => b.id === 'b').nickname, 'Buddy');
  await assert.rejects(reopened.config({ type: 'listBots' }), /Socket timeout/);
  assert.equal((await reopened.config({ type: 'status' })).selected, 'b');
  await reopened.config({ type: 'disconnect' });
  assert.equal((await reopened.config({ type: 'status' })).configured, false);
});
