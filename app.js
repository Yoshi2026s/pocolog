const KEY = 'pocolog.v1';
const photoLivers = ['どんちゃん','かつにぃ','ともちゃん','あすぽん','むぎたん','しーたま','れなぴ','ラピママ','武井','こたちゃま','みさき','EMMA','猫','あおいちゃん','おはぎ','スパたん','たぁ坊','アルちゃん','スピカちゃん'];
const initial = {columns:['もえ','こじ','こた','寿司','イカ','焼肉','ケン','ガヤ','お餅','アラン','シオン','レオン','ヨシ'],rows:[]};
const $ = id => document.getElementById(id);
let data, book;
function valid(d){return d && Array.isArray(d.columns) && d.columns.length<=100 && d.columns.every(c=>typeof c==='string') && Array.isArray(d.rows) && d.rows.length<=10000 && d.rows.every(r=>typeof r.name==='string' && typeof r.memo==='string' && Array.isArray(r.values) && r.values.length===d.columns.length && r.values.every(v=>typeof v==='string'));}
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit'}).format(new Date());
const monthValid=m=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m);
function validBook(b){return b && b.version===2 && monthValid(b.currentMonth) && b.months && typeof b.months==='object' && !Array.isArray(b.months) && Object.keys(b.months).length<=1200 && Object.entries(b.months).every(([m,d])=>monthValid(m)&&valid(d)) && valid(b.months[b.currentMonth]);}
try{const saved=localStorage.getItem(KEY);const parsed=saved?JSON.parse(saved):null;book=validBook(parsed)?parsed:{version:2,currentMonth:today,months:{[today]:parsed&&valid(parsed)?parsed:structuredClone(initial)}};if(parsed&&!validBook(parsed)&&!valid(parsed))throw Error();}catch{book={version:2,currentMonth:today,months:{[today]:structuredClone(initial)}};$('status').textContent='保存データを読めません。バックアップを読み込んでください。';}
function addMoeAccount(){
 if(book.accountLayoutVersion===1)return;
 for(const month of Object.values(book.months)){
  const koji=month.columns.indexOf('こじ');
  if(koji<0||month.columns.includes('もえ'))continue;
  month.columns.splice(koji,0,'もえ');
  month.rows.forEach(row=>row.values.splice(koji,0,''));
 }
 book.accountLayoutVersion=1;
}
addMoeAccount();
function addPhotoLivers(){
 if(book.photoLiversVersion===1)return;
 for(const month of Object.values(book.months)){
  for(const name of photoLivers){
   if(!month.rows.some(row=>row.name===name))month.rows.push({name,memo:'',values:month.columns.map(()=>'')});
  }
 }
 book.photoLiversVersion=1;
}
addPhotoLivers();
data=book.months[book.currentMonth];
$('month').value=book.currentMonth;
$('month').onchange=()=>{const m=$('month').value;if(!monthValid(m))return;const created=!book.months[m];if(created)book.months[m]={columns:[...data.columns],rows:data.rows.map(r=>({name:r.name,memo:'',values:data.columns.map(()=>'')}))};book.currentMonth=m;data=book.months[m];save(created);render();};
const monthly=document.createElement('section');monthly.className='panel';monthly.style.marginTop='24px';const monthlyTitle=document.createElement('h2');monthlyTitle.textContent='月別の実績（K）';const monthlyBars=document.createElement('div');monthlyBars.id='monthly';monthly.append(monthlyTitle,monthlyBars);document.querySelector('main').append(monthly);
function measure(values){const counts=values.reduce((a,v)=>{const s=v.trim();if(s){a.filled++;if(/^[○〇◯]$/.test(s))a.circle++;else if(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)){const n=Number(s);if(Number.isFinite(n)&&Number.isFinite(a.number+n))a.number+=n;}}return a;},{number:0,circle:0,filled:0});return {...counts,...PocoCoins.summarize(values)};}
const fmt=n=>n.toLocaleString('ja-JP',{maximumFractionDigits:10});
function save(edited=true){try{localStorage.setItem(KEY,JSON.stringify(book));$('status').textContent='このブラウザに保存済み';}catch{$('status').textContent='保存できません。バックアップを保存してください。';}if(edited)window.dispatchEvent(new Event('pocolog:edit'));}
function input(value,label,onchange){const el=document.createElement('input');el.value=value;el.setAttribute('aria-label',label);el.addEventListener('input',()=>{onchange(el.value);save();stats();});return el;}
function cell(row,tag='td',cls=''){const el=document.createElement(tag);el.className=cls;row.append(el);return el;}
function render(){
 const table=$('grid');table.replaceChildren();const head=table.createTHead().insertRow();
 cell(head,'th').textContent='ライバー名';
 data.columns.forEach((c,j)=>{
  const th=cell(head,'th');th.append(input(c,`アカウント ${j+1}`,v=>{data.columns[j]=v;}));
  const b=document.createElement('button');b.textContent='削除';b.setAttribute('aria-label',`${c}列を削除`);
  b.onclick=()=>{if(confirm(`「${data.columns[j]}」列とその記録を削除しますか？`)){data.columns.splice(j,1);data.rows.forEach(r=>r.values.splice(j,1));save();render();}};
  th.append(document.createElement('br'),b);
 });
 cell(head,'th').textContent='合計（K）';cell(head,'th').textContent='必要コイン';cell(head,'th').textContent='メモ';cell(head,'th');
 const body=table.createTBody();
 data.rows.forEach((r,i)=>{
  const tr=body.insertRow();cell(tr,'td','name').append(input(r.name,`ライバー名 ${i+1}`,v=>r.name=v));
  r.values.forEach((v,j)=>{
   const td=cell(tr);td.append(input(v,`${r.name}・${data.columns[j]}`,v=>r.values[j]=v));
   const hint=document.createElement('small');hint.className='coin-hint';hint.dataset.cellRow=i;hint.dataset.cellCol=j;td.append(hint);
  });
  const total=cell(tr,'td','total');total.dataset.row=i;
  const coins=cell(tr,'td','total coin-total');coins.dataset.coinRow=i;
  cell(tr,'td','memo').append(input(r.memo,`${r.name}のメモ`,v=>r.memo=v));
  const b=document.createElement('button');b.textContent='×';b.className='remove';b.setAttribute('aria-label',`${r.name}を削除`);
  b.onclick=()=>{if(confirm(`「${r.name}」の記録を削除しますか？`)){data.rows.splice(i,1);save();render();}};cell(tr).append(b);
 });
 stats();
}
const coinText=result=>fmt(result.coins)+(result.unknown?` ＋ 未算定${result.unknown}件`:'');
function coinSummary(id,entries){
 const parent=$(id);parent.replaceChildren();
 const wrap=document.createElement('div');wrap.className='table-wrap';
 const table=document.createElement('table');table.className='summary-table';table.setAttribute('aria-label',id==='liverCoins'?'ライバー別必要コイン':'アカウント別必要コイン');
 const header=table.createTHead().insertRow();
 for(const title of [id==='liverCoins'?'ライバー':'アカウント','エール（K）','必要コイン'])cell(header,'th').textContent=title;
 const body=table.createTBody();
 entries.forEach(entry=>{const row=body.insertRow();cell(row).textContent=entry.name;cell(row).textContent=fmt(entry.number);cell(row).textContent=coinText(entry);});
 wrap.append(table);parent.append(wrap);
}

