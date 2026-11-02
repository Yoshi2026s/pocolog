const KEY = 'pocolog.v1';
const photoLivers = ['どんちゃん','かつにぃ','ともちゃん','あすぽん','むぎたん','しーたま','れなぴ','ラピママ','武井','こたちゃま','みさき','EMMA','猫','あおいちゃん','おはぎ','スパたん','たぁ坊','アルちゃん','スピカちゃん'];
const initial = {columns:['こじ','こた','もえ','寿司','イカ','焼肉','ケン','ガヤ','お餅','アラン','シオン','レオン','ヨシ','海斗','レオ'],rows:[]};
const $ = id => document.getElementById(id);
let data, book;
function valid(d,month){return d && Array.isArray(d.columns) && d.columns.length<=100 && d.columns.every(c=>typeof c==='string') && Array.isArray(d.rows) && d.rows.length<=10000 && d.rows.every(r=>typeof r.name==='string' && typeof r.memo==='string' && (r.closingTime===undefined||typeof r.closingTime==='string') && (r.releaseDate===undefined||typeof r.releaseDate==='string') && Array.isArray(r.values) && r.values.length===d.columns.length && r.values.every(v=>typeof v==='string') && PocoCalendar.validSchedule(r.schedule,month)) && PocoCalendar.validAccounts(d,month);}
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit'}).format(new Date());
const monthValid=m=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m);
function validBook(b){return b && b.version===2 && monthValid(b.currentMonth) && b.months && typeof b.months==='object' && !Array.isArray(b.months) && Object.keys(b.months).length<=1200 && Object.entries(b.months).every(([m,d])=>monthValid(m)&&valid(d,m)) && valid(b.months[b.currentMonth],b.currentMonth);}
try{const saved=localStorage.getItem(KEY);const parsed=saved?JSON.parse(saved):null;book=validBook(parsed)?parsed:{version:2,currentMonth:today,months:{[today]:parsed&&valid(parsed,today)?parsed:structuredClone(initial)}};if(parsed&&!validBook(parsed)&&!valid(parsed,today))throw Error();}catch{book={version:2,currentMonth:today,months:{[today]:structuredClone(initial)}};$('status').textContent='保存データを読めません。バックアップを読み込んでください。';}
function addMoeAccount(){
 if(book.accountLayoutVersion===1)return;
 for(const month of Object.values(book.months)){
  const kota=month.columns.indexOf('こた');
  if(kota<0||month.columns.includes('もえ'))continue;
  month.columns.splice(kota+1,0,'もえ');if(month.accountDetails)month.accountDetails.splice(kota+1,0,{memo:'',schedule:{}});
  month.rows.forEach(row=>row.values.splice(kota+1,0,''));
 }
 book.accountLayoutVersion=1;
}
addMoeAccount();PocoRows.addExtraAccounts(book);
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
function save(edited=true){let stored=false;try{localStorage.setItem(KEY,JSON.stringify(book));if(edited)localStorage.setItem('pocolog.pending.v1','1');$('status').textContent='このブラウザに保存済み';stored=true;}catch{$('status').textContent='保存できません。バックアップを保存してください。';}if(edited)window.dispatchEvent(new Event('pocolog:edit'));return stored;}
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

