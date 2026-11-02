import test from 'node:test';
import assert from 'node:assert/strict';
import '../calendar.js';
import '../image-import.js';
const {parseText,parseGrid,merge}=globalThis.PocoImageImport;
test('extracts dated Japanese schedule lines, multiline plans, off days and full-width text',()=>{
  const result=parseText('2026年11月 配信予定\n１１／３ １０：００〜１２：００\n11/4\n20:00〜22:00\n5日(木) お休み\n6(金) 21:00 コラボ','2026-11');
  assert.deepEqual(result.entries.map(x=>[x.date,x.text]),[['2026-11-03','10:00〜12:00'],['2026-11-04','20:00〜22:00'],['2026-11-05','お休み'],['2026-11-06','21:00 コラボ']]);
});
test('expands explicit date ranges and weekly schedules, excludes other months and bad dates',()=>{
  const result=parseText('11/1〜11/2 20:00\n毎週火曜日 13:00\n12/1 10:00\n11/31 10:00','2026-11');
  assert.deepEqual(result.entries.map(x=>x.date),['2026-11-01','2026-11-02','2026-11-03','2026-11-10','2026-11-17','2026-11-24']);assert.ok(result.warnings.length);
  assert.equal(parseText('12月予定\n3日 10:00','2026-11').entries.length,0);
});
test('uses calendar cell positions when dates and times are separate words',()=>{
  const words=[];const word=(text,x,y)=>({text,bbox:{x0:x,y0:y,x1:x+30,y1:y+16}});
  for(let i=0;i<7;i++)words.push(word('日月火水木金土'[i],i*100+35,10));
  for(let day=1;day<=30;day++){const col=(day-1)%7,week=Math.floor((day-1)/7);words.push(word(String(day),col*100+5,50+week*100));if(day===3)words.push(word('20:00',col*100+10,80+week*100));}
  assert.deepEqual(parseGrid({blocks:[{paragraphs:[{lines:[{words}]}]}]},'2026-11').map(x=>[x.date,x.text]),[['2026-11-03','20:00']]);
});
test('merging is atomic, defaults to append, avoids duplicate imports and never clears unrelated dates',()=>{
  const old={'2026-11-03':'既存予定','2026-11-04':'別の日'};const entries=[{date:'2026-11-03',text:'20:00'}];
  const next=merge(old,entries,'2026-11');assert.equal(next['2026-11-03'],'既存予定\n20:00');assert.equal(next['2026-11-04'],'別の日');assert.equal(merge(next,entries,'2026-11')['2026-11-03'],next['2026-11-03']);assert.equal(old['2026-11-03'],'既存予定');assert.equal(merge(old,entries,'2026-11','replace')['2026-11-03'],'20:00');
  assert.throws(()=>merge(old,[...entries,{date:'2026-12-01',text:'不正'}],'2026-11'));assert.equal(old['2026-11-03'],'既存予定');
});

test('calendar positions tolerate missing weekday labels and an unreadable first week',()=>{
  const words=[],word=(text,x,y)=>({text,bbox:{x0:x,y0:y,x1:x+30,y1:y+16}});
  for(const i of [0,1,2,3,5])words.push(word('日月火水木金土'[i],i*100+35,10));
  for(let day=10;day<=30;day++)words.push(word(String(day),((day-1)%7)*100+5,50+Math.floor((day-1)/7)*100));
  words.push(word('20:00',210,80),word('お休み',410,80),word('13:00',410,180));
  assert.deepEqual(parseGrid({blocks:[{paragraphs:[{lines:[{words}]}]}]},'2026-11').map(x=>[x.date,x.text]),[['2026-11-03','20:00'],['2026-11-05','お休み'],['2026-11-12','13:00']]);
});
test('calendar grids also support Monday as the first column',()=>{
  const words=[],word=(text,x,y)=>({text,bbox:{x0:x,y0:y,x1:x+30,y1:y+16}});
  for(let i=0;i<7;i++)words.push(word('月火水木金土日'[i],i*100+35,10));
  for(let day=1;day<=30;day++){const index=day+5;words.push(word(String(day),(index%7)*100+5,50+Math.floor(index/7)*100));if(day===3)words.push(word('20:00',(index%7)*100+10,80+Math.floor(index/7)*100));}
  assert.deepEqual(parseGrid({blocks:[{paragraphs:[{lines:[{words}]}]}]},'2026-11').map(x=>[x.date,x.text]),[['2026-11-03','20:00']]);
});
