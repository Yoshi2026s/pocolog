const KEY = 'pocolog.v1';
const photoLivers = ['どんちゃん','かつにぃ','ともちゃん','あすぽん','むぎたん','しーたま','れなぴ','ラピママ','武井','こたちゃま','みさき','EMMA','猫','あおいちゃん','おはぎ','スパたん','たぁ坊','アルちゃん','スピカちゃん'];
const initial = {columns:['もえ','こじ','こた','寿司','イカ','焼肉','ケン','ガヤ','お餅','アラン','シオン','レオン','ヨシ'],rows:[]};
const $ = id => document.getElementById(id);
let data, book;
function valid(d){return d && Array.isArray(d.columns) && d.columns.length<=100 && d.columns.every(c=>typeof c==='string') && Array.isArray(d.rows) && d.rows.length<=10000 && d.rows.every(r=>typeof r.name==='string' && typeof r.memo==='string' && (r.closingTime===undefined||typeof r.closingTime==='string') && (r.releaseDate===undefined||typeof r.releaseDate==='string') && Array.isArray(r.values) && r.values.length===d.columns.length && r.values.every(v=>typeof v==='string'));}
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
$('month').onchange=()=>{const m=$('month').value;if(!monthValid(m))return;const created=!book.months[m];if(created)book.months[m]={columns:[...data.columns],rows:data.rows.map(r=>({name:r.name,memo:'',closingTime:r.closingTime||'',releaseDate:'',values:data.columns.map(()=>'')}))};book.currentMonth=m;data=book.months[m];save(created);render();};
const monthly=document.createElement('section');monthly.className='panel';monthly.style.marginTop='24px';const monthlyTitle=document.createElement('h2');monthlyTitle.textContent='月別の実績（K）';const monthlyBars=document.createElement('div');monthlyBars.id='monthly';monthly.append(monthlyTitle,monthlyBars);$('summaryContent').append(monthly);
function measure(values){const counts=values.reduce((a,v)=>{const s=v.trim();if(s){a.filled++;if(/^[○〇◯]$/.test(s))a.circle++;else if(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)){const n=Number(s);if(Number.isFinite(n)&&Number.isFinite(a.number+n))a.number+=n;}}return a;},{number:0,circle:0,filled:0});return {...counts,...PocoCoins.summarize(values)};}
const fmt=n=>n.toLocaleString('ja-JP',{maximumFractionDigits:10});
function save(edited=true){try{localStorage.setItem(KEY,JSON.stringify(book));$('status').textContent='このブラウザに保存済み';}catch{$('status').textContent='保存できません。バックアップを保存してください。';}if(edited)window.dispatchEvent(new Event('pocolog:edit'));}
function input(value,label,onchange){const el=document.createElement('input');el.value=value;el.setAttribute('aria-label',label);el.addEventListener('input',()=>{onchange(el.value);save();stats();});return el;}
function cell(row,tag='td',cls=''){const el=document.createElement(tag);el.className=cls;row.append(el);return el;}
const cheerPicker=document.createElement('div');cheerPicker.id='cheerPicker';cheerPicker.className='cheer-picker';cheerPicker.setAttribute('popover','auto');cheerPicker.setAttribute('role','listbox');cheerPicker.setAttribute('aria-label','エール数を選択');document.body.append(cheerPicker);
let activeCheer=null;
function closeCheerPicker(restoreFocus=false){
 if(!activeCheer)return;const trigger=activeCheer;activeCheer=null;trigger.setAttribute('aria-expanded','false');
 if(cheerPicker.matches(':popover-open'))cheerPicker.hidePopover();
 if(restoreFocus&&trigger.isConnected)trigger.focus({preventScroll:true});
}
cheerPicker.addEventListener('toggle',event=>{if(event.newState==='closed'&&activeCheer){activeCheer.setAttribute('aria-expanded','false');activeCheer=null;}});
function positionCheerPicker(){
 if(!activeCheer)return;
 const rect=activeCheer.getBoundingClientRect();const maxHeight=Math.min(300,window.innerHeight-24);
 cheerPicker.style.maxHeight=maxHeight+'px';cheerPicker.style.left=Math.max(8,Math.min(rect.left,window.innerWidth-148))+'px';
 cheerPicker.style.top=Math.max(8,Math.min(rect.bottom+4,window.innerHeight-maxHeight-8))+'px';
}
window.addEventListener('resize',positionCheerPicker);
window.addEventListener('scroll',event=>{if(event.target!==cheerPicker&&!cheerPicker.contains(event.target))positionCheerPicker();},true);
function cheerSelect(value,label,onchange){
 const trigger=document.createElement('button');trigger.type='button';trigger.className='cheer-field';trigger.setAttribute('role','combobox');trigger.setAttribute('aria-label',label);trigger.setAttribute('aria-controls','cheerPicker');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
 trigger.textContent=/^[○〇◯]$/.test(value.trim())?'〇':value;
 function open(){
  if(trigger.disabled)return;
  if(activeCheer===trigger){closeCheerPicker(true);return;}
  closeCheerPicker();activeCheer=trigger;cheerPicker.replaceChildren();
  const choices=['','〇',...Array.from({length:48},(_,i)=>String(i+1))];
  const options=choices.map((choice,index)=>{
   const option=document.createElement('button');option.type='button';option.setAttribute('role','option');option.setAttribute('aria-selected',String(index===0));option.tabIndex=-1;option.textContent=choice;if(choice==='')option.setAttribute('aria-label','空欄');
   option.onfocus=()=>options.forEach(item=>item.setAttribute('aria-selected',String(item===option)));
   option.onclick=()=>{trigger.textContent=choice;onchange(choice);save();stats();closeCheerPicker(true);};
   cheerPicker.append(option);return option;
  });
  cheerPicker.onkeydown=event=>{
   const index=options.indexOf(document.activeElement);let next;
   if(event.key==='ArrowDown')next=Math.min(options.length-1,index+1);
   if(event.key==='ArrowUp')next=Math.max(0,index-1);
   if(event.key==='Home')next=0;
   if(event.key==='End')next=options.length-1;
   if(next!==undefined){event.preventDefault();options[next].focus();}
   if(event.key==='Escape'){event.preventDefault();closeCheerPicker(true);}
   if(event.key==='Tab')closeCheerPicker(true);
  };
  positionCheerPicker();
  trigger.setAttribute('aria-expanded','true');cheerPicker.showPopover();cheerPicker.scrollTop=0;options[0].focus({preventScroll:true});
 }
 trigger.onclick=open;
 trigger.onkeydown=event=>{if(['ArrowDown','ArrowUp','Home'].includes(event.key)){event.preventDefault();open();}};
 return trigger;
}