function bar(parent,name,value,max,label){const row=document.createElement('div');row.className='barrow';const title=document.createElement('span');title.textContent=name;title.title=name;const track=document.createElement('div');track.className='track';const fill=document.createElement('div');fill.className='fill';fill.style.width=`${max>0?Math.max(0,value)/max*100:0}%`;track.append(fill);const count=document.createElement('b');count.textContent=label??fmt(value);row.append(title,track,count);parent.append(row);}
function stats(){
 const months=Object.entries(book.months).sort(([a],[b])=>a.localeCompare(b)).map(([name,d])=>({name,...measure(d.rows.flatMap(r=>r.values))}));
 $('monthly').replaceChildren();const monthMax=Math.max(0,...months.map(m=>m.number));months.forEach(m=>bar($('monthly'),m.name,m.number,monthMax,fmt(m.number)+' K'));
 const all=measure(data.rows.flatMap(r=>r.values));
 $('people').textContent=data.rows.length;$('sum').textContent=fmt(all.number);$('circles').textContent=all.circle;$('filled').textContent=all.filled;
 $('coinSum').textContent=fmt(all.coins);$('coinUnknown').textContent=all.unknown?`別途、未算定のセルが${all.unknown}件あります`:'';
 const liverTotals=data.rows.map(r=>({name:r.name,...measure(r.values)}));
 document.querySelectorAll('[data-row]').forEach(e=>e.textContent=fmt(liverTotals[Number(e.dataset.row)].number));
 document.querySelectorAll('[data-coin-row]').forEach(e=>e.textContent=coinText(liverTotals[Number(e.dataset.coinRow)]));
 document.querySelectorAll('[data-cell-row]').forEach(e=>{
  const result=PocoCoins.convert(data.rows[Number(e.dataset.cellRow)].values[Number(e.dataset.cellCol)]);
  e.textContent=result.status==='known'?`${fmt(result.coins)}コイン`:result.status==='check'?'仮チェック':result.status==='blank'?'':'未算定';
 });
 const metric=$('metric').value;const ranked=[...liverTotals].sort((a,b)=>b[metric]-a[metric]);
 $('ranking').replaceChildren();const max=Math.max(0,...ranked.map(r=>r[metric]));
 ranked.forEach(r=>bar($('ranking'),r.name,r[metric],max,metric==='coins'?coinText(r):undefined));
 if(!ranked.length)$('ranking').textContent='ライバーを追加すると集計が表示されます。';
 const cols=data.columns.map((name,j)=>({name,...measure(data.rows.map(r=>r.values[j]))}));
 $('columns').replaceChildren();const colmax=Math.max(0,...cols.map(c=>c.number));cols.forEach(c=>bar($('columns'),c.name,c.number,colmax,`${fmt(c.number)} ／ ${c.circle} ／ ${c.filled}`));
 coinSummary('liverCoins',liverTotals);coinSummary('accountCoins',cols);
}

