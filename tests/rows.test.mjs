import test from 'node:test';
import assert from 'node:assert/strict';
import '../rows.js';
const { closingKey, releaseKey, sortRows, moveRow } = globalThis.PocoRows;

test('closing times use chronological order and validate inputs', () => {
  assert.equal(closingKey('0時'), 0); assert.equal(closingKey('１３時'), 780);
  assert.equal(closingKey('22:30'), 1350); assert.equal(closingKey('13時15分'), 795);
  for (const value of ['', '未定', '25時', '13:70']) assert.equal(closingKey(value), null);
});
test('release dates handle times, tentative labels and invalid calendar dates', () => {
  assert.equal(releaseKey('11/6 0:00(仮)', '2026-11'), releaseKey('2026/11/6 0:00', '2026-11'));
  assert.ok(releaseKey('11/3 0:00', '2026-11') < releaseKey('11/3 12:00', '2026-11'));
  assert.equal(releaseKey('2/29 0:00', '2026-02'), null);
  assert.notEqual(releaseKey('2/29 0:00', '2028-02'), null);
  for (const value of ['', '未定', '11/31 0:00', '11/1 25:00']) assert.equal(releaseKey(value, '2026-11'), null);
});
test('sorts remain stable, put unset dates last in both directions, and preserve row data', () => {
  const rows = [
    { name:'A',closingTime:'13時',releaseDate:'未定',values:['10'],memo:'メモ' },
    { name:'B',closingTime:'0時',releaseDate:'11/3 12:00',values:['2'] },
    { name:'C',closingTime:'13時',releaseDate:'11/3 0:00',values:['○'] },
    { name:'D',closingTime:'',releaseDate:'',values:['48'] }
  ];
  const before = structuredClone(rows);
  assert.deepEqual(sortRows(rows,'closingTime',1,'2026-11').map(r=>r.name),['B','A','C','D']);
  assert.deepEqual(sortRows(rows,'closingTime',-1,'2026-11').map(r=>r.name),['A','C','B','D']);
  assert.deepEqual(sortRows(rows,'releaseDate',1,'2026-11').map(r=>r.name),['C','B','A','D']);
  assert.deepEqual(sortRows(rows,'releaseDate',-1,'2026-11').map(r=>r.name),['B','C','A','D']);
  assert.deepEqual(rows,before); assert.equal(sortRows(rows,'closingTime',1,'2026-11')[1],rows[0]);
});
test('moving a row in either direction keeps the whole record intact', () => {
  const rows = [{name:'A',values:['10'],releaseDate:'11/3 0:00'}, {name:'B'}, {name:'C'}];
  assert.deepEqual(moveRow(rows,0,2).map(r=>r.name),['B','C','A']);
  assert.deepEqual(moveRow(rows,2,0).map(r=>r.name),['C','A','B']);
  assert.equal(moveRow(rows,0,2)[2],rows[0]); assert.deepEqual(rows.map(r=>r.name),['A','B','C']);
});
