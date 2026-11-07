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

test('viewing duration calculates same-day and overnight times and rejects invalid inputs',()=>{
 const {viewingDuration}=PocoCalendar;
 assert.equal(viewingDuration('09:00','10:15'),75);
 assert.equal(viewingDuration('23:30','01:15'),105);
 assert.equal(viewingDuration('23:00','00:00'),60);
 for(const pair of [['09:00','09:00'],['25:00','01:00'],['09:00',''],['09:61','10:00']])assert.throws(()=>viewingDuration(...pair));
});
test('time additions preserve cheers and dates, count once, floor subtraction and fail atomically',()=>{
 const {addActualMinutes,actualTotals}=PocoCalendar;
 const before={'2026-11-03':{earnedDay:true,minutes:30,cheerK:10},'2026-11-04':{earnedDay:true,minutes:1400,cheerK:2}};const snapshot=structuredClone(before);
 assert.throws(()=>addActualMinutes(before,{'2026-11-03':15,'2026-11-04':60},'2026-11'));
 assert.deepEqual(before,snapshot);
 const next=addActualMinutes(before,{'2026-11-03':60},'2026-11');assert.equal(next['2026-11-03'].minutes,90);assert.equal(next['2026-11-03'].cheerK,10);assert.equal(actualTotals({actuals:next}).days,2);
 assert.equal(addActualMinutes(before,{'2026-11-03':-60},'2026-11')['2026-11-03'].minutes,0);
 assert.throws(()=>addActualMinutes(before,{'2026-12-01':10},'2026-11'));
});

test('bulk time entry filters weekdays, protects zero, and preserves cheers',()=>{
 const before={'2026-11-02':{earnedDay:true,minutes:0,cheerK:3},'2026-11-03':{earnedDay:true,minutes:60,cheerK:4},'2026-11-04':{earnedDay:true,minutes:null,cheerK:5}};
 const options={from:1,to:7,weekdays:[1,2,3,4,5],minutes:30,countDay:true,mode:'missing'};
 const result=PocoCalendar.bulkActuals(before,'2026-11',options);
 assert.deepEqual(result.applied,['2026-11-04','2026-11-05','2026-11-06']);assert.deepEqual(result.skipped,['2026-11-02','2026-11-03']);assert.equal(result.next['2026-11-02'].minutes,0);assert.equal(result.next['2026-11-04'].cheerK,5);assert.equal(result.next['2026-11-04'].minutes,30);assert.equal(before['2026-11-04'].minutes,null);
 assert.equal(PocoCalendar.bulkActuals(before,'2026-11',{...options,mode:'add'}).next['2026-11-03'].minutes,90);
 assert.equal(PocoCalendar.bulkActuals(before,'2026-11',{...options,mode:'replace'}).next['2026-11-03'].minutes,30);
 const days=PocoCalendar.bulkActuals(before,'2026-11',{...options,minutes:null,mode:'add'});assert.equal(days.next['2026-11-04'].minutes,null);assert.equal(days.next['2026-11-04'].earnedDay,true);
 const timeOnly=PocoCalendar.bulkActuals({},'2026-11',{...options,countDay:false});assert.equal(timeOnly.next['2026-11-02'].earnedDay,false);assert.equal(timeOnly.next['2026-11-02'].minutes,30);
});
test('bulk entry validates all dates before committing and missing candidates exclude future days',()=>{
 const before={'2026-11-03':{earnedDay:true,minutes:1400,cheerK:2}},snapshot=structuredClone(before);const options={from:1,to:4,weekdays:[0,1,2,3,4,5,6],minutes:60,countDay:true,mode:'add'};
 assert.throws(()=>PocoCalendar.bulkActuals(before,'2026-11',options));assert.deepEqual(before,snapshot);
 for(const bad of [{...options,to:31},{...options,from:5},{...options,weekdays:[]},{...options,minutes:1441},{...options,minutes:null,countDay:false}])assert.throws(()=>PocoCalendar.bulkActuals({},'2026-11',bad));
 const entity={schedule:{'2026-11-01':'予定','2026-11-02':'予定','2026-11-04':'予定'},actuals:{'2026-11-02':{earnedDay:true,minutes:0,cheerK:0},'2026-11-03':{earnedDay:true,minutes:null,cheerK:null}}};
 assert.deepEqual(PocoCalendar.missingActualDates(entity,'2026-11','2026-11-03'),['2026-11-01','2026-11-03']);
 assert.deepEqual(PocoCalendar.missingActualDates(entity,'2026-11','2026-10-31'),[]);
});

test('account-by-liver actuals are optional, isolated and keep zero distinct from blanks',()=>{
 const {pairDetails,validPairActuals,setActual}=PocoCalendar;
 const first={name:'A',values:['10','2'],memo:'保持',actuals:{'2026-11-01':{earnedDay:true,minutes:30,cheerK:7}}},second={name:'B',values:['1',''],memo:''};const table={columns:['こじ','こた'],rows:[first,second]};
 pairDetails(table,first,0);assert.equal(first.pairActuals,undefined);
 const pair=pairDetails(table,first,0,true);pair.cheerK=0;setActual(pair,'2026-11-02',{earnedDay:true,minutes:90,cheerK:null},'2026-11');
 assert.equal(pairDetails(table,first,1).cheerK,null);assert.equal(pairDetails(table,second,0).cheerK,null);assert.deepEqual(first.values,['10','2']);assert.equal(first.actuals['2026-11-01'].cheerK,7);assert.equal(validPairActuals(first,table.columns,'2026-11'),true);
 assert.equal(validPairActuals({...first,pairActuals:[{...pair,cheerK:-1},null]},table.columns,'2026-11'),false);assert.equal(validPairActuals(first,['one'],'2026-11'),false);
 const restored=JSON.parse(JSON.stringify(table));assert.equal(restored.rows[0].pairActuals[0].cheerK,0);assert.equal(restored.rows[0].pairActuals[1],null);
});

test('copy viewing time to selected accounts without replacing other records',()=>{
 const date='2026-11-03',other='2026-11-04',month='2026-11';
 const source={memo:'元',cheerK:3,actuals:{[date]:{earnedDay:true,minutes:90,cheerK:2}}};
 const target={memo:'先',cheerK:5,schedule:{[date]:'予定'},actuals:{
  [date]:{earnedDay:false,minutes:0,cheerK:4},
  [other]:{earnedDay:true,minutes:20,cheerK:null}
 }};
 const row={pairActuals:[source,target,null,null]};
 const table={columns:['こた','こじ','もえ','ヨシ'],rows:[row]};
 const snapshot=structuredClone(row);
 const next=PocoCalendar.copyViewingTime(table,row,0,[1,2,2],date,month);
 assert.deepEqual(next,[source,{...target,actuals:{...target.actuals,[date]:{earnedDay:false,minutes:90,cheerK:4}}},
  {memo:'',cheerK:null,actuals:{[date]:{earnedDay:true,minutes:90,cheerK:null}}},null]);
 assert.deepEqual(row,snapshot);
 assert.throws(()=>PocoCalendar.copyViewingTime(table,row,0,[1,0],date,month));
 assert.throws(()=>PocoCalendar.copyViewingTime(table,row,0,[1,4],date,month));
 assert.throws(()=>PocoCalendar.copyViewingTime(table,row,0,[1],other,month));
});
