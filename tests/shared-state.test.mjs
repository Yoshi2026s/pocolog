import test from 'node:test';
import assert from 'node:assert/strict';
import { SharedState } from '../shared-state.mjs';

test('two editors cannot silently overwrite each other', async () => {
  let record = { revision: 1, payload: 'original' };
  const commit = async (expected, payload) => {
    if (record.revision !== expected) throw Error('conflict');
    record = { revision: expected + 1, payload }; return record.revision;
  };
  const a = new SharedState(), b = new SharedState();
  a.receive(record); b.receive(record); a.edit(); b.edit();
  await a.save('A', commit);
  assert.equal(b.receive(record), false);
  await assert.rejects(b.save('B', commit), /conflict/);
  assert.equal(record.payload, 'A'); assert.equal(b.dirty, true);
  b.accept(); assert.equal(b.revision, 2);
});
test('edits during a pending save remain dirty', async () => {
  const s = new SharedState(); s.edit();
  let finish;
  const saved = s.save('first', () => new Promise(resolve => { finish = resolve; }));
  s.edit(); finish(1);
  assert.equal(await saved, false); assert.equal(s.dirty, true); assert.equal(s.revision, 1);
});
test('failure preserves local edits and revision for retry', async () => {
  const s = new SharedState(); s.receive({ revision: 3 }); s.edit();
  await assert.rejects(s.save('input', async () => { throw Error('offline'); }));
  assert.equal(s.dirty, true); assert.equal(s.revision, 3);
  assert.equal(await s.save('input', async expected => expected + 1), true);
  assert.equal(s.revision, 4);
});