let rowSort={field:null,direction:1,month:''};
let rowDrag=null,suppressRowClick=false;
document.addEventListener('click',event=>{if(suppressRowClick&&event.target.closest('#grid')){event.preventDefault();event.stopImmediatePropagation();suppressRowClick=false;}},true);
function clearRowDrag(){
 const drag=rowDrag;if(!drag)return;rowDrag=null;clearTimeout(drag.timer);cancelAnimationFrame(drag.frame);
 try{if(drag.button.hasPointerCapture(drag.pointerId))drag.button.releasePointerCapture(drag.pointerId);}catch{}
 document.body.classList.remove('row-dragging');document.querySelectorAll('#grid tr').forEach(row=>row.classList.remove('is-dragging','drop-before','drop-after'));
}
function moveLiver(row,to){
 const from=data.rows.indexOf(row);if(from<0||to<0||to>=data.rows.length||from===to)return;
 data.rows=PocoRows.moveRow(data.rows,from,to);rowSort={field:null,direction:1,month:book.currentMonth};save();render();
 $('orderStatus').textContent=`${row.name}を${to+1}番目に移動しました`;
 document.querySelectorAll('#grid tbody .name-trigger')[to]?.focus({preventScroll:true});
}
function sortLivers(field){
 const direction=rowSort.field===field&&rowSort.month===book.currentMonth?-rowSort.direction:1;
 rowSort={field,direction,month:book.currentMonth};const ordered=PocoRows.sortRows(data.rows,field,direction,book.currentMonth);
 const changed=ordered.some((row,index)=>row!==data.rows[index]);data.rows=ordered;if(changed)save();render();
 $('orderStatus').textContent=`${field==='closingTime'?'締め時間':'解禁日'}の${direction===1?'早い':'遅い'}順に並び替えました。未定・空欄は末尾です。`;
 document.querySelector(`[data-sort-field="${field}"]`)?.focus({preventScroll:true});
}
function sortHeader(head,field,label,cls){
 const th=cell(head,'th',cls);const active=rowSort.field===field&&rowSort.month===book.currentMonth;
 th.setAttribute('aria-sort',active?(rowSort.direction===1?'ascending':'descending'):'none');
 const text=document.createElement('span');text.className='sort-label';text.dataset.sortField=field;text.textContent=label;text.setAttribute('role','button');text.tabIndex=0;text.setAttribute('aria-label',`${label}で並べ替え`);text.title='文字を押すたびに早い順・遅い順を切り替えます';
 text.onclick=()=>{if(text.getAttribute('aria-disabled')!=='true')sortLivers(field);};
 text.onkeydown=event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();text.click();}};th.append(text);
}
function attachRowDrag(button,row,tr){
 button.title=`${row.name}：クリックで合計、ドラッグで順番を移動（Alt＋↑↓でも移動）`;
 button.oncontextmenu=event=>event.preventDefault();
 function updateDrop(){
  if(!rowDrag?.dragging)return;const drag=rowDrag;const target=document.elementFromPoint(drag.x,drag.y)?.closest('#grid tbody tr');
  document.querySelectorAll('#grid tr').forEach(item=>item.classList.remove('drop-before','drop-after'));
  if(target){const index=[...target.parentElement.children].indexOf(target);drag.target=data.rows[index];drag.after=drag.y>target.getBoundingClientRect().top+target.getBoundingClientRect().height/2;target.classList.add(drag.after?'drop-after':'drop-before');}
 }
 function animate(){
  if(!rowDrag?.dragging)return;const drag=rowDrag;const wrap=$('grid').parentElement;const rect=wrap.getBoundingClientRect();
  if(drag.x>=rect.left&&drag.x<=rect.right){if(drag.y<rect.top+55)wrap.scrollTop-=8;else if(drag.y>rect.bottom-35)wrap.scrollTop+=8;}
  updateDrop();drag.frame=requestAnimationFrame(animate);
 }
 function begin(){
  if(!rowDrag||rowDrag.button!==button||rowDrag.dragging)return;
  rowDrag.dragging=true;tr.classList.add('is-dragging');document.body.classList.add('row-dragging');closeCheerPicker();updateDrop();rowDrag.frame=requestAnimationFrame(animate);
 }
 button.onpointerdown=event=>{
  if(button.disabled||event.button!==0)return;clearRowDrag();
  rowDrag={button,row,pointerId:event.pointerId,startY:event.clientY,x:event.clientX,y:event.clientY,dragging:false,target:row,after:false};
  button.setPointerCapture(event.pointerId);rowDrag.timer=setTimeout(begin,300);
 };
 button.onpointermove=event=>{if(!rowDrag||rowDrag.pointerId!==event.pointerId)return;rowDrag.x=event.clientX;rowDrag.y=event.clientY;if(Math.abs(event.clientY-rowDrag.startY)>6)begin();if(rowDrag.dragging){event.preventDefault();updateDrop();}};
 button.onpointerup=event=>{
  if(!rowDrag||rowDrag.pointerId!==event.pointerId)return;const drag=rowDrag;const rect=$('grid').parentElement.getBoundingClientRect();const inside=event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom;
  const from=data.rows.indexOf(drag.row),target=data.rows.indexOf(drag.target);let to=target+(drag.after?1:0);if(from<to)to--;
  clearRowDrag();if(drag.dragging){event.preventDefault();suppressRowClick=true;setTimeout(()=>{suppressRowClick=false;},350);if(inside)moveLiver(drag.row,to);}
 };
 button.onpointercancel=clearRowDrag;
 button.addEventListener('keydown',event=>{if(event.altKey&&['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();moveLiver(row,data.rows.indexOf(row)+(event.key==='ArrowUp'?-1:1));}});
}
window.addEventListener('blur',clearRowDrag);
function nameControls(name,label,show){
 const wrapper=document.createElement('div');
 const button=document.createElement('button');button.type='button';button.className='name-trigger';button.textContent=name||'（未設定）';button.title=name;button.setAttribute('aria-label',`${label} ${name}の必要コイン合計`);button.onclick=show;
 wrapper.append(button);return wrapper;
}

function showCoinDialog(kind,index){
 const isAccount=kind==='account';
 const name=isAccount?data.columns[index]:data.rows[index].name;
 const entries=isAccount?data.rows.map(row=>({name:row.name,value:row.values[index]})):data.columns.map((name,j)=>({name,value:data.rows[index].values[j]}));
 const targetRow=isAccount?null:data.rows[index];
 const current=()=>isAccount?data.columns[index]===name:data.rows[index]===targetRow;
 $('nameEdit').setAttribute('aria-label',`${isAccount?'アカウント':'ライバー'} ${name}の名前を編集`);
 $('nameDelete').textContent=isAccount?'アカウントを削除':'ライバーを削除';
 $('nameDelete').setAttribute('aria-label',`${isAccount?'アカウント':'ライバー'} ${name}を削除`);
 $('nameEdit').onclick=()=>{
  if(!current())return;const next=prompt(`${isAccount?'アカウント':'ライバー名'}を編集`,name);if(next===null)return;
  if(isAccount)data.columns[index]=next;else targetRow.name=next;
  save();render();showCoinDialog(kind,index);
 };
 $('nameDelete').onclick=()=>{
  if(!current())return;
  const question=isAccount?`アカウント「${name}」と各ライバーの記録を削除しますか？`:`ライバー「${name}」の記録を削除しますか？`;
  if(!confirm(question))return;
  if(isAccount){data.columns.splice(index,1);if(data.accountDetails)data.accountDetails.splice(index,1);data.rows.forEach(row=>row.values.splice(index,1));}else data.rows.splice(index,1);
  save();render();
 };
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
 openEntityPlanner({kind,index,row:targetRow,month:book.currentMonth,table:data,isCurrent:current});
 $('coinDialog').showModal();
}
let currentEntity=null;
function entityDetails(create=false){
 if(!currentEntity||currentEntity.table!==data||!currentEntity.isCurrent())return null;
 return currentEntity.kind==='account'?PocoCalendar.accountDetails(data,currentEntity.index,create):currentEntity.row;
}
function renderEntityCalendar(){
 const entity=entityDetails();if(!entity)return;
 const month=currentEntity.month,info=PocoCalendar.monthInfo(month);if(!info)return;
 const calendar=$('entityCalendar');calendar.replaceChildren();
 $('calendarMonthLabel').textContent=`${info.year}年${info.number}月の配信予定`;
 $('calendarCount').textContent=`${Object.keys(entity.schedule||{}).length}日登録`;
 for(let i=0;i<info.weekday;i++){const empty=document.createElement('span');empty.setAttribute('aria-hidden','true');calendar.append(empty);}
 for(const day of PocoCalendar.dates(month)){
  const text=entity.schedule?.[day.date]||'';const button=document.createElement('button');button.type='button';button.className='calendar-day';button.dataset.date=day.date;
  button.classList.toggle('is-sunday',day.weekday===0);button.classList.toggle('is-saturday',day.weekday===6);button.classList.toggle('has-plan',text!=='');
  button.setAttribute('aria-label',`${info.year}年${info.number}月${day.day}日の配信予定`);button.setAttribute('aria-pressed',String(currentEntity.date===day.date));button.title=text||'予定なし';
  const number=document.createElement('span');number.className='day-number';number.textContent=day.day;
  const preview=document.createElement('span');preview.className='day-preview';preview.textContent=text.split('\n')[0];button.append(number,preview);
  button.onclick=()=>{selectEntityDay(day.date);$('entityCalendar').querySelector(`[data-date="${day.date}"]`)?.focus({preventScroll:true});};calendar.append(button);
 }
 const cells=info.weekday+info.days;for(let i=cells;i<Math.ceil(cells/7)*7;i++){const empty=document.createElement('span');empty.setAttribute('aria-hidden','true');calendar.append(empty);}
}
function selectEntityDay(date){
 const entity=entityDetails();if(!entity)return;currentEntity.date=date;
 const day=Number(date.slice(8));const info=PocoCalendar.monthInfo(currentEntity.month);
 $('selectedDayTitle').textContent=`${info.number}月${day}日の予定（自由入力）`;
 $('daySchedule').value=entity.schedule?.[date]||'';renderEntityCalendar();
}
function openEntityPlanner(target){
 currentEntity=target;const entity=entityDetails();$('entityMemo').value=entity?.memo||'';$('plannerStatus').textContent='';resetImageImport(target);
 const japanDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 selectEntityDay(japanDate.startsWith(target.month+'-')?japanDate:target.month+'-01');
 document.querySelector('.entity-breakdown').open=false;
}
function plannerSaved(message=''){
 const stored=save();$('plannerStatus').textContent=stored?(message||'このブラウザに保存しました'):'保存できません。バックアップを保存してください。';
}
$('entityMemo').oninput=()=>{
 const entity=entityDetails(true);if(!entity)return;entity.memo=$('entityMemo').value;
 if(currentEntity.kind==='liver'){
  const index=data.rows.indexOf(entity),input=document.querySelectorAll('#grid .memo input')[index];if(input)input.value=entity.memo;
 }
 plannerSaved();
};
$('daySchedule').oninput=()=>{
 const entity=entityDetails(true);if(!entity||!currentEntity.date)return;
 PocoCalendar.setDay(entity,currentEntity.date,$('daySchedule').value);renderEntityCalendar();plannerSaved();
};
let imageImportRun=0,imageImportAbort=null,imagePreviewUrl=null,imageCandidateRows=[];
function resetImageImport(target=null,keepOpen=false){
 imageImportRun++;imageImportAbort?.abort();imageImportAbort=null;
 if(imagePreviewUrl)URL.revokeObjectURL(imagePreviewUrl);imagePreviewUrl=null;
 $('scheduleImage').value='';$('scheduleImage').disabled=false;$('cancelImageRead').hidden=true;
 $('scheduleImagePreview').hidden=true;$('scheduleImagePreview').removeAttribute('src');$('imageOcrText').value='';
 $('imageImportEntries').replaceChildren();imageCandidateRows=[];$('imageImportReview').hidden=true;$('imageImportStatus').textContent='';$('imageImportMode').value='append';
 if(!keepOpen)$('imageImportPanel').open=false;
 const name=target?(target.kind==='account'?target.table.columns[target.index]:target.row.name):'';
 $('imageImportTarget').textContent=target?`${name} ／ ${target.month} のカレンダーへ取り込みます。`:'';
}
function addImageCandidate(entry={}){
 const index=imageCandidateRows.length+1,container=document.createElement('div');container.className='import-candidate';
 const header=document.createElement('div');header.className='import-candidate-header';
 const label=document.createElement('label'),include=document.createElement('input');include.type='checkbox';include.checked=true;include.setAttribute('aria-label',`候補${index}を反映`);label.append(include,document.createTextNode(String(index)));
 const date=document.createElement('input');date.type='date';date.min=currentEntity.month+'-01';date.max=PocoCalendar.dates(currentEntity.month).at(-1).date;date.value=entry.date||currentEntity.date||date.min;date.setAttribute('aria-label',`候補${index}の日付`);
 const text=document.createElement('textarea');text.rows=2;text.value=entry.text||'';text.setAttribute('aria-label',`候補${index}の予定`);
 const source=document.createElement('small');source.textContent=entry.source||'手入力';header.append(label,date);container.append(header,text,source);$('imageImportEntries').append(container);
 imageCandidateRows.push({include,date,text});$('imageImportReview').hidden=false;
}
function showImageCandidates(result){
 $('imageImportEntries').replaceChildren();imageCandidateRows=[];result.entries.forEach(addImageCandidate);$('imageImportReview').hidden=false;
 $('imageImportStatus').textContent=(result.entries.length?`${result.entries.length}日分の候補を読み取りました。内容を確認してください。`:'予定の日付を読み取れませんでした。下の読み取り文字を修正して「候補を更新」するか、予定を追加できます。')+(result.warnings.length?'\n'+result.warnings.join('\n'):'');
}
$('scheduleImage').onchange=async event=>{
 const file=event.target.files?.[0],target=currentEntity;if(!file||!target||!target.isCurrent()||!$('coinDialog').open)return;
 resetImageImport(target,true);const run=imageImportRun;
 if(file.size>20*1024*1024||file.type&&!/^image\/(png|jpeg|webp|gif|bmp|avif|heic|heif)$/i.test(file.type)){$('imageImportStatus').textContent='20MB以下のJPEG・PNGなどの画像を選択してください。';return;}
 const controller=new AbortController();imageImportAbort=controller;$('scheduleImage').disabled=true;$('cancelImageRead').hidden=false;
 imagePreviewUrl=URL.createObjectURL(file);$('scheduleImagePreview').src=imagePreviewUrl;$('scheduleImagePreview').hidden=false;
 $('imageImportStatus').textContent='画像を読み取っています。初回は準備に少し時間がかかります。';
 try{
  const result=await PocoOcr.readImage(file,{signal:controller.signal,month:target.month,onProgress:event=>{if(run!==imageImportRun)return;$('imageImportStatus').textContent=event.status==='recognizing text'?`画像を読み取り中… ${Math.round(event.progress*100)}%`:'読み取りの準備中…（初回は少し時間がかかります）';}});
  if(run!==imageImportRun||currentEntity!==target||!target.isCurrent()||!$('coinDialog').open)return;
  $('imageOcrText').value=result.text||'';showImageCandidates(PocoImageImport.extract(result,target.month));
 }catch(error){if(run===imageImportRun)$('imageImportStatus').textContent=error.name==='AbortError'?'読み取りを中止しました。':`読み取れませんでした。${/[ぁ-んァ-ヶ一-龯]/.test(error.message||'')?error.message:'通信状態と画像を確認して、もう一度お試しください。'}`;}
 finally{if(run===imageImportRun){$('scheduleImage').disabled=false;$('cancelImageRead').hidden=true;imageImportAbort=null;}}
};
$('cancelImageRead').onclick=()=>{imageImportRun++;imageImportAbort?.abort();imageImportAbort=null;$('scheduleImage').disabled=false;$('cancelImageRead').hidden=true;$('imageImportStatus').textContent='読み取りを中止しました。';};
$('reparseImageText').onclick=()=>{if(currentEntity&&currentEntity.isCurrent())showImageCandidates(PocoImageImport.parseText($('imageOcrText').value,currentEntity.month));};
$('addImageCandidate').onclick=()=>{if(currentEntity&&currentEntity.isCurrent())addImageCandidate();};
$('applyImagePlans').onclick=()=>{
 const existing=entityDetails();if(!existing||!$('coinDialog').open)return;
 try{
  const entries=imageCandidateRows.filter(row=>row.include.checked).map(row=>({date:row.date.value,text:row.text.value}));
  const next=PocoImageImport.merge(existing.schedule||{},entries,currentEntity.month,$('imageImportMode').value);
  const target=entityDetails(true);if(!target)return;target.schedule=next;
  const first=entries.map(row=>row.date).sort()[0];selectEntityDay(first);plannerSaved(`画像から${new Set(entries.map(row=>row.date)).size}日分の予定を反映しました。共有する場合は「共有先に保存」を押してください。`);$('imageImportPanel').open=false;
 }catch(error){$('imageImportStatus').textContent=error.message;}
};
$('coinDialog').addEventListener('close',()=>{if(!$('coinDialog').open)resetImageImport();});
$('coinDialogClose').onclick=()=>$('coinDialog').close();
let scheduleRow=null;
function showSchedule(row){
 scheduleRow=row;$('scheduleTitle').textContent=`${row.name}の日程`;
 $('closingTimeInput').value=row.closingTime||'';$('releaseDateInput').value=PocoRows.formatRelease(row.releaseDate,book.currentMonth);
 $('scheduleDialog').showModal();
}
function scheduleField(row,field,label){
 const button=document.createElement('button');button.type='button';button.className='schedule-field';button.setAttribute('aria-label',`${row.name}の${label}`);button.title=field==='releaseDate'?PocoRows.formatRelease(row[field],book.currentMonth):row[field]||'';
 const value=button.title;
 button.textContent=value;
 button.onclick=()=>showSchedule(row);return button;
}
$('scheduleClose').onclick=()=>$('scheduleDialog').close();
$('scheduleDialog').addEventListener('close',()=>{scheduleRow=null;});
$('scheduleForm').onsubmit=event=>{
 event.preventDefault();if(!scheduleRow||!data.rows.includes(scheduleRow))return;
 document.activeElement?.blur();
 scheduleRow.closingTime=$('closingTimeInput').value.trim();scheduleRow.releaseDate=PocoRows.formatRelease($('releaseDateInput').value,book.currentMonth);rowSort={field:null,direction:1,month:book.currentMonth};save();render();
};
function render(){
 clearRowDrag();
 if(rowSort.month!==book.currentMonth)rowSort={field:null,direction:1,month:book.currentMonth};
 closeCheerPicker();
 if($('coinDialog').open)$('coinDialog').close();
 if($('scheduleDialog').open)$('scheduleDialog').close();
 const table=$('grid');table.replaceChildren();const head=table.createTHead().insertRow();
 cell(head,'th').textContent='ライバー名';
 sortHeader(head,'closingTime','締め時間','closing-col');sortHeader(head,'releaseDate','解禁日','release-col');
 data.columns.forEach((c,j)=>{
  const th=cell(head,'th');th.append(nameControls(c,'アカウント',()=>showCoinDialog('account',j)));
 });
 cell(head,'th','extra-col').textContent='合計（K）';cell(head,'th','extra-col').textContent='必要コイン';cell(head,'th','extra-col').textContent='メモ';
 const body=table.createTBody();
 data.rows.forEach((r,i)=>{
  const tr=body.insertRow();const nameCell=cell(tr,'td','name');nameCell.append(nameControls(r.name,'ライバー',()=>showCoinDialog('liver',i)));attachRowDrag(nameCell.querySelector('button'),r,tr);
  cell(tr,'td','closing-col').append(scheduleField(r,'closingTime','締め時間'));cell(tr,'td','release-col').append(scheduleField(r,'releaseDate','解禁日'));
  r.values.forEach((v,j)=>{
   const td=cell(tr);td.append(cheerSelect(v,`${r.name}・${data.columns[j]}`,v=>r.values[j]=v));
  });
  const total=cell(tr,'td','total extra-col');total.dataset.row=i;
  const coins=cell(tr,'td','total coin-total extra-col');coins.dataset.coinRow=i;
  cell(tr,'td','memo extra-col').append(input(r.memo,`${r.name}のメモ`,v=>r.memo=v));
 });
 stats();requestAnimationFrame(fitTableViewport);
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

function fitTableViewport(){
 const wrap=$('grid').parentElement;
 if(!window.matchMedia('(max-width:700px), (max-height:500px) and (max-width:1000px)').matches){wrap.style.maxHeight='';wrap.style.minHeight='';return;}
 const top=wrap.getBoundingClientRect().top+window.scrollY;const viewportHeight=Math.max(window.innerHeight,document.documentElement.clientHeight);
 const available=Math.max(96,viewportHeight-top-64);
 wrap.style.maxHeight=available+'px';wrap.style.minHeight=Math.min(120,available)+'px';
}
// Phone keyboards can finish closing after the dialog's render and only emit
// visualViewport events. Re-measure after that animation, rather than keeping
// the temporary keyboard-sized table until the next window resize.
let tableViewportTimer;
function refreshTableViewport(){
 requestAnimationFrame(fitTableViewport);
 clearTimeout(tableViewportTimer);
 tableViewportTimer=setTimeout(()=>requestAnimationFrame(fitTableViewport),350);
}
window.addEventListener('resize',refreshTableViewport);
window.addEventListener('pageshow',refreshTableViewport);
window.visualViewport?.addEventListener('resize',refreshTableViewport);
window.visualViewport?.addEventListener('scroll',refreshTableViewport);
document.addEventListener('focusout',refreshTableViewport);
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',refreshTableViewport));
const tableViewportObserver=new ResizeObserver(()=>requestAnimationFrame(fitTableViewport));
for(const selector of ['header','.page-title','.shared-panel','.cards','.table-bar'])tableViewportObserver.observe(document.querySelector(selector));
const toolsMenu=document.querySelector('.table-tools');
function positionToolsMenu(){
 if(!toolsMenu.open)return;const menu=toolsMenu.querySelector('.toolbar');const anchor=toolsMenu.querySelector('summary').getBoundingClientRect();
 const width=menu.getBoundingClientRect().width;const top=Math.max(8,Math.min(anchor.bottom+5,window.innerHeight-130));
 menu.style.left=Math.max(8,Math.min(anchor.left,window.innerWidth-width-8))+'px';menu.style.top=top+'px';menu.style.maxHeight=Math.max(80,window.innerHeight-top-8)+'px';
}
toolsMenu.addEventListener('toggle',positionToolsMenu);window.addEventListener('resize',positionToolsMenu);window.addEventListener('scroll',event=>{if(!toolsMenu.querySelector('.toolbar').contains(event.target))positionToolsMenu();},true);
$('addRow').onclick=()=>{data.rows.push({name:'新しいライバー',memo:'',values:data.columns.map(()=>'')});save();render();};
$('addCol').onclick=()=>{if(data.columns.length>=100)return alert('アカウントは100列までです。');data.columns.push('新しいアカウント');if(data.accountDetails)data.accountDetails.push({memo:'',schedule:{}});data.rows.forEach(r=>r.values.push(''));save();render();};
$('metric').onchange=stats;
$('tableMode').onclick=()=>{const expanded=$('tablePanel').classList.toggle('table-detail');$('tableMode').setAttribute('aria-pressed',String(expanded));$('tableMode').textContent=expanded?'一覧に戻る':'編集・詳細';};
$('refresh').onclick=()=>{try{localStorage.setItem(KEY,JSON.stringify(book));location.reload();}catch{$('status').textContent='保存できないため更新を中止しました。バックアップを保存してください。';}};
function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download').onclick=()=>download(JSON.stringify(book,null,2),'application/json','pocolog-backup.json');
$('upload').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>10000000)throw Error();const next=JSON.parse(await f.text());if(!validBook(next)&&!valid(next,book.currentMonth))throw Error();if(confirm('全月の記録をバックアップの内容で置き換えますか？')){book=validBook(next)?next:{version:2,currentMonth:book.currentMonth,months:{[book.currentMonth]:next}};addMoeAccount();PocoRows.addExtraAccounts(book);addPhotoLivers();rowSort={field:null,direction:1,month:book.currentMonth};data=book.months[book.currentMonth];$('month').value=book.currentMonth;save();render();}}catch{alert('読み込めませんでした。ポコログのJSONバックアップを選択してください。');}e.target.value='';};
$('csv').onclick=()=>{const quote=s=>'"'+String(s).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';const rows=[['ライバー名','締め時間','解禁日',...data.columns,'エール合計（K）','必要コイン（換算済み分）','未算定セル数','メモ'],...data.rows.map(r=>{const total=measure(r.values);return [r.name,r.closingTime||'',PocoRows.formatRelease(r.releaseDate,book.currentMonth),...r.values,total.number,total.coins,total.unknown,r.memo];})];download('\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8','pocolog.csv');};
const reference=$('coinReference');const referenceHead=reference.createTHead().insertRow();
cell(referenceHead,'th').textContent='エール（K）';cell(referenceHead,'th').textContent='必要コイン（条件1）';
const referenceBody=reference.createTBody();PocoCoins.tiers.forEach(([level,coins])=>{const row=referenceBody.insertRow();cell(row).textContent=fmt(level);cell(row).textContent=fmt(coins);});
render();

window.pocolog = {
 getBook:()=>structuredClone(book), validBook,
 setBook(next){
  if(!validBook(next))throw Error('共有データの形式を確認できません。');
  const selected=book.currentMonth;
  book=structuredClone(next);const migrated=PocoRows.addExtraAccounts(book);rowSort={field:null,direction:1,month:book.currentMonth};
  if(book.months[selected])book.currentMonth=selected;
  data=book.months[book.currentMonth];$('month').value=book.currentMonth;
  save(false);render();return migrated;
 },
 setEditing(enabled){if(!enabled){clearRowDrag();closeCheerPicker();}document.querySelectorAll('#grid input,#grid select,#grid button,#addRow,#addCol,#upload,#month').forEach(el=>el.disabled=!enabled);document.querySelectorAll('#grid .sort-label').forEach(el=>{el.setAttribute('aria-disabled',String(!enabled));el.tabIndex=enabled?0:-1;});},
 downloadBackup:(backup=book)=>download(JSON.stringify(backup,null,2),'application/json','pocolog-unsynced-backup.json')
};