function nameControls(name,label,show,rename){
 const wrapper=document.createElement('div');
 const button=document.createElement('button');button.type='button';button.className='name-trigger';button.textContent=name||'（未設定）';button.title=name;button.setAttribute('aria-label',`${label} ${name}の必要コイン合計`);button.onclick=show;
 const edit=document.createElement('button');edit.type='button';edit.className='rename';edit.textContent='編集';edit.setAttribute('aria-label',`${label} ${name}の名前を編集`);
 edit.onclick=()=>{const next=prompt(`${label}を編集`,name);if(next===null)return;rename(next);save();render();};wrapper.append(button,edit);return wrapper;
}
function showCoinDialog(kind,index){
 const isAccount=kind==='account';
 const name=isAccount?data.columns[index]:data.rows[index].name;
 const entries=isAccount?data.rows.map(row=>({name:row.name,value:row.values[index]})):data.columns.map((name,j)=>({name,value:data.rows[index].values[j]}));
 const total=measure(entries.map(entry=>entry.value));
 $('coinDialogTitle').textContent=`${name||'（未設定）'}の必要コイン合計`;
 $('coinDialogMonth').textContent=`${book.currentMonth} ／ ${isAccount?'アカウント別':'ライバー別'}`;
 $('coinDialogTotal').textContent=fmt(total.coins);
 $('coinDialogUnknown').textContent=total.unknown?`表にない値など${total.unknown}件は未算定です。表示は換算できた分の合計です。`:'';
 $('coinDialogCheer').textContent=`エール合計 ${fmt(total.number)} K ／ 仮チェック ${total.circle}件`;
 const table=$('coinDialogBreakdown');table.replaceChildren();const header=table.createTHead().insertRow();
 for(const title of [isAccount?'ライバー':'アカウント','エール（K）','必要コイン'])cell(header,'th').textContent=title;
 const body=table.createTBody();entries.forEach(entry=>{
  const row=body.insertRow();cell(row).textContent=entry.name;cell(row).textContent=entry.value||'—';
  const converted=PocoCoins.convert(entry.value);cell(row).textContent=converted.status==='known'?fmt(converted.coins):['check','blank'].includes(converted.status)?'—':'未算定';
 });
 $('coinDialog').showModal();
}
$('coinDialogClose').onclick=()=>$('coinDialog').close();
let scheduleRow=null;
function showSchedule(row){
 scheduleRow=row;$('scheduleTitle').textContent=`${row.name}の日程`;
 $('closingTimeInput').value=row.closingTime||'';$('releaseDateInput').value=row.releaseDate||'';
 $('scheduleDialog').showModal();
}
function scheduleField(row,field,label){
 const button=document.createElement('button');button.type='button';button.className='schedule-field';button.setAttribute('aria-label',`${row.name}の${label}`);button.title=row[field]||'';
 const value=row[field]||'';
 if(field==='releaseDate'&&value.includes(' ')){
  const [date,...time]=value.split(' ');const day=document.createElement('span');day.textContent=date;const clock=document.createElement('span');clock.textContent=time.join(' ');button.append(day,clock);
 }else{button.textContent=value;}
 button.onclick=()=>showSchedule(row);return button;
}
$('scheduleClose').onclick=()=>$('scheduleDialog').close();
$('scheduleDialog').addEventListener('close',()=>{scheduleRow=null;});
$('scheduleForm').onsubmit=event=>{
 event.preventDefault();if(!scheduleRow||!data.rows.includes(scheduleRow))return;
 scheduleRow.closingTime=$('closingTimeInput').value.trim();scheduleRow.releaseDate=$('releaseDateInput').value.trim();save();render();
};
function render(){
 closeCheerPicker();
 if($('coinDialog').open)$('coinDialog').close();
 if($('scheduleDialog').open)$('scheduleDialog').close();
 const table=$('grid');table.replaceChildren();const head=table.createTHead().insertRow();
 cell(head,'th').textContent='ライバー名';
 cell(head,'th','closing-col').textContent='締め時間';cell(head,'th','release-col').textContent='解禁日';
 data.columns.forEach((c,j)=>{
  const th=cell(head,'th');th.append(nameControls(c,'アカウント',()=>showCoinDialog('account',j),v=>{data.columns[j]=v;}));
  const b=document.createElement('button');b.textContent='削除';b.className='delete-column';b.setAttribute('aria-label',`${c}列を削除`);
  b.onclick=()=>{if(confirm(`「${data.columns[j]}」列とその記録を削除しますか？`)){data.columns.splice(j,1);data.rows.forEach(r=>r.values.splice(j,1));save();render();}};
  th.append(document.createElement('br'),b);
 });
 cell(head,'th','extra-col').textContent='合計（K）';cell(head,'th','extra-col').textContent='必要コイン';cell(head,'th','extra-col').textContent='メモ';cell(head,'th','extra-col');
 const body=table.createTBody();
 data.rows.forEach((r,i)=>{
  const tr=body.insertRow();cell(tr,'td','name').append(nameControls(r.name,'ライバー',()=>showCoinDialog('liver',i),v=>r.name=v));
  cell(tr,'td','closing-col').append(scheduleField(r,'closingTime','締め時間'));cell(tr,'td','release-col').append(scheduleField(r,'releaseDate','解禁日'));
  r.values.forEach((v,j)=>{
   const td=cell(tr);td.append(cheerSelect(v,`${r.name}・${data.columns[j]}`,v=>r.values[j]=v));
  });
  const total=cell(tr,'td','total extra-col');total.dataset.row=i;
  const coins=cell(tr,'td','total coin-total extra-col');coins.dataset.coinRow=i;
  cell(tr,'td','memo extra-col').append(input(r.memo,`${r.name}のメモ`,v=>r.memo=v));
  const b=document.createElement('button');b.textContent='×';b.className='remove';b.setAttribute('aria-label',`${r.name}を削除`);
  b.onclick=()=>{if(confirm(`「${r.name}」の記録を削除しますか？`)){data.rows.splice(i,1);save();render();}};cell(tr,'td','extra-col').append(b);
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
$('tableMode').onclick=()=>{const expanded=$('tablePanel').classList.toggle('table-detail');$('tableMode').setAttribute('aria-pressed',String(expanded));$('tableMode').textContent=expanded?'一覧に戻る':'編集・詳細';};
$('refresh').onclick=()=>{try{localStorage.setItem(KEY,JSON.stringify(book));location.reload();}catch{$('status').textContent='保存できないため更新を中止しました。バックアップを保存してください。';}};
function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download').onclick=()=>download(JSON.stringify(book,null,2),'application/json','pocolog-backup.json');
$('upload').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>10000000)throw Error();const next=JSON.parse(await f.text());if(!validBook(next)&&!valid(next))throw Error();if(confirm('全月の記録をバックアップの内容で置き換えますか？')){book=validBook(next)?next:{version:2,currentMonth:book.currentMonth,months:{[book.currentMonth]:next}};addMoeAccount();addPhotoLivers();data=book.months[book.currentMonth];$('month').value=book.currentMonth;save();render();}}catch{alert('読み込めませんでした。ポコログのJSONバックアップを選択してください。');}e.target.value='';};
$('csv').onclick=()=>{const quote=s=>'"'+String(s).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';const rows=[['ライバー名','締め時間','解禁日',...data.columns,'エール合計（K）','必要コイン（換算済み分）','未算定セル数','メモ'],...data.rows.map(r=>{const total=measure(r.values);return [r.name,r.closingTime||'',r.releaseDate||'',...r.values,total.number,total.coins,total.unknown,r.memo];})];download('\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8','pocolog.csv');};
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
 setEditing(enabled){if(!enabled)closeCheerPicker();document.querySelectorAll('#grid input,#grid select,#grid button,#addRow,#addCol,#upload,#month').forEach(el=>el.disabled=!enabled);},
 downloadBackup:(backup=book)=>download(JSON.stringify(backup,null,2),'application/json','pocolog-unsynced-backup.json')
};
