import test from 'node:test';
import assert from 'node:assert/strict';
import '../rows.js';
const { closingKey, releaseKey, formatRelease, sortRows, moveRow } = globalThis.PocoRows;

test('closing times use chronological order and validate inputs', () => {
  assert.equal(closingKey('0時'), 0); assert.equal(closingKey('１３時'), 780);
  assert.equal(closingKey('22:30'), 1350); assert.equal(closingKey('13時15分'), 795);
  for (const value of ['', '未定', '25時', '13:70']) assert.equal(closingKey(value), null);
});
test('release dates handle times, tentative labels and invalid calendar dates', () => {
  assert.equal(releaseKey('11/6 0:00(仮)', '2026-11'), releaseKey('2026/11/6 0:00', '2026-11'));
  assert.equal(releaseKey('11/3 0:00', '2026-11'), releaseKey('11/3 12:00', '2026-11'));
  assert.equal(formatRelease('11/6 0:00(仮)','2026-11'),'6日(仮)');
  assert.equal(formatRelease('３','2026-11'),'3日');
  assert.equal(formatRelease('未定','2026-11'),'未定');
  assert.equal(releaseKey('31日','2026-11'),null);
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
  assert.deepEqual(sortRows(rows,'releaseDate',1,'2026-11').map(r=>r.name),['B','C','A','D']);
  assert.deepEqual(sortRows(rows,'releaseDate',-1,'2026-11').map(r=>r.name),['B','C','A','D']);
  assert.deepEqual(rows,before); assert.equal(sortRows(rows,'closingTime',1,'2026-11')[1],rows[0]);
});
test('moving a row in either direction keeps the whole record intact', () => {
  const rows = [{name:'A',values:['10'],releaseDate:'11/3 0:00'}, {name:'B'}, {name:'C'}];
  assert.deepEqual(moveRow(rows,0,2).map(r=>r.name),['B','C','A']);
  assert.deepEqual(moveRow(rows,2,0).map(r=>r.name),['C','A','B']);
  assert.equal(moveRow(rows,0,2)[2],rows[0]); assert.deepEqual(rows.map(r=>r.name),['A','B','C']);
});

test('old tables gain missing accounts once without changing values, notes or schedules',()=>{
 const table={columns:['ヨシ','その他'],rows:[{name:'A',memo:'記録',values:['10','48'],schedule:{'2026-11-03':'配信'}}],accountDetails:[{memo:'ヨシメモ',schedule:{}},{memo:'その他メモ',schedule:{}}]};
 const book={months:{'2026-11':table}};const original=structuredClone(table);
 assert.equal(PocoRows.addExtraAccounts(book),true);
 assert.deepEqual(table.columns,['ヨシ','海斗','レオ','その他']);assert.deepEqual(table.rows[0].values,['10','','','48']);
 assert.deepEqual(table.accountDetails[3],original.accountDetails[1]);assert.deepEqual(table.rows[0].schedule,original.rows[0].schedule);assert.equal(table.rows[0].memo,'記録');
 assert.equal(PocoRows.addExtraAccounts(book),false);table.columns.splice(1,1);table.rows[0].values.splice(1,1);table.accountDetails.splice(1,1);
 assert.equal(PocoRows.addExtraAccounts(book),false);assert.equal(table.columns.includes('海斗'),false);
 const partial={months:{'2026-11':{columns:['ヨシ','海斗'],rows:[{values:['1','2']}]}}};PocoRows.addExtraAccounts(partial);assert.deepEqual(partial.months['2026-11'].rows[0].values,['1','2','']);
});

test('account migration keeps pair actuals aligned and never assigns old results to new accounts',()=>{
 const first={cheerK:3,memo:'ヨシ'},last={cheerK:4,memo:'別'};const table={columns:['ヨシ','別'],rows:[{values:['1','2'],pairActuals:[first,last]}]};const book={months:{'2026-11':table}};
 PocoRows.addExtraAccounts(book);assert.deepEqual(table.columns,['ヨシ','海斗','レオ','別']);assert.deepEqual(table.rows[0].values,['1','','','2']);assert.deepEqual(table.rows[0].pairActuals,[first,null,null,last]);
});

test('release categories use the record month, handle tentative days and skip unknown dates',()=>{
 const {releaseState}=PocoRows;
 assert.equal(releaseState('2日','2026-11','2026-11-03'),'after');assert.equal(releaseState('3日(仮)','2026-11','2026-11-03'),'today');assert.equal(releaseState('4日','2026-11','2026-11-03'),'before');
 assert.equal(releaseState('31日','2026-10','2026-11-03'),'after');assert.equal(releaseState('1日','2026-12','2026-11-03'),'before');
 for(const value of ['','未定','31日'])assert.equal(releaseState(value,'2026-11','2026-11-03'),null);
});
test('achievement requires every positive numeric account goal and never substitutes legacy totals',()=>{
 const {achievementState}=PocoRows;
 assert.deepEqual(achievementState({values:['2','5','〇','0'],pairActuals:[{cheerK:2},{cheerK:5},null,null]}),{state:'met',targets:2,completed:2});
 assert.deepEqual(achievementState({values:['2','5'],pairActuals:[{cheerK:20},null],actuals:{'2026-11-03':{cheerK:100}}}),{state:'unmet',targets:2,completed:1});
 assert.equal(achievementState({values:['〇','','0','-1','Infinity']}).state,null);assert.equal(achievementState({values:['0.5'],pairActuals:[{cheerK:0.5}]}).state,'met');assert.equal(achievementState({values:['1'],pairActuals:[{cheerK:0}]}).state,'unmet');
});
