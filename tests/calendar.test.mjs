import test from 'node:test';
import assert from 'node:assert/strict';
import '../calendar.js';
const { monthInfo, dates, validSchedule, validAccounts, accountDetails, setDay } = globalThis.PocoCalendar;

test('calendar handles weekday alignment, leap years and month lengths', () => {
  assert.equal(monthInfo('2026-11').weekday, 0);
  assert.equal(dates('2026-11').length, 30);
  assert.equal(dates('2026-12').at(-1).date, '2026-12-31');
  assert.equal(dates('2028-02').length, 29);
  assert.equal(dates('2026-02').length, 28);
  assert.deepEqual(dates('2026-13'), []);
});
test('schedule validation preserves legacy records and rejects invalid or cross-month dates', () => {
  assert.equal(validSchedule(undefined, '2026-11'), true);
  assert.equal(validSchedule({ '2026-11-03': '10:00〜12:00\n20:00〜22:00' }, '2026-11'), true);
  for (const value of [null, [], {'2026-11-31':'予定'}, {'2026-12-01':'予定'}, {'2026-11-01':42}]) assert.equal(validSchedule(value, '2026-11'), false);
});
test('accounts have isolated notes and schedules and metadata follows the account on removal', () => {
  const table = { columns: ['こじ','こた'] };
  accountDetails(table, 0); assert.equal(table.accountDetails, undefined);
  const first = accountDetails(table, 0, true), second = accountDetails(table, 1, true);
  first.memo = 'メモ'; setDay(first, '2026-11-02', '13:00');
  assert.equal(second.memo, ''); assert.deepEqual(second.schedule, {});
  table.columns[0] = 'こじ改'; assert.equal(accountDetails(table, 0).memo, 'メモ');
  table.columns.splice(0,1); table.accountDetails.splice(0,1);
  assert.equal(accountDetails(table,0), second); assert.equal(validAccounts(table,'2026-11'), true);
  table.accountDetails.push(first); assert.equal(validAccounts(table,'2026-11'), false);
});
test('clearing a day removes only that entry and JSON backups retain schedules', () => {
  const row = { memo:'既存メモ', schedule:{} };
  setDay(row, '2026-11-01', '朝'); setDay(row, '2026-11-02', '夜');
  setDay(row, '2026-11-01', '');
  const restored = JSON.parse(JSON.stringify(row));
  assert.deepEqual(restored, {memo:'既存メモ',schedule:{'2026-11-02':'夜'}});
});

test('daily earned records validate dates, bounds and legacy missing fields',()=>{
 const {validActuals}=PocoCalendar;
 const value={earnedDay:true,minutes:125,cheerK:10.5};
 assert.equal(validActuals(undefined,'2026-11'),true);
 assert.equal(validActuals({'2026-11-03':value},'2026-11'),true);
 for(const date of ['2026-11-31','2026-12-03','2026-11-3'])assert.equal(validActuals({[date]:value},'2026-11'),false);
 for(const bad of [{...value,minutes:1441},{...value,minutes:-1},{...value,minutes:1.5},{...value,cheerK:-1},{...value,cheerK:Infinity},{...value,earnedDay:1},{...value,extra:1}])assert.equal(validActuals({'2026-11-03':bad},'2026-11'),false);
});
test('earned days are counted once and edits replace values, distinguishing blanks and zero',()=>{
 const {setActual,actualTotals}=PocoCalendar;const row={memo:'保持',schedule:{'2026-11-03':'予定'}};
 setActual(row,'2026-11-03',{earnedDay:true,minutes:90,cheerK:10},'2026-11');
 setActual(row,'2026-11-03',{earnedDay:true,minutes:125,cheerK:12},'2026-11');
 setActual(row,'2026-11-04',{earnedDay:true,minutes:null,cheerK:null},'2026-11');
 setActual(row,'2026-11-05',{earnedDay:false,minutes:0,cheerK:0},'2026-11');
 assert.deepEqual(actualTotals(row),{days:2,minutes:125,cheerK:12,records:3,timeRecords:2,cheerRecords:2});
 setActual(row,'2026-11-03',{earnedDay:false,minutes:null,cheerK:null},'2026-11');
 assert.equal(actualTotals(row).days,1);assert.equal(actualTotals(row).minutes,0);assert.equal(row.memo,'保持');assert.equal(row.schedule['2026-11-03'],'予定');
 assert.deepEqual(JSON.parse(JSON.stringify(row)).actuals,row.actuals);
});