$('addRow').onclick=()=>{data.rows.push({name:'新しいライバー',memo:'',values:data.columns.map(()=>'')});save();render();};
$('addCol').onclick=()=>{if(data.columns.length>=100)return alert('アカウントは100列までです。');data.columns.push('新しいアカウント');data.rows.forEach(r=>r.values.push(''));save();render();};
$('metric').onchange=stats;
$('refresh').onclick=()=>{try{localStorage.setItem(KEY,JSON.stringify(book));location.reload();}catch{$('status').textContent='保存できないため更新を中止しました。バックアップを保存してください。';}};
function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download').onclick=()=>download(JSON.stringify(book,null,2),'application/json','pocolog-backup.json');
$('upload').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>10000000)throw Error();const next=JSON.parse(await f.text());if(!validBook(next)&&!valid(next))throw Error();if(confirm('全月の記録をバックアップの内容で置き換えますか？')){book=validBook(next)?next:{version:2,currentMonth:book.currentMonth,months:{[book.currentMonth]:next}};addMoeAccount();addPhotoLivers();data=book.months[book.currentMonth];$('month').value=book.currentMonth;save();render();}}catch{alert('読み込めませんでした。ポコログのJSONバックアップを選択してください。');}e.target.value='';};
$('csv').onclick=()=>{const quote=s=>'"'+String(s).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';const rows=[['ライバー名',...data.columns,'エール合計（K）','必要コイン（換算済み分）','未算定セル数','メモ'],...data.rows.map(r=>{const total=measure(r.values);return [r.name,...r.values,total.number,total.coins,total.unknown,r.memo];})];download('\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8','pocolog.csv');};
const reference=$('coinReference');const referenceHead=reference.createTHead().insertRow();
cell(referenceHead,'th').textContent='エール（K）';cell(referenceHead,'th').textContent='必要コイン（条件1）';
const referenceBody=reference.createTBody();PocoCoins.tiers.forEach(([level,coins])=>{const row=referenceBody.insertRow();cell(row).textContent=fmt(level);cell(row).textContent=fmt(coins);});
render();

window.pocolog = {
 getBook:()=>structuredClone(book), validBook,
 setBook(next){
  if(!validBook(next))throw Error('共有データの形式を確認できません。');
  const selected=book.currentMonth;
  book=structuredClone(next);
  if(book.months[selected])book.currentMonth=selected;
  data=book.months[book.currentMonth];$('month').value=book.currentMonth;
  save(false);render();
 },
 setEditing(enabled){document.querySelectorAll('#grid input,#grid button,#addRow,#addCol,#upload,#month').forEach(el=>el.disabled=!enabled);},
 downloadBackup:(backup=book)=>download(JSON.stringify(backup,null,2),'application/json','pocolog-unsynced-backup.json')
};
