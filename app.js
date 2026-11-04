const KEY = 'pocolog.v1';
const photoLivers = ['どんちゃん','かつにぃ','ともちゃん','あすぽん','むぎたん','しーたま','れなぴ','ラピママ','武井','こたちゃま','みさき','EMMA','猫','あおいちゃん','おはぎ','スパたん','たぁ坊','アルちゃん','スピカちゃん'];
const initial = {columns:['こじ','こた','もえ','寿司','イカ','焼肉','ケン','ガヤ','お餅','アラン','シオン','レオン','ヨシ','海斗','レオ'],rows:[]};
const $ = id => document.getElementById(id);
let data, book;
function valid(d,month){return d && Array.isArray(d.columns) && d.columns.length<=100 && d.columns.every(c=>typeof c==='string') && Array.isArray(d.rows) && d.rows.length<=10000 && d.rows.every(r=>typeof r.name==='string' && typeof r.memo==='string' && (r.closingTime===undefined||typeof r.closingTime==='string') && (r.releaseDate===undefined||typeof r.releaseDate==='string') && Array.isArray(r.values) && r.values.length===d.columns.length && r.values.every(v=>typeof v==='string') && PocoCalendar.validSchedule(r.schedule,month) && PocoCalendar.validActuals(r.actuals,month) && PocoCalendar.validPairActuals(r,d.columns,month)) && PocoCalendar.validAccounts(d,month);}
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
  month.rows.forEach(row=>{row.values.splice(kota+1,0,'');if(row.pairActuals)row.pairActuals.splice(kota+1,0,null);});
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
let monthView='goal',gridEditingEnabled=true;
try{const stored=localStorage.getItem('pocolog.month-view.v1');if(['goal','actual','time'].includes(stored))monthView=stored;}catch{}
function setMonthView(view){
 if(!['goal','actual','time'].includes(view)||monthView===view)return;
 monthView=view;try{localStorage.setItem('pocolog.month-view.v1',view);}catch{}
 render();
}
let focusedAccount=null,roomyView=false;
try{roomyView=localStorage.getItem('pocolog.roomy-view.v1')==='1';}catch{}
function setFocusedAccount(index){
 focusedAccount=index;closeCheerPicker();closeScheduleEditor();applyAccountView();$('grid').parentElement.scrollLeft=0;$('viewControls').open=false;
 $('viewControlsSummary').focus({preventScroll:true});requestAnimationFrame(fitTableViewport);
}
$('backToAllAccounts').onclick=()=>setFocusedAccount(null);
function applyAccountView(){
 if(focusedAccount!==null&&(focusedAccount<0||focusedAccount>=data.columns.length))focusedAccount=null;
 const focused=focusedAccount!==null,panel=$('tablePanel');panel.classList.toggle('account-focused',focused);panel.classList.toggle('roomy-view',roomyView);
 $('grid').style.setProperty('--account-count',focused?1:data.columns.length);
 for(const row of $('grid').rows)for(let j=0;j<data.columns.length;j++)if(row.cells[j+3])row.cells[j+3].hidden=focused&&j!==focusedAccount;
 $('viewControlsSummary').textContent=focused?`表示：${data.columns[focusedAccount]}`:'表示';
 $('roomyView').setAttribute('aria-pressed',String(roomyView));$('backToAllAccounts').hidden=!focused;$('timeViewNote').textContent=focused&&!roomyView?'日数 ／ 時間（時:分）　各欄を押して編集':'上：日数 ／ 下：時間（時:分）　各欄を押して編集';
 const choices=$('accountViewChoices');choices.replaceChildren();
 for(const [index,name] of [[null,'全アカウント'],...data.columns.map((name,index)=>[index,name])]){
  const button=document.createElement('button');button.type='button';button.textContent=name;button.setAttribute('aria-pressed',String(focusedAccount===index));button.onclick=()=>setFocusedAccount(index);choices.append(button);
 }
}
$('roomyView').onclick=()=>{roomyView=!roomyView;try{localStorage.setItem('pocolog.roomy-view.v1',roomyView?'1':'0');}catch{}applyAccountView();$('viewControls').open=false;$('viewControlsSummary').focus();requestAnimationFrame(fitTableViewport);};
$('viewControls').addEventListener('toggle',()=>{if($('viewControls').open)$('colorControls').open=false;});
$('colorControls').addEventListener('toggle',()=>{if($('colorControls').open)$('viewControls').open=false;});
document.addEventListener('click',event=>{if(!$('viewControls').contains(event.target))$('viewControls').open=false;});
$('viewControls').addEventListener('keydown',event=>{if(event.key==='Escape'){$('viewControls').open=false;$('viewControlsSummary').focus();event.preventDefault();}});
$('monthViewGoal').onclick=()=>setMonthView('goal');$('monthViewActual').onclick=()=>setMonthView('actual');$('monthViewTime').onclick=()=>setMonthView('time');
function paintPairActualCell(button,pair){
 button.classList.toggle('has-pair-time',Object.keys(pair?.actuals||{}).length>0);
 if(monthView!=='time'){button.textContent=pair?.cheerK==null?'':fmt(pair.cheerK);return;}
 const total=PocoCalendar.actualTotals(pair);button.replaceChildren();
 if(!total.records){button.setAttribute('aria-description','日数・時間は未記録です');return;}
 const days=document.createElement('span'),time=document.createElement('span');days.className='pair-time-days';time.className='pair-time-duration';days.textContent=total.days+'日';time.textContent=total.timeRecords?`${Math.floor(total.minutes/60)}:${String(total.minutes%60).padStart(2,'0')}`:'未入力';button.append(days,time);
 button.setAttribute('aria-description',`${total.days}日、${total.timeRecords?`${Math.floor(total.minutes/60)}時間${total.minutes%60}分`:'時間は未記録'}`);
}
function refreshActualGrid(){
 if(monthView==='goal')return;
 data.rows.forEach((row,index)=>{const tr=$('grid').tBodies[0]?.rows[index];if(!tr)return;
  for(const button of tr.querySelectorAll('[data-actual-account]'))paintPairActualCell(button,PocoCalendar.pairDetails(data,row,Number(button.dataset.actualAccount)));
 });
}
$('month').value=book.currentMonth;
const clockFormat=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
let releaseTodayDate='';
const rowHighlights={release:'today',achievement:'none'};
try{const stored=JSON.parse(localStorage.getItem('pocolog.row-highlights.v1')||'null');if(stored){if(['none','after','today','before'].includes(stored.release))rowHighlights.release=stored.release;if(['none','met','unmet'].includes(stored.achievement))rowHighlights.achievement=stored.achievement;}}catch{}
function setRowHighlights(group,value){
 rowHighlights[group]=value;try{localStorage.setItem('pocolog.row-highlights.v1',JSON.stringify(rowHighlights));}catch{}
 $('colorControls').open=false;applyRowHighlights();$('colorControls').querySelector('summary').focus({preventScroll:true});
}
for(const button of document.querySelectorAll('[data-release-highlight]'))button.onclick=()=>setRowHighlights('release',button.dataset.releaseHighlight);
for(const button of document.querySelectorAll('[data-achievement-highlight]'))button.onclick=()=>setRowHighlights('achievement',button.dataset.achievementHighlight);
$('clearRowHighlights').onclick=()=>{rowHighlights.release='none';setRowHighlights('achievement','none');};
document.addEventListener('click',event=>{const controls=$('colorControls');if(controls.open&&!controls.contains(event.target))controls.open=false;});
document.addEventListener('keydown',event=>{const controls=$('colorControls');if(event.key==='Escape'&&controls.open&&controls.contains(document.activeElement)){event.preventDefault();controls.open=false;controls.querySelector('summary').focus({preventScroll:true});}});
function applyRowHighlights(date=releaseTodayDate){
 const rows=$('grid').tBodies[0]?.rows;if(!rows)return;
 const counts={after:0,today:0,before:0,met:0,unmet:0};
 const releaseLabels={after:'解禁後',today:'本日解禁',before:'解禁前'};
 data.rows.forEach((row,index)=>{
  const tr=rows[index];if(!tr)return;
  const release=PocoRows.releaseState(row.releaseDate,book.currentMonth,date),achievement=PocoRows.achievementState(row);
  row.values.forEach((value,account)=>{
   const td=tr.cells[account+3];if(!td)return;
   const actual=row.pairActuals?.[account]?.cheerK,met=monthView!=='time'&&PocoRows.targetState(value,actual)==='met';
   if(met)td.dataset.goalMet='true';else delete td.dataset.goalMet;
   const button=td.querySelector('button');if(button&&monthView!=='time'){if(met)button.setAttribute('aria-description',`目標 ${value} K 達成済（実績 ${actual} K）`);else button.removeAttribute('aria-description');}
  });
  if(release)counts[release]++;if(achievement.state)counts[achievement.state]++;
  const releaseMatch=release&&rowHighlights.release===release,achievementMatch=achievement.state&&rowHighlights.achievement===achievement.state;
  tr.classList.toggle('release-today',Boolean(releaseMatch&&release==='today'));
  if(releaseMatch)tr.dataset.releaseMatch=release;else delete tr.dataset.releaseMatch;
  if(achievementMatch)tr.dataset.achievementMatch=achievement.state;else delete tr.dataset.achievementMatch;
  const description=[releaseMatch?releaseLabels[release]:'',achievementMatch?`${achievement.state==='met'?'目標達成済':'目標未達成'}（${achievement.completed}/${achievement.targets}アカウント達成）`:''].filter(Boolean).join('、');
  const name=tr.querySelector('td.name .name-trigger');if(name){
   let badge=name.querySelector('.achievement-badge');
   if(!badge){const label=document.createElement('span');label.className='liver-name-text';label.textContent=row.name||'（未設定）';badge=document.createElement('span');badge.className='achievement-badge';badge.textContent='済';badge.title='数値目標のある全アカウントで達成済';badge.setAttribute('aria-hidden','true');name.replaceChildren(label,badge);}
   const met=achievement.state==='met';badge.hidden=!met;
   if(met)name.closest('td').dataset.allGoalsMet='true';else delete name.closest('td').dataset.allGoalsMet;
   const fullDescription=[description,met&&!achievementMatch?'数値目標のある全アカウントで目標達成済':''].filter(Boolean).join('、');
   if(fullDescription)name.setAttribute('aria-description',fullDescription);else name.removeAttribute('aria-description');
  }
  const button=tr.querySelector('.release-col button');if(button){button.title=PocoRows.formatRelease(row.releaseDate,book.currentMonth)+(release?'（'+releaseLabels[release]+'）':'');if(release==='today')button.setAttribute('aria-description','本日が解禁日です（日本時間）');else button.removeAttribute('aria-description');}
 });
 for(const button of document.querySelectorAll('[data-release-highlight],[data-achievement-highlight]')){const group=button.dataset.releaseHighlight!==undefined?'release':'achievement',value=button.dataset.releaseHighlight??button.dataset.achievementHighlight;button.setAttribute('aria-pressed',String(rowHighlights[group]===value));const count=button.querySelector('.highlight-count');if(count)count.textContent=counts[value];}
 $('highlightActiveCount').textContent=Number(rowHighlights.release!=='none')+Number(rowHighlights.achievement!=='none');
}
function updateCurrentDateTime(){
 const now=new Date();const parts=Object.fromEntries(clockFormat.formatToParts(now).map(part=>[part.type,part.value]));
 $('currentDateTime').dateTime=now.toISOString();
 $('currentDate').textContent=`${parts.year}/${parts.month}/${parts.day}`;
 $('currentTime').textContent=`${parts.hour}:${parts.minute}:${parts.second}`;
 const date=`${parts.year}-${parts.month}-${parts.day}`;
 if(date!==releaseTodayDate){releaseTodayDate=date;applyRowHighlights(date);}
}
updateCurrentDateTime();setInterval(updateCurrentDateTime,1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateCurrentDateTime();});
window.addEventListener('pageshow',updateCurrentDateTime);
$('month').onchange=()=>{const m=$('month').value;if(!monthValid(m))return;const created=!book.months[m];if(created)book.months[m]={columns:[...data.columns],rows:data.rows.map(r=>({name:r.name,memo:'',closingTime:r.closingTime||'',releaseDate:'',values:data.columns.map(()=>'')}))};book.currentMonth=m;data=book.months[m];save(created);render();};
const monthly=document.createElement('section');monthly.className='panel';monthly.style.marginTop='24px';const monthlyTitle=document.createElement('h2');monthlyTitle.textContent='月別の実績（K）';const monthlyBars=document.createElement('div');monthlyBars.id='monthly';monthly.append(monthlyTitle,monthlyBars);$('summaryContent').append(monthly);
const actualSummary=document.createElement('section');actualSummary.className='panel';actualSummary.style.marginTop='12px';const actualTitle=document.createElement('h2');actualTitle.textContent='ライバー別の獲得実績';const actualWrap=document.createElement('div');actualWrap.className='table-wrap';const actualTable=document.createElement('table');actualTable.id='actualSummaryTable';actualTable.className='summary-table';actualTable.setAttribute('aria-label','記録月のライバー別獲得実績');actualWrap.append(actualTable);const pairWrap=document.createElement('div');pairWrap.className='table-wrap';const pairTable=document.createElement('table');pairTable.id='pairSummaryTable';pairTable.className='summary-table';pairWrap.append(pairTable);const legacy=document.createElement('details');legacy.className='entity-breakdown';const legacyLabel=document.createElement('summary');legacyLabel.textContent='以前のライバー単位の記録';legacy.append(legacyLabel,actualWrap);actualTitle.textContent='アカウント別の獲得実績';actualSummary.append(actualTitle,pairWrap,legacy);$('summaryContent').append(actualSummary);
function measure(values){const counts=values.reduce((a,v)=>{const s=v.trim();if(s){a.filled++;if(/^[○〇◯]$/.test(s))a.circle++;else if(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)){const n=Number(s);if(Number.isFinite(n)&&Number.isFinite(a.number+n))a.number+=n;}}return a;},{number:0,circle:0,filled:0});return {...counts,...PocoCoins.summarize(values)};}
const fmt=n=>n.toLocaleString('ja-JP',{maximumFractionDigits:10});
function save(edited=true){let stored=false;try{localStorage.setItem(KEY,JSON.stringify(book));if(edited)localStorage.setItem('pocolog.pending.v1','1');$('status').textContent='このブラウザに保存済み';stored=true;}catch{$('status').textContent='保存できません。バックアップを保存してください。';}if(edited)window.dispatchEvent(new Event('pocolog:edit'));return stored;}
function input(value,label,onchange){const el=document.createElement('input');el.value=value;el.setAttribute('aria-label',label);el.addEventListener('input',()=>{onchange(el.value);save();stats();});return el;}
function cell(row,tag='td',cls=''){const el=document.createElement(tag);el.className=cls;row.append(el);return el;}
const cheerPicker=document.createElement('div');cheerPicker.id='cheerPicker';cheerPicker.className='cheer-picker';cheerPicker.setAttribute('popover','auto');cheerPicker.setAttribute('role','group');cheerPicker.setAttribute('aria-label','エール数を選択');document.body.append(cheerPicker);
let activeCheer=null;
function clearCheerHighlight(){document.querySelectorAll('#grid .active-cheer-row,#grid .active-cheer-account').forEach(el=>el.classList.remove('active-cheer-row','active-cheer-account'));}
function highlightCheer(trigger){
 const td=trigger.closest('td'),row=td?.parentElement;if(!row)return;
 row.classList.add('active-cheer-row');$('grid').tHead?.rows[0].cells[td.cellIndex]?.classList.add('active-cheer-account');
}
function closeCheerPicker(restoreFocus=false){
 if(!activeCheer)return;const trigger=activeCheer;activeCheer=null;clearCheerHighlight();trigger.setAttribute('aria-expanded','false');
 if(cheerPicker.matches(':popover-open'))cheerPicker.hidePopover();
 if(restoreFocus&&trigger.isConnected)trigger.focus({preventScroll:true});
}
cheerPicker.addEventListener('toggle',event=>{if(event.newState==='closed'&&activeCheer){activeCheer.setAttribute('aria-expanded','false');activeCheer=null;clearCheerHighlight();}});
function visibleViewport(){
 const view=window.visualViewport;
 return {left:view?.offsetLeft||0,top:view?.offsetTop||0,width:view?.width||window.innerWidth,height:view?.height||window.innerHeight};
}
function positionCheerPicker(){
 if(!activeCheer)return;
 const rect=activeCheer.getBoundingClientRect(),view=visibleViewport();
 const maxHeight=Math.min(300,view.height-16),width=Math.min(220,view.width-16);
 cheerPicker.style.width=width+'px';cheerPicker.style.maxHeight=maxHeight+'px';
 cheerPicker.style.left=Math.max(view.left+8,Math.min(rect.left,view.left+view.width-width-8))+'px';
 const below=view.top+view.height-rect.bottom-8,above=rect.top-view.top-8;
 const top=below>=maxHeight||below>=above?rect.bottom+4:rect.top-maxHeight-4;
 cheerPicker.style.top=Math.max(view.top+8,Math.min(top,view.top+view.height-maxHeight-8))+'px';
}
window.visualViewport?.addEventListener('resize',positionCheerPicker);
window.visualViewport?.addEventListener('scroll',positionCheerPicker);
window.addEventListener('resize',positionCheerPicker);
window.addEventListener('scroll',event=>{if(event.target!==cheerPicker&&!cheerPicker.contains(event.target))positionCheerPicker();},true);
function cheerSelect(value,label,onchange){
 const trigger=document.createElement('button');trigger.type='button';trigger.className='cheer-field';trigger.setAttribute('role','combobox');trigger.setAttribute('aria-label',label);trigger.setAttribute('aria-controls','cheerChoices');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
 trigger.textContent=/^[○〇◯]$/.test(value.trim())?'〇':value;
 function open(){
  if(trigger.disabled)return;
  if(activeCheer===trigger){closeCheerPicker(true);return;}
  closeCheerPicker();activeCheer=trigger;cheerPicker.replaceChildren();highlightCheer(trigger);
  const context=document.createElement('div');context.className='cheer-picker-context';
  const heading=document.createElement('div');heading.className='cheer-picker-heading';const title=document.createElement('span');title.textContent=label;
  const close=document.createElement('button');close.type='button';close.textContent='閉じる';close.setAttribute('aria-label','エール選択を閉じる');close.onclick=()=>closeCheerPicker(true);heading.append(title,close);
  const jumps=document.createElement('div');jumps.className='cheer-picker-jumps';jumps.setAttribute('role','group');jumps.setAttribute('aria-label','数字の範囲へ移動');
  for(const start of [1,13,25,37]){const jump=document.createElement('button');jump.type='button';jump.textContent=`${start}〜${start+11}`;jump.onclick=()=>{const option=options[start+1];option.focus({preventScroll:true});cheerPicker.scrollTop+=option.getBoundingClientRect().top-context.getBoundingClientRect().bottom-4;};jumps.append(jump);}
  context.append(heading,jumps);const list=document.createElement('div');list.id='cheerChoices';list.setAttribute('role','listbox');list.setAttribute('aria-label',label+'のエール数');cheerPicker.append(context,list);
  const choices=['','〇',...Array.from({length:48},(_,i)=>String(i+1))];
  const options=choices.map((choice,index)=>{
   const option=document.createElement('button');option.type='button';option.setAttribute('role','option');option.setAttribute('aria-selected',String(index===0));option.tabIndex=-1;option.textContent=choice;if(choice==='')option.setAttribute('aria-label','空欄');
   option.onfocus=()=>options.forEach(item=>item.setAttribute('aria-selected',String(item===option)));
   option.onclick=()=>{trigger.textContent=choice;onchange(choice);save();stats();closeCheerPicker(true);};
   list.append(option);return option;
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

let lastCheerEdit=null;
function canUndoCheer(){
 const edit=lastCheerEdit;
 return edit&&edit.table===data&&data.rows.includes(edit.row)&&data.columns.length===edit.columns.length&&data.columns.every((name,index)=>name===edit.columns[index])&&data.columns[edit.index]===edit.account&&edit.row.values[edit.index]===edit.next;
}
function dismissCheerUndo(){lastCheerEdit=null;$('cheerUndoBar').hidden=true;}
function changeCheer(row,index,next){
 const previous=row.values[index];if(previous===next)return;
 row.values[index]=next;lastCheerEdit={table:data,row,index,account:data.columns[index],columns:[...data.columns],previous,next};
 $('cheerUndoMessage').textContent=`${row.name}・${data.columns[index]}：${next||'空欄'}に変更`;
 $('cheerUndoBar').hidden=false;
}
$('dismissCheerUndo').onclick=dismissCheerUndo;
$('undoCheer').onclick=()=>{
 if(!canUndoCheer()){dismissCheerUndo();return;}
 const edit=lastCheerEdit;edit.row.values[edit.index]=edit.previous;dismissCheerUndo();save();render();
 $('orderStatus').textContent=`${edit.row.name}・${edit.account}の入力を元に戻しました`;
};
const normalizeSearch=value=>value.normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/[ァ-ヶ]/g,char=>String.fromCharCode(char.charCodeAt(0)-0x60)).trim();
let foundLiverTimer;
function showLiverSearchResults(){
 const query=normalizeSearch($('liverSearch').value);const matches=data.rows.filter(row=>normalizeSearch(row.name).includes(query));
 $('liverSearchCount').textContent=matches.length?`${matches.length}人 ／ 名前を押すと一覧へ移動`:'該当するライバーがいません';
 $('liverSearchResults').replaceChildren();
 for(const row of matches){
  const button=document.createElement('button');button.type='button';button.textContent=row.name||'（未設定）';
  button.onclick=()=>{
   const index=data.rows.indexOf(row);if(index<0)return;
   $('findLiverDialog').close();const tr=$('grid').tBodies[0]?.rows[index];if(!tr)return;
   const wrap=$('grid').parentElement;wrap.scrollTop+=tr.getBoundingClientRect().top-wrap.getBoundingClientRect().top-$('grid').tHead.getBoundingClientRect().height;
   document.querySelectorAll('#grid .found-liver').forEach(el=>el.classList.remove('found-liver'));tr.classList.add('found-liver');clearTimeout(foundLiverTimer);foundLiverTimer=setTimeout(()=>tr.classList.remove('found-liver'),2500);
   tr.querySelector('.name-trigger').focus({preventScroll:true});$('orderStatus').textContent=`${row.name}へ移動しました`;
  };$('liverSearchResults').append(button);
 }
}
$('findLiver').onclick=()=>{
 closeCheerPicker();$('liverSearch').value='';showLiverSearchResults();updateOverlayViewport();$('findLiverDialog').showModal();$('findLiverDialog').scrollTop=0;$('liverSearch').focus({preventScroll:true});
};
$('findLiverClose').onclick=()=>$('findLiverDialog').close();
$('liverSearch').oninput=showLiverSearchResults;
$('liverSearch').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('liverSearchResults').querySelector('button')?.click();}});
function revealGridRow(index){
 const table=$('grid'),wrap=table.parentElement,row=table.tBodies[0]?.rows[index];if(!row)return;
 const bounds=wrap.getBoundingClientRect(),rect=row.getBoundingClientRect(),header=table.tHead.getBoundingClientRect().height;
 if(rect.top<bounds.top+header)wrap.scrollTop-=bounds.top+header-rect.top;
 else if(rect.bottom>bounds.bottom)wrap.scrollTop+=rect.bottom-bounds.bottom;
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
 revealGridRow(to);document.querySelectorAll('#grid tbody .name-trigger')[to]?.focus({preventScroll:true});
}
function sortLivers(field){
 const direction=rowSort.field===field&&rowSort.month===book.currentMonth?-rowSort.direction:1;
 rowSort={field,direction,month:book.currentMonth};const ordered=PocoRows.sortRows(data.rows,field,direction,book.currentMonth);
 const changed=ordered.some((row,index)=>row!==data.rows[index]);data.rows=ordered;if(changed)save();render();
 $('grid').parentElement.scrollTop=0;$('grid').parentElement.scrollLeft=0;
 $('orderStatus').textContent=`${field==='closingTime'?'締め':'解禁日'}の${direction===1?'早い':'遅い'}順に並び替えました。未定・空欄は末尾です。`;
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
 button.title=`${row.name}：タップで合計、長押しして順番を移動（マウスはドラッグ、Alt＋↑↓でも移動）`;
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
  rowDrag={button,row,pointerId:event.pointerId,pointerType:event.pointerType,startScrollTop:$('grid').parentElement.scrollTop,scrolling:false,startY:event.clientY,x:event.clientX,y:event.clientY,dragging:false,target:row,after:false};
  button.setPointerCapture(event.pointerId);rowDrag.timer=setTimeout(begin,300);
 };
 button.onpointermove=event=>{
  if(!rowDrag||rowDrag.pointerId!==event.pointerId)return;
  rowDrag.x=event.clientX;rowDrag.y=event.clientY;
  if(rowDrag.pointerType==='touch'&&!rowDrag.dragging&&(rowDrag.scrolling||Math.abs(event.clientY-rowDrag.startY)>8)){
   clearTimeout(rowDrag.timer);rowDrag.scrolling=true;
   $('grid').parentElement.scrollTop=rowDrag.startScrollTop+rowDrag.startY-event.clientY;event.preventDefault();return;
  }
  if(rowDrag.pointerType!=='touch'&&Math.abs(event.clientY-rowDrag.startY)>6)begin();
  if(rowDrag.dragging){event.preventDefault();updateDrop();}
 };
 button.onpointerup=event=>{
  if(!rowDrag||rowDrag.pointerId!==event.pointerId)return;const drag=rowDrag;const rect=$('grid').parentElement.getBoundingClientRect();const inside=event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom;
  const from=data.rows.indexOf(drag.row),target=data.rows.indexOf(drag.target);let to=target+(drag.after?1:0);if(from<to)to--;
  clearRowDrag();if(drag.dragging||drag.scrolling){event.preventDefault();suppressRowClick=true;setTimeout(()=>{suppressRowClick=false;},350);if(drag.dragging&&inside)moveLiver(drag.row,to);}
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
 $('coinDialog').classList.remove('pair-actual','actual-account');$('pairCheerEditor').hidden=true;
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
  if(isAccount){if(focusedAccount===index)focusedAccount=null;else if(focusedAccount!==null&&focusedAccount>index)focusedAccount--;data.columns.splice(index,1);if(data.accountDetails)data.accountDetails.splice(index,1);data.rows.forEach(row=>{row.values.splice(index,1);if(row.pairActuals)row.pairActuals.splice(index,1);});}else data.rows.splice(index,1);
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
 updateOverlayViewport();$('coinDialog').showModal();$('coinDialog').scrollTop=0;
}
let currentEntity=null;
function entityDetails(create=false){
 if(!currentEntity||currentEntity.table!==data||!currentEntity.isCurrent())return null;
 if(currentEntity.kind==='pair')return PocoCalendar.pairDetails(data,currentEntity.row,currentEntity.index,create);
 return currentEntity.kind==='account'?PocoCalendar.accountDetails(data,currentEntity.index,create):currentEntity.row;
}
function isActualContext(){return currentEntity?.kind==='liver'||currentEntity?.kind==='pair';}
function showActualGroup(title,label,entries,legacyIndex=null){
 $('actualAccountDialog').classList.toggle('time-group',monthView==='time');$('actualAccountTitle').textContent=monthView==='time'?title.replace('獲得実績','日数・時間').replace('アカウント別実績','アカウント別日数・時間'):title;$('actualAccountMonth').textContent=book.currentMonth;
 $('openLegacyLiverActual').hidden=legacyIndex===null||!Object.keys(data.rows[legacyIndex]?.actuals||{}).length;
 $('openLegacyLiverActual').onclick=()=>{$('actualAccountDialog').close();showCoinDialog('liver',legacyIndex);};
 let sum=0,known=0;const table=$('actualAccountTable');table.replaceChildren();const head=table.createTHead().insertRow();for(const text of [label,'獲得エール（K）','日数・時間'])cell(head,'th').textContent=text;
 const body=table.createTBody();for(const entry of entries){const {row,index,name}=entry,pair=PocoCalendar.pairDetails(data,row,index),total=PocoCalendar.actualTotals(pair),tr=body.insertRow(),button=document.createElement('button');button.type='button';button.textContent=name;button.onclick=()=>{const scroll=$('actualAccountDialog').scrollTop;$('actualAccountDialog').close();showPairActual(row,index,{title,label,entries,legacyIndex,scroll});};cell(tr).append(button);cell(tr).textContent=pair.cheerK===null?'未記録':fmt(pair.cheerK);cell(tr).textContent=total.records?`${total.days}日 ／ ${total.timeRecords?`${Math.floor(total.minutes/60)}時間${total.minutes%60}分`:'時間未記録'}`:'未記録';if(pair.cheerK!==null){sum+=pair.cheerK;known++;}}
 $('actualAccountTotal').textContent=known?fmt(sum):'未記録';updateOverlayViewport();$('actualAccountDialog').showModal();$('actualAccountDialog').scrollTop=0;
}
function showActualAccount(index){showActualGroup(`${data.columns[index]}の獲得実績`,'ライバー',data.rows.map(row=>({row,index,name:row.name})));}
function showActualLiver(index){const row=data.rows[index];showActualGroup(`${row.name}のアカウント別実績`,'アカウント',data.columns.map((name,col)=>({row,index:col,name})),index);}
$('actualAccountClose').onclick=()=>$('actualAccountDialog').close();
let pairReturnGroup=null,pairOpeningCheer=null;
function showPairActual(row,index,returnGroup=null){
 pairReturnGroup=returnGroup;$('backToActualGroup').hidden=!returnGroup;
 const account=data.columns[index],table=data;
 $('coinDialog').classList.remove('actual-account');$('coinDialog').classList.add('pair-actual');$('pairCheerEditor').hidden=false;
 $('coinDialogTitle').textContent=`${row.name} × ${account}`;$('coinDialogMonth').textContent=`${book.currentMonth} ／ アカウント別実績`;
 openEntityPlanner({kind:'pair',row,index,month:book.currentMonth,table,isCurrent:()=>table===data&&data.rows.includes(row)&&data.columns[index]===account});
 $('previousPairLiver').disabled=data.rows.indexOf(row)===0;$('nextPairLiver').disabled=data.rows.indexOf(row)===data.rows.length-1;$('pairPosition').textContent=`${data.rows.indexOf(row)+1} / ${data.rows.length}`;
 updatePairGoalProgress();pairOpeningCheer=entityDetails().cheerK??null;$('undoPairCheer').hidden=true;$('clearPairCheer').disabled=pairOpeningCheer===null;$('pairCurrentCheer').value=pairOpeningCheer??'';$('pairCheerError').textContent='';updateOverlayViewport();$('coinDialog').showModal();$('coinDialog').scrollTop=0;
}
function updatePairGoalProgress(){
 if(currentEntity?.kind!=='pair'||!currentEntity.isCurrent())return;
 const raw=currentEntity.row.values[currentEntity.index].trim(),goal=/^[+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)?Number(raw):0,pair=entityDetails(),actual=pair.cheerK;
 const hasGoal=Number.isFinite(goal)&&goal>0,progress=$('pairGoalProgress');progress.hidden=!hasGoal;
 if(!hasGoal){$('pairGoalSummary').textContent='数値目標は未設定です。月目標の欄で設定できます。';return;}
 const percent=Math.min(100,Math.max(0,(actual??0)/goal*100));progress.value=percent;progress.setAttribute('aria-valuetext',`${fmt(Math.floor(percent))}%`);
 $('pairGoalSummary').textContent=`目標 ${fmt(goal)} K ／ 実績 ${actual===null?'未記録':fmt(actual)+' K'} ／ ${actual!==null&&actual>=goal?'達成済':`残り ${fmt(Math.max(0,goal-(actual??0)))} K`}（${fmt(Math.floor(percent))}%）`;
}
function movePairLiver(offset){
 if(currentEntity?.kind!=='pair'||!currentEntity.isCurrent())return;
 const index=data.rows.indexOf(currentEntity.row)+offset,row=data.rows[index];if(!row)return;
 const account=currentEntity.index,date=currentEntity.date,returnGroup=pairReturnGroup;$('coinDialog').close();showPairActual(row,account,returnGroup);if(date)selectEntityDay(date);
 if(monthView==='time')focusActualEditor();else $('pairCurrentCheer').focus({preventScroll:true});
}
$('previousPairLiver').onclick=()=>movePairLiver(-1);$('nextPairLiver').onclick=()=>movePairLiver(1);
$('pairCurrentCheer').addEventListener('input',()=>{
 if(currentEntity?.kind!=='pair')return;const input=$('pairCurrentCheer');$('undoPairCheer').hidden=input.value===String(pairOpeningCheer??'');$('clearPairCheer').disabled=input.value==='';if(!input.validity.valid){$('pairCheerError').textContent='0以上の獲得エールを入力してください。';return;}
 const entity=entityDetails(true);if(!entity)return;entity.cheerK=input.value===''?null:Number(input.value);$('undoPairCheer').hidden=entity.cheerK===pairOpeningCheer;$('clearPairCheer').disabled=entity.cheerK===null;$('pairCheerError').textContent='';updateActualTotals();stats();plannerSaved('現時点の獲得エールを保存しました。');
});
$('backToActualGroup').onclick=()=>{
 if(!pairReturnGroup||!currentEntity?.isCurrent())return;
 const group=pairReturnGroup;$('coinDialog').close();showActualGroup(group.title,group.label,group.entries,group.legacyIndex);$('actualAccountDialog').scrollTop=group.scroll;
};
function setPairCheer(value){
 if(currentEntity?.kind!=='pair'||!currentEntity.isCurrent())return;
 $('pairCurrentCheer').value=value??'';$('pairCurrentCheer').dispatchEvent(new Event('input',{bubbles:true}));
}
$('undoPairCheer').onclick=()=>setPairCheer(pairOpeningCheer);
$('clearPairCheer').onclick=()=>setPairCheer(null);
const entityHeaderObserver=new ResizeObserver(()=>{const height=$('coinDialog').querySelector('.dialog-header').getBoundingClientRect().height;if(height>0)$('coinDialog').style.setProperty('--entity-header-height',height+'px');});
entityHeaderObserver.observe($('coinDialog').querySelector('.dialog-header'));
function renderEntityCalendar(){
 const entity=entityDetails();if(!entity)return;
 const month=currentEntity.month,info=PocoCalendar.monthInfo(month);if(!info)return;
 const todayDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const calendar=$('entityCalendar');calendar.replaceChildren();
 $('calendarMonthLabel').textContent=`${info.year}年${info.number}月の${currentEntity.kind==='pair'?'日数・時間':'配信予定'}`;
 $('calendarCount').textContent=currentEntity.kind==='pair'?`実績 ${Object.keys(entity.actuals||{}).length}日`:`${Object.keys(entity.schedule||{}).length}日予定${isActualContext()?' ／ 実績'+Object.keys(entity.actuals||{}).length+'日':''}`;
 for(let i=0;i<info.weekday;i++){const empty=document.createElement('span');empty.setAttribute('aria-hidden','true');calendar.append(empty);}
 for(const day of PocoCalendar.dates(month)){
  const actual=isActualContext()?entity.actuals?.[day.date]:null;
  const text=entity.schedule?.[day.date]||'';const button=document.createElement('button');button.type='button';button.className='calendar-day';button.dataset.date=day.date;
  button.classList.toggle('has-actual',Boolean(actual));if(actual)button.setAttribute('aria-description','獲得実績あり');
  button.classList.toggle('is-sunday',day.weekday===0);button.classList.toggle('is-saturday',day.weekday===6);button.classList.toggle('has-plan',text!=='');
  if(day.date===todayDate)button.setAttribute('aria-current','date');
  button.setAttribute('aria-label',`${info.year}年${info.number}月${day.day}日の${currentEntity.kind==='pair'?'日数・時間':'配信予定'}`);button.setAttribute('aria-pressed',String(currentEntity.date===day.date));button.title=currentEntity.kind==='pair'?(actual?'日数・時間の記録あり':'未記録'):text||'予定なし';
  const number=document.createElement('span');number.className='day-number';number.textContent=day.day;
  const preview=document.createElement('span');preview.className='day-preview';preview.textContent=text.split('\n')[0]||(actual?'実績あり':'');button.append(number,preview);
  button.onclick=()=>{selectEntityDay(day.date);$('entityCalendar').querySelector(`[data-date="${day.date}"]`)?.focus({preventScroll:true});};calendar.append(button);
 }
 const cells=info.weekday+info.days;for(let i=cells;i<Math.ceil(cells/7)*7;i++){const empty=document.createElement('span');empty.setAttribute('aria-hidden','true');calendar.append(empty);}
}
function selectEntityDay(date){
 const entity=entityDetails();if(!entity)return;currentEntity.date=date;
 const day=Number(date.slice(8));const info=PocoCalendar.monthInfo(currentEntity.month);
 $('selectedDayTitle').textContent=`${info.number}月${day}日の予定（自由入力）`;
 $('daySchedule').value=entity.schedule?.[date]||'';loadActualDay(entity,date);
 $('previousPlanDay').disabled=day===1;$('nextPlanDay').disabled=day===info.days;
 const todayDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 $('todayPlanDay').disabled=!todayDate.startsWith(currentEntity.month+'-');
 renderEntityCalendar();
}
let lastActualAction=null;
function focusActualEditor(){
 if(!isActualContext())return;
 const dialog=$('coinDialog'),editor=$('liverActualEditor'),header=dialog.querySelector('.dialog-header');
 const stickyNav=currentEntity.kind==='pair'&&window.matchMedia('(max-width:700px), (max-height:500px) and (max-width:1000px)').matches?$('pairNavigation').getBoundingClientRect().height+8:0;
 dialog.scrollTop+=editor.getBoundingClientRect().top-dialog.getBoundingClientRect().top-header.getBoundingClientRect().height-stickyNav-12;
 editor.tabIndex=-1;editor.focus({preventScroll:true});
}
$('goActualEntry').onclick=focusActualEditor;
$('actualPreviousDay').onclick=()=>{movePlanDay(-1);focusActualEditor();};
$('actualNextDay').onclick=()=>{movePlanDay(1);focusActualEditor();};
$('actualToday').onclick=()=>{$('todayPlanDay').click();focusActualEditor();};
let actualBulkAppliedSignature='';
function actualBulkOptions(){
 const ids=['actualBulkFrom','actualBulkTo','actualBulkHours','actualBulkMinutes'];
 if(ids.some(id=>!$(id).validity.valid)||!$('actualBulkFrom').value||!$('actualBulkTo').value)throw Error('日付・時間を範囲内の数値で入力してください。');
 const hours=$('actualBulkHours').value,minutes=$('actualBulkMinutes').value;
 return {from:Number($('actualBulkFrom').value),to:Number($('actualBulkTo').value),weekdays:[...document.querySelectorAll('.actual-weekdays input:checked')].map(input=>Number(input.value)),minutes:hours===''&&minutes===''?null:Number(hours||0)*60+Number(minutes||0),countDay:$('actualBulkCount').checked,mode:document.querySelector('input[name=actualBulkMode]:checked').value};
}
function previewActualBulk(event){
 if(!isActualContext())return;
 if(event)actualBulkAppliedSignature='';$('applyActualBulk').disabled=true;
 try{const options=actualBulkOptions(),signature=JSON.stringify(options),result=PocoCalendar.bulkActuals(entityDetails().actuals,currentEntity.month,options),total=PocoCalendar.actualTotals({actuals:result.next});
  if(signature===actualBulkAppliedSignature){$('actualBulkPreview').textContent='反映済みです。再入力する場合は条件を変更してください。';return;}
  $('actualBulkPreview').textContent=`更新 ${result.applied.length}日 ／ 記録済みのため保護 ${result.skipped.length}日。反映後：${total.days}日・${total.timeRecords?`${Math.floor(total.minutes/60)}時間${total.minutes%60}分`:'時間未記録'}`;
  $('applyActualBulk').disabled=!result.applied.length;
 }catch(error){$('actualBulkPreview').textContent=error.message;}
}
function resetActualBulk(){
 actualBulkAppliedSignature='';$('actualBulkPanel').open=false;
 const day=Number(currentEntity.date.slice(8)),last=PocoCalendar.monthInfo(currentEntity.month).days;
 for(const id of ['actualBulkFrom','actualBulkTo']){$(id).max=last;$(id).value=day;}
 $('actualBulkHours').value='';$('actualBulkMinutes').value='';$('actualBulkCount').checked=true;
 document.querySelectorAll('.actual-weekdays input').forEach(input=>input.checked=true);document.querySelector('input[name=actualBulkMode][value=missing]').checked=true;previewActualBulk();
}
for(const input of document.querySelectorAll('#actualBulkPanel input'))input.addEventListener('input',previewActualBulk);
$('applyActualBulk').onclick=()=>{
 if(!isActualContext())return;
 try{const options=actualBulkOptions(),signature=JSON.stringify(options);if(signature===actualBulkAppliedSignature)return;
  const result=PocoCalendar.bulkActuals(entityDetails().actuals,currentEntity.month,options);if(!result.applied.length)return;
  applyActualAction(result.next,`${result.applied.length}日分を反映しました。エール・予定は変更していません。`);actualBulkAppliedSignature=signature;lastActualAction.bulk=true;updateActualTools();
 }catch(error){$('actualBulkPreview').textContent=error.message;}
};
function currentMissingActualDates(){
 const entity=entityDetails();if(!isActualContext()||!entity)return [];
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return PocoCalendar.missingActualDates(entity,currentEntity.month,today);
}
$('undoActualBulk').onclick=()=>$('undoActualAction').click();
$('findMissingActual').onclick=()=>{
 const missing=currentMissingActualDates();if(!missing.length)return;
 selectEntityDay(missing.find(date=>date>currentEntity.date)||missing[0]);focusActualEditor();
};
function updateActualTools(){
 const entity=entityDetails();if(!isActualContext()||!entity)return;
 const dates=PocoCalendar.dates(currentEntity.month),index=dates.findIndex(item=>item.date===currentEntity.date),value=entity.actuals?.[currentEntity.date];
 $('actualPreviousDay').disabled=index<1;$('actualNextDay').disabled=index===dates.length-1;
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());$('actualToday').disabled=!today.startsWith(currentEntity.month+'-');
 $('copyPreviousActualTime').disabled=index<1||entity.actuals?.[dates[index-1].date]?.minutes==null;
 $('actualMinus15').disabled=!(value?.minutes>0);$('clearActualDay').disabled=!value;
 const canUndo=lastActualAction&&lastActualAction.row===entity&&lastActualAction.table===data&&JSON.stringify(entity.actuals||{})===JSON.stringify(lastActualAction.after);
 $('undoActualAction').hidden=!canUndo;$('undoActualBulk').hidden=!(canUndo&&lastActualAction.bulk);
 const missing=currentMissingActualDates();$('actualMissingInfo').textContent=`今日までの未記録候補 ${missing.length}日（予定あり・未記録、または時間未入力）`;$('findMissingActual').disabled=!missing.length;previewActualBulk();
}
function applyActualAction(next,message){
 const entity=entityDetails(true);if(!isActualContext()||!entity)return;
 const before=structuredClone(entity.actuals||{});if(!PocoCalendar.validActuals(next,currentEntity.month))throw Error('実績の内容を確認してください。');
 entity.actuals=next;loadActualDay(entity,currentEntity.date);renderEntityCalendar();stats();plannerSaved(message);
 lastActualAction={row:entity,table:data,before,after:structuredClone(next)};updateActualTools();
}
function addActualTime(changes,message){
 try{const entity=entityDetails();if(!isActualContext()||!entity)return;applyActualAction(PocoCalendar.addActualMinutes(entity.actuals,changes,currentEntity.month),message);}
 catch(error){$('actualError').textContent=error.message;}
}
for(const [id,minutes] of [['actualPlus15',15],['actualPlus30',30],['actualPlus60',60],['actualMinus15',-15]])$(id).onclick=()=>{
 if(!currentEntity?.date)return;addActualTime({[currentEntity.date]:minutes},`${minutes>0?'+':''}${minutes}分を反映しました。`);
};
$('copyPreviousActualTime').onclick=()=>{
 const entity=entityDetails();if(!isActualContext()||!entity)return;
 const days=PocoCalendar.dates(currentEntity.month),index=days.findIndex(item=>item.date===currentEntity.date),source=entity.actuals?.[days[index-1]?.date];
 if(source?.minutes==null)return;const next=structuredClone(entity.actuals||{}),old=next[currentEntity.date]||{earnedDay:false,minutes:null,cheerK:null};
 next[currentEntity.date]={...old,earnedDay:old.earnedDay||source.minutes>0,minutes:source.minutes};
 applyActualAction(next,'前日の時間をコピーしました。エールは変更していません。');
};
$('clearActualDay').onclick=()=>{
 const entity=entityDetails();if(!isActualContext()||!entity)return;const next=structuredClone(entity.actuals||{});delete next[currentEntity.date];applyActualAction(next,'この日の実績を消去しました。「元に戻す」で復元できます。');
};
$('undoActualAction').onclick=()=>{
 const entity=entityDetails(),action=lastActualAction;if(!action||action.row!==entity||action.table!==data||JSON.stringify(entity.actuals||{})!==JSON.stringify(action.after))return;
 entity.actuals=structuredClone(action.before);actualBulkAppliedSignature='';lastActualAction=null;loadActualDay(entity,currentEntity.date);renderEntityCalendar();stats();plannerSaved('直前の実績操作を元に戻しました。');
};
function previewActualRange(event){
 if(!isActualContext())return;
 const start=$('actualRangeStart').value,end=$('actualRangeEnd').value;
 if(event?.target!==$('actualRangeNextDay')&&start&&end&&end<start)$('actualRangeNextDay').checked=true;
 $('applyActualRange').disabled=true;
 if(!start||!end){$('actualRangePreview').textContent='開始・終了を選ぶと計算します。';return;}
 try{const changes=PocoCalendar.splitActualRange(currentEntity.date,start,end,$('actualRangeNextDay').checked,currentEntity.month);PocoCalendar.addActualMinutes(entityDetails().actuals,changes,currentEntity.month);
 const total=Object.values(changes).reduce((sum,n)=>sum+n,0);$('actualRangePreview').textContent=`${Math.floor(total/60)}時間${total%60}分 ／ ${Object.keys(changes).length}日分に加算`;$('applyActualRange').disabled=false;
 }catch(error){$('actualRangePreview').textContent=error.message;}
}
for(const id of ['actualRangeStart','actualRangeEnd','actualRangeNextDay'])$(id).addEventListener('input',previewActualRange);
$('applyActualRange').onclick=()=>{
 if(!isActualContext())return;
 try{const changes=PocoCalendar.splitActualRange(currentEntity.date,$('actualRangeStart').value,$('actualRangeEnd').value,$('actualRangeNextDay').checked,currentEntity.month);addActualTime(changes,'開始・終了時刻から計算した時間を加算しました。');}
 catch(error){$('actualRangePreview').textContent=error.message;}
};
function updateActualTotals(){
 if(!isActualContext())return;
 const total=PocoCalendar.actualTotals(entityDetails());
 $('actualTotalDays').textContent=total.records?`${total.days}日`:'未記録';
 $('actualTotalTime').textContent=total.timeRecords?`${Math.floor(total.minutes/60)}時間${total.minutes%60}分`:'未記録';
 $('actualTotalCheer').textContent=currentEntity.kind==='pair'?(entityDetails().cheerK===null?'未記録':fmt(entityDetails().cheerK)+' K'):total.cheerRecords?`${fmt(total.cheerK)} K`:'未記録';
 const history=$('actualHistoryRows');history.replaceChildren();for(const [date,value] of Object.entries(entityDetails().actuals||{}).sort(([a],[b])=>a.localeCompare(b))){const button=document.createElement('button');button.type='button';button.textContent=`${Number(date.slice(5,7))}/${Number(date.slice(8))} ／ ${value.earnedDay?'1日':'日数対象外'} ／ ${value.minutes===null?'時間未記入':`${Math.floor(value.minutes/60)}時間${value.minutes%60}分`}`+(currentEntity.kind==='pair'?'':` ／ ${value.cheerK===null?'エール未記入':fmt(value.cheerK)+' K'}`);button.onclick=()=>{selectEntityDay(date);focusActualEditor();};history.append(button);}
 if(!history.childElementCount)history.textContent='実績はまだありません。';updateActualTools();
}
function loadActualDay(entity,date){
 if(!isActualContext())return;
 lastActualAction=null;$('actualRangeStart').value='';$('actualRangeEnd').value='';$('actualRangeNextDay').checked=false;$('actualRangePanel').open=false;
 const value=entity.actuals?.[date];
 $('actualDayTitle').textContent=`${Number(date.slice(5,7))}月${Number(date.slice(8))}日の獲得実績`;
 $('actualEarnedDay').checked=value?.earnedDay||false;
 $('actualHours').value=value?.minutes==null?'':Math.floor(value.minutes/60);
 $('actualMinutes').value=value?.minutes==null?'':value.minutes%60;
 $('actualCheer').value=value?.cheerK??'';$('actualError').textContent='';updateActualTotals();previewActualRange();
}
function saveActualDay(event){
 if(!isActualContext())return;const entity=entityDetails();if(!entity)return;
 const hours=$('actualHours'),minutes=$('actualMinutes'),cheer=$('actualCheer');
 if([hours,minutes,cheer].some(input=>!input.validity.valid)){$('actualError').textContent='時間・分・エールは範囲内の数値を入力してください。';return;}
 const duration=hours.value===''&&minutes.value===''?null:Number(hours.value||0)*60+Number(minutes.value||0);
 if(duration>1440){$('actualError').textContent='1日の時間は24時間以内で入力してください。';return;}
 const cheerK=currentEntity.kind==='pair'?(entity.actuals?.[currentEntity.date]?.cheerK??null):cheer.value===''?null:Number(cheer.value);
 if(event.target!==$('actualEarnedDay')&&(duration>0||cheerK>0))$('actualEarnedDay').checked=true;
 lastActualAction=null;PocoCalendar.setActual(entityDetails(true),currentEntity.date,{earnedDay:$('actualEarnedDay').checked,minutes:duration,cheerK},currentEntity.month);
 $('actualError').textContent='';updateActualTotals();renderEntityCalendar();stats();plannerSaved();previewActualRange();
}
for(const id of ['actualHours','actualMinutes','actualCheer'])$(id).addEventListener('input',saveActualDay);
$('actualEarnedDay').addEventListener('change',saveActualDay);
function movePlanDay(offset){
 if(!entityDetails()||!currentEntity.date)return;
 const day=Number(currentEntity.date.slice(8))+offset,info=PocoCalendar.monthInfo(currentEntity.month);
 if(day<1||day>info.days)return;
 selectEntityDay(`${currentEntity.month}-${String(day).padStart(2,'0')}`);
}
$('previousPlanDay').onclick=()=>movePlanDay(-1);
$('nextPlanDay').onclick=()=>movePlanDay(1);
$('todayPlanDay').onclick=()=>{
 if(!entityDetails())return;
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(date.startsWith(currentEntity.month+'-'))selectEntityDay(date);
};
function openEntityPlanner(target){
 currentEntity=target;$('actualDayHelp').textContent=target.kind==='pair'?'時間が0より大きいと日数にも数えます。1日24時間以内です。獲得エールは上の現時点の合計欄で記録します。「元に戻す」は日付を切り替えるまで使えます。':'空欄は未記入、0は実績0です。時間・エールが0より大きいと日数にも数えます。1日24時間以内です。「元に戻す」は日付を切り替えるまで使えます。';$('actualSummaryNote').textContent=target.kind==='pair'?'日数・時間は日別の合計、エールは現時点の入力値です。':target.kind==='liver'?'以前のライバー単位の実績です。アカウント別の実績は月実績の各欄から記録できます。':'日別に入力した実績の合計です。';$('actualEntryShortcut').hidden=!isActualContext();$('actualHistory').open=false;$('liverActualSummary').hidden=!isActualContext();$('liverActualEditor').hidden=!isActualContext();const entity=entityDetails();$('entityMemo').value=entity?.memo||'';$('plannerStatus').textContent='';
 const japanDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 selectEntityDay(japanDate.startsWith(target.month+'-')?japanDate:target.month+'-01');
 document.querySelector('.entity-breakdown').open=false;if(isActualContext())resetActualBulk();
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
$('coinDialogClose').onclick=()=>$('coinDialog').close();
let scheduleRow=null,scheduleTrigger=null;
function closeScheduleEditor(restoreFocus=false){
 const editor=$('scheduleDialog'),trigger=scheduleTrigger;
 if(editor.matches(':popover-open'))editor.hidePopover();
 document.body.append(editor);trigger?.setAttribute('aria-expanded','false');scheduleTrigger=null;scheduleRow=null;
 if(restoreFocus&&trigger?.isConnected)trigger.focus({preventScroll:true});
}
function positionScheduleEditor(){
 if(!scheduleTrigger)return;const editor=$('scheduleDialog'),view=visibleViewport(),rect=scheduleTrigger.getBoundingClientRect();
 const width=Math.min(editor.classList.contains('is-closing')?92:300,view.width-16);
 editor.style.width=width+'px';editor.style.maxHeight=Math.min(editor.classList.contains('is-closing')?180:560,view.height-16)+'px';
 const height=editor.getBoundingClientRect().height;
 const below=view.top+view.height-rect.bottom-8,above=rect.top-view.top-8;
 const top=below>=height||below>=above?rect.bottom+2:rect.top-height-2;
 editor.style.left=Math.max(view.left+8,Math.min(rect.left,view.left+view.width-width-8))+'px';editor.style.top=Math.max(view.top+8,Math.min(top,view.top+view.height-height-8))+'px';
}
window.addEventListener('resize',positionScheduleEditor);window.visualViewport?.addEventListener('resize',positionScheduleEditor);window.visualViewport?.addEventListener('scroll',positionScheduleEditor);
window.addEventListener('scroll',event=>{if(scheduleTrigger&&!$('scheduleDialog').contains(event.target))positionScheduleEditor();},true);
function commitSchedule(field,value){
 if(!scheduleRow||!data.rows.includes(scheduleRow))return;
 const index=data.rows.indexOf(scheduleRow);
 scheduleRow[field]=value;rowSort={field:null,direction:1,month:book.currentMonth};save();render();
 revealGridRow(index);
 const button=$('grid').tBodies[0]?.rows[index]?.querySelector(field==='releaseDate'?'.release-col button':'.closing-col button');
 if(button){button.focus({preventScroll:true});button.classList.add('recent-schedule');setTimeout(()=>button.classList.remove('recent-schedule'),1800);}
}
function renderReleaseCalendar(row){
 const month=book.currentMonth,info=PocoCalendar.monthInfo(month),calendar=$('releaseCalendar');
 const day=PocoRows.releaseKey(row.releaseDate,month);
 $('releaseCalendarMonth').textContent=`${info.year}年${info.number}月`;
 $('releaseCurrent').textContent=`現在：${PocoRows.formatRelease(row.releaseDate,month)||'空欄'}`;
 $('releaseTentative').checked=/[(（]仮[)）]\s*$/.test(row.releaseDate||'');
 calendar.replaceChildren();
 for(let i=0;i<info.weekday;i++){const empty=document.createElement('span');empty.setAttribute('aria-hidden','true');calendar.append(empty);}
 const todayDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 for(const date of PocoCalendar.dates(month)){
  const button=document.createElement('button');button.type='button';button.className='calendar-day';const number=document.createElement('span');number.className='day-number';number.textContent=date.day;button.append(number);
  button.dataset.date=date.date;button.classList.toggle('is-sunday',date.weekday===0);button.classList.toggle('is-saturday',date.weekday===6);
  button.setAttribute('aria-label',`${info.year}年${info.number}月${date.day}日を解禁日に設定`);button.setAttribute('aria-pressed',String(date.day===day));
  if(date.date===todayDate)button.setAttribute('aria-current','date');
  button.onclick=()=>commitSchedule('releaseDate',`${date.day}日${$('releaseTentative').checked?'(仮)':''}`);calendar.append(button);
 }
}
function showSchedule(row,field,trigger){
 if(scheduleTrigger===trigger){closeScheduleEditor(true);return;}
 closeScheduleEditor();closeCheerPicker();scheduleRow=row;scheduleTrigger=trigger;
 const isRelease=field==='releaseDate',editor=$('scheduleDialog');$('scheduleTitle').textContent=`${row.name}の${isRelease?'解禁日':'締め'}`;
 editor.classList.toggle('is-closing',!isRelease);$('closingEditor').hidden=isRelease;$('releaseEditor').hidden=!isRelease;
 if(isRelease)renderReleaseCalendar(row);
 else{
  const list=$('closingTimeInput');list.replaceChildren();
  for(const value of ['','0時','22時','13時']){const option=document.createElement('button');option.type='button';option.setAttribute('role','option');option.setAttribute('aria-selected',String((row.closingTime||'')===value));option.textContent=value;if(!value)option.setAttribute('aria-label','空欄');option.onclick=()=>commitSchedule('closingTime',value);list.append(option);}
 }
 trigger.closest('td').append(editor);trigger.setAttribute('aria-expanded','true');editor.showPopover();positionScheduleEditor();
 const target=isRelease?$('releaseCalendar').querySelector('[aria-pressed=true]')||$('releaseCalendar').querySelector('button'):$('closingTimeInput').querySelector('[aria-selected=true]')||$('closingTimeInput').querySelector('button');target?.focus({preventScroll:true});
}
function scheduleField(row,field,label){
 const button=document.createElement('button');button.type='button';button.className='schedule-field';button.setAttribute('aria-label',`${row.name}の${label}`);button.title=field==='releaseDate'?PocoRows.formatRelease(row[field],book.currentMonth):row[field]||'';
 button.textContent=button.title;button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','scheduleDialog');button.onclick=()=>showSchedule(row,field,button);return button;
}
$('scheduleClose').onclick=()=>closeScheduleEditor(true);
$('scheduleDialog').addEventListener('toggle',event=>{if(event.newState==='closed'&&!$('scheduleDialog').matches(':popover-open'))closeScheduleEditor();});
$('scheduleDialog').addEventListener('keydown',event=>{
 if(event.key==='Escape'){event.preventDefault();closeScheduleEditor(true);return;}
 if(!$('scheduleDialog').classList.contains('is-closing'))return;
 const options=[...$('closingTimeInput').querySelectorAll('[role=option]')],index=options.indexOf(document.activeElement);let next;
 if(event.key==='ArrowDown')next=Math.min(options.length-1,index+1);if(event.key==='ArrowUp')next=Math.max(0,index-1);if(event.key==='Home')next=0;if(event.key==='End')next=options.length-1;
 if(next!==undefined){event.preventDefault();options[next].focus();}
});
$('releaseUndecided').onclick=()=>commitSchedule('releaseDate','未定');
$('releaseClear').onclick=()=>commitSchedule('releaseDate','');
let renderedMonth=null;
const monthViewportPositions=new Map();
function revealGridColumn(index){
 const table=$('grid'),wrap=table.parentElement,cell=table.tHead?.rows[0]?.cells[index+3];if(!cell)return;
 const bounds=wrap.getBoundingClientRect(),rect=cell.getBoundingClientRect(),sticky=table.tHead.rows[0].cells[0].getBoundingClientRect().width;
 if(rect.left<bounds.left+sticky)wrap.scrollLeft-=bounds.left+sticky-rect.left;
 else if(rect.right>bounds.right)wrap.scrollLeft+=rect.right-bounds.right;
}
function markAddedName(element,message){
 if(!element)return;element.classList.add('added-name');setTimeout(()=>element.classList.remove('added-name'),2500);
 element.focus({preventScroll:true});$('orderStatus').textContent=message;
}
function render(){
 const wrap=$('grid').parentElement;
 const viewportKey=book.currentMonth+':'+monthView;const monthChanged=renderedMonth!==viewportKey;
 if(monthChanged&&renderedMonth)monthViewportPositions.set(renderedMonth,{top:wrap.scrollTop,left:wrap.scrollLeft});
 renderedMonth=viewportKey;
 if(!canUndoCheer())dismissCheerUndo();else $('cheerUndoBar').hidden=monthView!=='goal';
 if($('findLiverDialog').open)$('findLiverDialog').close();
 clearRowDrag();
 if(rowSort.month!==book.currentMonth)rowSort={field:null,direction:1,month:book.currentMonth};
 closeCheerPicker();
 if($('coinDialog').open)$('coinDialog').close();if($('actualAccountDialog').open)$('actualAccountDialog').close();
 closeScheduleEditor();
 $('tablePanel').classList.toggle('actual-view',monthView!=='goal');$('tablePanel').classList.toggle('time-view',monthView==='time');$('timeViewNote').hidden=monthView!=='time';$('monthViewTime').setAttribute('aria-pressed',String(monthView==='time'));$('monthViewGoal').setAttribute('aria-pressed',String(monthView==='goal'));$('monthViewActual').setAttribute('aria-pressed',String(monthView==='actual'));$('addCol').hidden=false;
 const table=$('grid');table.setAttribute('aria-label',monthView==='time'?'ポコログの日数・時間一覧':monthView==='actual'?'ポコログの月実績一覧':'ポコログの月目標一覧');table.style.setProperty('--account-count',data.columns.length);table.style.setProperty('--compact-table-min-width',data.columns.length>15?`${106+data.columns.length*13}px`:'286px');table.replaceChildren();const head=table.createTHead().insertRow();
 cell(head,'th').textContent='ライバー名';
 sortHeader(head,'closingTime','締め','closing-col');sortHeader(head,'releaseDate','解禁日','release-col');
 data.columns.forEach((c,j)=>{
  const th=cell(head,'th');th.append(nameControls(c,'アカウント',()=>monthView!=='goal'?showActualAccount(j):showCoinDialog('account',j)));if(monthView!=='goal')th.querySelector('button').setAttribute('aria-label',`アカウント ${c}の${monthView==='time'?'日数・時間':'獲得実績'}`);
 });
 if(monthView==='goal'){cell(head,'th','extra-col').textContent='合計（K）';cell(head,'th','extra-col').textContent='必要コイン';}cell(head,'th','extra-col').textContent='メモ';
 const body=table.createTBody();
 data.rows.forEach((r,i)=>{
  const tr=body.insertRow();const nameCell=cell(tr,'td','name');nameCell.append(nameControls(r.name,'ライバー',()=>monthView!=='goal'?showActualLiver(i):showCoinDialog('liver',i)));attachRowDrag(nameCell.querySelector('button'),r,tr);if(monthView!=='goal')nameCell.querySelector('button').setAttribute('aria-label',`ライバー ${r.name}の${monthView==='time'?'日数・時間':'獲得実績'}`);
  cell(tr,'td','closing-col').append(scheduleField(r,'closingTime','締め'));cell(tr,'td','release-col').append(scheduleField(r,'releaseDate','解禁日'));
  if(monthView!=='goal'){
   data.columns.forEach((account,j)=>{const td=cell(tr),button=document.createElement('button'),pair=PocoCalendar.pairDetails(data,r,j);button.type='button';button.className='cheer-field pair-actual-cell'+(monthView==='time'?' pair-time-cell':'');button.dataset.actualAccount=j;paintPairActualCell(button,pair);button.setAttribute('aria-label',`${r.name}・${account}の${monthView==='time'?'日数・時間':'実績'}を編集`);button.title=`${r.name} × ${account}：獲得エール・日数・時間を記録`;button.onclick=()=>{showPairActual(r,j);if(monthView==='time')focusActualEditor();};td.append(button);});
  }else{
  r.values.forEach((v,j)=>{
   const td=cell(tr);td.append(cheerSelect(v,`${r.name}・${data.columns[j]}`,v=>changeCheer(r,j,v)));
  });
  const total=cell(tr,'td','total extra-col');total.dataset.row=i;
  const coins=cell(tr,'td','total coin-total extra-col');coins.dataset.coinRow=i;
  }
  cell(tr,'td','memo extra-col').append(input(r.memo,`${r.name}のメモ`,v=>r.memo=v));
 });
 applyAccountView();stats();
 if(monthChanged){const position=monthViewportPositions.get(viewportKey)||{top:0,left:0};wrap.scrollTop=position.top;wrap.scrollLeft=position.left;}
 if(!gridEditingEnabled)window.pocolog?.setEditing(false);
 requestAnimationFrame(fitTableViewport);
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
 refreshActualGrid();applyRowHighlights();updatePairGoalProgress();
 const pairs=$('pairSummaryTable');pairs.replaceChildren();const pairHead=pairs.createTHead().insertRow();for(const title of ['ライバー','アカウント','獲得エール（K）','日数','時間'])cell(pairHead,'th').textContent=title;const pairBody=pairs.createTBody();
 for(const row of data.rows)data.columns.forEach((account,index)=>{const pair=row.pairActuals?.[index];if(!pair)return;const total=PocoCalendar.actualTotals(pair),tr=pairBody.insertRow();for(const value of [row.name,account,pair.cheerK===null?'未記録':fmt(pair.cheerK),total.records?total.days+'日':'未記録',total.timeRecords?`${Math.floor(total.minutes/60)}時間${total.minutes%60}分`:'未記録'])cell(tr).textContent=value;});
 if(!pairBody.rows.length){const td=cell(pairBody.insertRow());td.colSpan=5;td.textContent='月実績の各アカウント欄から記録できます。';}
 const actuals=$('actualSummaryTable');actuals.replaceChildren();const actualHead=actuals.createTHead().insertRow();for(const title of ['ライバー','稼いだ日数','稼いだ時間','実獲得エール（K）'])cell(actualHead,'th').textContent=title;
 const actualBody=actuals.createTBody();for(const row of data.rows){const total=PocoCalendar.actualTotals(row),tr=actualBody.insertRow();for(const value of [row.name,total.records?`${total.days}日`:'未記録',total.timeRecords?`${Math.floor(total.minutes/60)}時間${total.minutes%60}分`:'未記録',total.cheerRecords?fmt(total.cheerK):'未記録'])cell(tr).textContent=value;}
}

function fitTableViewport(){
 const wrap=$('grid').parentElement,menuHeight=$('bottomMenus').getBoundingClientRect().height;
 document.documentElement.style.setProperty('--bottom-menu-height',menuHeight+'px');
 const top=wrap.getBoundingClientRect().top+window.scrollY,viewportHeight=Math.max(window.innerHeight,document.documentElement.clientHeight);
 const available=Math.max(64,viewportHeight-top-menuHeight-8),compactFocus=focusedAccount!==null&&!roomyView;
 if(compactFocus){
  const rowHeight=Math.max(16,Math.min(32,Math.floor((available-34)/Math.max(1,data.rows.length))-1));
  $('grid').style.setProperty('--focus-row-height',rowHeight+'px');$('grid').style.setProperty('--focus-row-font',rowHeight<22?'10px':'12px');
 }
 if(!compactFocus&&!window.matchMedia('(max-width:700px), (max-height:500px) and (max-width:1000px)').matches){wrap.style.maxHeight='';wrap.style.minHeight='';return;}
 wrap.style.maxHeight=available+'px';wrap.style.minHeight=Math.min(120,available)+'px';
}
// Phone keyboards can finish closing after the dialog's render and only emit
// visualViewport events. Re-measure after that animation, rather than keeping
// the temporary keyboard-sized table until the next window resize.
let tableViewportTimer;
function updateOverlayViewport(){
 const view=visibleViewport();
 for(const [name,value] of Object.entries(view))document.documentElement.style.setProperty('--visible-'+name,value+'px');
 if(document.querySelector('.table-tools[open]'))positionToolsMenu();
}
function refreshTableViewport(){
 updateOverlayViewport();
 requestAnimationFrame(fitTableViewport);
 clearTimeout(tableViewportTimer);
 tableViewportTimer=setTimeout(()=>{updateOverlayViewport();requestAnimationFrame(fitTableViewport);},350);
}
window.addEventListener('resize',refreshTableViewport);
window.addEventListener('pageshow',refreshTableViewport);
window.visualViewport?.addEventListener('resize',refreshTableViewport);
window.visualViewport?.addEventListener('scroll',refreshTableViewport);
document.addEventListener('focusout',refreshTableViewport);
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',refreshTableViewport));
updateOverlayViewport();
const tableViewportObserver=new ResizeObserver(()=>requestAnimationFrame(fitTableViewport));
for(const selector of ['header','.page-title','.cards','.table-bar','#bottomMenus'])tableViewportObserver.observe(document.querySelector(selector));
const toolsMenu=document.querySelector('.table-tools');
function positionToolsMenu(){
 if(!toolsMenu.open)return;const menu=toolsMenu.querySelector('.toolbar');const anchor=toolsMenu.querySelector('summary').getBoundingClientRect();
 const view=visibleViewport();menu.style.maxWidth=Math.max(0,view.width-16)+'px';
 menu.style.maxHeight=Math.max(48,Math.min(420,anchor.top-view.top-16))+'px';
 const rect=menu.getBoundingClientRect(),top=Math.max(view.top+8,anchor.top-rect.height-6);
 menu.style.left=Math.max(view.left+8,Math.min(anchor.left,view.left+view.width-rect.width-8))+'px';menu.style.top=top+'px';
}
document.addEventListener('pointerdown',event=>{if(toolsMenu.open&&!toolsMenu.contains(event.target))toolsMenu.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toolsMenu.open){event.preventDefault();toolsMenu.open=false;toolsMenu.querySelector('summary').focus({preventScroll:true});}});
toolsMenu.addEventListener('toggle',positionToolsMenu);window.addEventListener('resize',positionToolsMenu);window.addEventListener('scroll',event=>{if(!toolsMenu.querySelector('.toolbar').contains(event.target))positionToolsMenu();},true);
$('addRow').onclick=()=>{data.rows.push({name:'新しいライバー',memo:'',values:data.columns.map(()=>'')});save();render();revealGridRow(data.rows.length-1);markAddedName($('grid').tBodies[0].rows[data.rows.length-1].querySelector('.name-trigger'),'ライバーを追加しました。名前を押すと編集できます。');};
$('addCol').onclick=()=>{if(data.columns.length>=100)return alert('アカウントは100列までです。');focusedAccount=null;data.columns.push('新しいアカウント');if(data.accountDetails)data.accountDetails.push({memo:'',schedule:{}});data.rows.forEach(r=>{r.values.push('');if(r.pairActuals)r.pairActuals.push(null);});save();render();revealGridColumn(data.columns.length-1);markAddedName($('grid').tHead.rows[0].cells[data.columns.length+2].querySelector('.name-trigger'),'アカウントを追加しました。名前を押すと編集できます。');};
$('metric').onchange=stats;
$('tableMode').onclick=()=>{const expanded=$('tablePanel').classList.toggle('table-detail');$('tableMode').setAttribute('aria-pressed',String(expanded));$('tableMode').textContent=expanded?'一覧に戻る':'編集・詳細';toolsMenu.open=false;refreshTableViewport();};
$('syncInfo').onclick=()=>{updateOverlayViewport();$('syncInfoDialog').showModal();};
$('closeSyncInfo').onclick=()=>$('syncInfoDialog').close();
$('openSummary').onclick=()=>{updateOverlayViewport();$('summaryDialog').showModal();$('summaryDialog').scrollTop=0;};
$('closeSummary').onclick=()=>$('summaryDialog').close();
$('refresh').onclick=()=>{try{localStorage.setItem(KEY,JSON.stringify(book));location.reload();}catch{$('status').textContent='保存できないため更新を中止しました。バックアップを保存してください。';}};
function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download').onclick=()=>download(JSON.stringify(book,null,2),'application/json','pocolog-backup.json');
$('upload').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>10000000)throw Error();const next=JSON.parse(await f.text());if(!validBook(next)&&!valid(next,book.currentMonth))throw Error();if(confirm('全月の記録をバックアップの内容で置き換えますか？')){book=validBook(next)?next:{version:2,currentMonth:book.currentMonth,months:{[book.currentMonth]:next}};addMoeAccount();PocoRows.addExtraAccounts(book);addPhotoLivers();rowSort={field:null,direction:1,month:book.currentMonth};data=book.months[book.currentMonth];$('month').value=book.currentMonth;save();render();}}catch{alert('読み込めませんでした。ポコログのJSONバックアップを選択してください。');}e.target.value='';};
$('csv').onclick=()=>{const quote=s=>'"'+String(s).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';if(monthView==='time'){const rows=[['ライバー名','アカウント','稼いだ日数','稼いだ時間（分）','メモ']];for(const row of data.rows){data.columns.forEach((account,index)=>{const pair=PocoCalendar.pairDetails(data,row,index),total=PocoCalendar.actualTotals(pair);rows.push([row.name,account,total.records?total.days:'',total.timeRecords?total.minutes:'',pair.memo]);});const legacy=PocoCalendar.actualTotals(row);if(legacy.records)rows.push([row.name,'以前のライバー単位の記録',legacy.days,legacy.timeRecords?legacy.minutes:'',row.memo]);}download('\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8','pocolog-time.csv');return;}if(monthView==='actual'){const rows=[['ライバー名','アカウント','現時点の獲得エール（K）','稼いだ日数','稼いだ時間（分）','メモ']];for(const row of data.rows){data.columns.forEach((account,index)=>{const pair=PocoCalendar.pairDetails(data,row,index),total=PocoCalendar.actualTotals(pair);rows.push([row.name,account,pair.cheerK??'',total.records?total.days:'',total.timeRecords?total.minutes:'',pair.memo]);});const legacy=PocoCalendar.actualTotals(row);if(legacy.records)rows.push([row.name,'以前のライバー単位の記録',legacy.cheerRecords?legacy.cheerK:'',legacy.days,legacy.timeRecords?legacy.minutes:'',row.memo]);}download('\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8','pocolog-actual.csv');return;}const rows=[['ライバー名','締め','解禁日',...data.columns,'エール合計（K）','必要コイン（換算済み分）','未算定セル数','メモ','稼いだ日数','稼いだ時間（分）','実獲得エール（K）'],...data.rows.map(r=>{const total=measure(r.values);const actual=PocoCalendar.actualTotals(r);return [r.name,r.closingTime||'',PocoRows.formatRelease(r.releaseDate,book.currentMonth),...r.values,total.number,total.coins,total.unknown,r.memo,actual.records?actual.days:'',actual.timeRecords?actual.minutes:'',actual.cheerRecords?actual.cheerK:''];})];download('\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8','pocolog.csv');};
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
 setEditing(enabled){gridEditingEnabled=enabled;if(!enabled){clearRowDrag();closeCheerPicker();}document.querySelectorAll('#grid input,#grid select,#grid button,#addRow,#addCol,#upload,#month,#undoCheer').forEach(el=>el.disabled=!enabled);document.querySelectorAll('#grid .sort-label').forEach(el=>{el.setAttribute('aria-disabled',String(!enabled));el.tabIndex=enabled?0:-1;});},
 downloadBackup:(backup=book)=>download(JSON.stringify(backup,null,2),'application/json','pocolog-unsynced-backup.json')
};
