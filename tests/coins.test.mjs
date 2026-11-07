import test from 'node:test';
import assert from 'node:assert/strict';
import '../coins.js';
const { convert, summarize } = globalThis.PocoCoins;

test('reference coin requirements include the small and large cheer levels', () => {
  for (const [level, coins] of [[0.01,1],[0.05,5],[0.1,10],[0.5,50],[1,100],[2,200],[3,400],[10,3000],[11,4000],[15,10000],[25,30000],[30,50000],[40,100000],[42,125000],[44,150000],[46,200000],[48,250000]]) {
    assert.equal(convert(String(level)).coins, coins, `${level}K`);
  }
});
test('convert account/liver cells before summing nonlinear requirements', () => {
  assert.equal(summarize(['10', '10']).coins, 6000);
  assert.equal(convert('20').coins, 20000);
  const rows = [['10', '2'], ['1', '11']];
  const liverTotals = rows.map(summarize);
  const accountTotals = [0, 1].map(j => summarize(rows.map(r => r[j])));
  assert.deepEqual(liverTotals.map(r => r.coins), [3200, 4100]);
  assert.deepEqual(accountTotals.map(r => r.coins), [3100, 4200]);
  assert.equal(summarize(rows.flat()).coins, 7300);
});
test('checks and blanks are excluded; zero remains a known value', () => {
  assert.deepEqual(summarize(['○', '〇', '◯', '', ' ', '0', '10']), {coins:3000, unknown:0});
  assert.equal(convert('0').status, 'known');
  assert.equal(convert('').status, 'blank');
});
test('unlisted, invalid and out-of-range values are never silently estimated', () => {
  for (const level of ['1.5', '31', '49', '-1', 'Infinity', '1e1', 'メモ']) assert.equal(convert(level).coins, null);
  assert.deepEqual(summarize(['10', '1.5', '49', '○']), {coins:3000, unknown:2});
});

test('viewing time uses documented condition 1 levels without extrapolation',()=>{
 assert.equal(PocoCoins.viewingMinutes(0.1),90);
 assert.equal(PocoCoins.viewingMinutes(1),180);
 assert.equal(PocoCoins.viewingMinutes(15),570);
 assert.equal(PocoCoins.viewingMinutes(35),1350);
 assert.equal(PocoCoins.viewingMinutes(40),1500);
 for(const unknown of [0,2,48])assert.equal(PocoCoins.viewingMinutes(unknown),null);
});
