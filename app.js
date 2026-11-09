const KEY = 'pocolog.v1';
const photoLivers = ['どんちゃん','かつにぃ','ともちゃん','あすぽん','むぎたん','しーたま','れなぴ','ラピママ','武井','こたちゃま','みさき','EMMA','猫','あおいちゃん','おはぎ','スパたん','たぁ坊','アルちゃん','スピカちゃん'];
const initial = {columns:['こじ','こた','もえ','寿司','イカ','焼肉','ケン','ガヤ','お餅','アラン','シオン','レオン','ヨシ','海斗','レオ'],rows:[]};
const $ = id => document.getElementById(id);
let data, book;
function valid(d,month){return d && Array.isArray(d.columns) && d.columns.length<=100 && d.columns.every(c=>typeof c==='string') && Array.isArray(d.rows) && d.rows.length<=10000 && d.rows.every(r=>typeof r.name==='string' && typeof r.memo==='string' && (r.closingTime===undefined||typeof r.closingTime==='string') && (r.releaseDate===undefined||typeof r.releaseDate==='string') && Array.isArray(r.values) && r.values.length===d.columns.length && r.values.every(v=>typeof v==='string') && PocoCalendar.validSchedule(r.schedule,month) && PocoCalendar.validActuals(r.actuals,month) && PocoCalendar.validPairActuals(r,d.columns,month)) && PocoCalendar.validAccounts(d,month);}
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit'}).format(new Date());
const monthValid=m=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m);
function validBook(b){
 if(!b||b.version!==2||!monthValid(b.currentMonth)||!b.months||typeof b.months!=='object'||Array.isArray(b.months))return false;
 const months=Object.entries(b.months);
 return months.length<=1200&&Object.hasOwn(b.months,b.currentMonth)&&months.every(([m,d])=>monthValid(m)&&valid(d,m));
}
let openedWithValidBook=false, editedThisPage=false;
try{
 const saved=localStorage.getItem(KEY),parsed=saved?JSON.parse(saved):null;
 openedWithValidBook=validBook(parsed);
 if(openedWithValidBook)book=parsed;
 else if(parsed&&valid(parsed,today))book={version:2,currentMonth:today,months:{[today]:parsed}};
 else if(parsed)throw Error();
 else book={version:2,currentMonth:today,months:{[today]:structuredClone(initial)}};
}catch{
 book={version:2,currentMonth:today,months:{[today]:structuredClone(initial)}};
 $('status').textContent='保存データを読めません。バックアップを読み込んでください。';
}
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
function applyAccountView(){
 if(focusedAccount!==null&&(focusedAccount<0||focusedAccount>=data.columns.length))focusedAccount=null;
 const focused=focusedAccount!==null,panel=$('tablePanel');panel.classList.toggle('account-focused',focused);panel.classList.toggle('roomy-view',roomyView);
 $('grid').style.setProperty('--account-count',focused?1:data.columns.length);
 for(const row of $('grid').rows)for(let j=0;j<data.columns.length;j++)if(row.cells[j+3])row.cells[j+3].hidden=focused&&j!==focusedAccount;
 $('viewControlsSummary').textContent=focused?`表示：${data.columns[focusedAccount]}`:'表示';
 $('roomyView').setAttribute('aria-pressed',String(roomyView));$('timeViewNote').textContent=focused&&!roomyView?'日数 ／ 時間（時:分）　各欄を押して編集':'上：日数 ／ 下：時間（時:分）　各欄を押して編集';
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
  const release=PocoRows.releaseState(row.releaseDate,book.currentMonth,date),groups=PocoRows.groupAchievements(row,data.columns,data.accountDetails);
  const metGroups=groups.map(({state},index)=>state==='met'?index+1:null).filter(Boolean);
  const hasUnmet=groups.some(({state})=>state==='unmet');
  row.values.forEach((value,account)=>{
   const td=tr.cells[account+3];if(!td)return;
   const actual=row.pairActuals?.[account]?.cheerK,met=monthView!=='time'&&PocoRows.targetState(value,actual)==='met';
   if(met)td.dataset.goalMet=PocoRows.achievementGroup(data.columns[account],data.accountDetails?.[account]);else delete td.dataset.goalMet;
   const button=td.querySelector('button');if(button&&monthView!=='time'){if(met)button.setAttribute('aria-description',`目標 ${value} K 達成済（実績 ${actual} K）`);else button.removeAttribute('aria-description');}
  });
  if(release)counts[release]++;
  if(metGroups.length)counts.met++;
  if(hasUnmet)counts.unmet++;
  const releaseMatch=release&&rowHighlights.release===release;
  const achievementMatch=rowHighlights.achievement==='met'&&metGroups.length?'met':
   rowHighlights.achievement==='unmet'&&hasUnmet?'unmet':null;
  tr.classList.toggle('release-today',Boolean(releaseMatch&&release==='today'));
  if(releaseMatch)tr.dataset.releaseMatch=release;else delete tr.dataset.releaseMatch;
  if(achievementMatch)tr.dataset.achievementMatch=achievementMatch;else delete tr.dataset.achievementMatch;
  if(metGroups.length)tr.dataset.metGroups=metGroups.join(' ');else delete tr.dataset.metGroups;
  const name=tr.querySelector('td.name .name-trigger');
  if(name){
   if(!name.querySelector('.liver-name-text')){
    const label=document.createElement('span');
    label.className='liver-name-text';
    label.textContent=row.name||'（未設定）';
    name.replaceChildren(label);
    for(const group of [1,2]){
     const badge=document.createElement('span');
     badge.className='achievement-badge';
     badge.dataset.group=group;
     badge.textContent=group;
     badge.title=`グループ${group}の目標達成`;
     badge.setAttribute('aria-hidden','true');
     name.append(badge);
    }
   }
   for(const badge of name.querySelectorAll('.achievement-badge'))badge.hidden=!metGroups.includes(Number(badge.dataset.group));
   const descriptions=groups.flatMap(({state,completed,targets},index)=>{
    if(state!=='met'&&!(state==='unmet'&&achievementMatch==='unmet'))return [];
    const label=`グループ${index+1}`;
    return [label+(state==='met'?'達成済':`未達成（${completed}/${targets}件達成）`)];
   });
   if(releaseMatch)descriptions.unshift(releaseLabels[release]);
   if(descriptions.length)name.setAttribute('aria-description',descriptions.join('、'));else name.removeAttribute('aria-description');
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
$('month').onchange=()=>{const m=$('month').value;if(!monthValid(m))return;const created=!book.months[m];if(created)book.months[m]={columns:[...data.columns],accountDetails:data.columns.map((name,index)=>({memo:'',schedule:{},group:PocoRows.achievementGroup(name,data.accountDetails?.[index])})),rows:data.rows.map(r=>({name:r.name,memo:'',closingTime:r.closingTime||'',releaseDate:'',values:data.columns.map(()=>'')}))};book.currentMonth=m;data=book.months[m];save(created);render();};
const monthly=document.createElement('section');monthly.className='panel';monthly.style.marginTop='24px';const monthlyTitle=document.createElement('h2');monthlyTitle.textContent='月別の実績（K）';const monthlyBars=document.createElement('div');monthlyBars.id='monthly';monthly.append(monthlyTitle,monthlyBars);$('summaryContent').append(monthly);
const actualSummary=document.createElement('section');actualSummary.className='panel';actualSummary.style.marginTop='12px';const actualTitle=document.createElement('h2');actualTitle.textContent='ライバー別の獲得実績';const actualWrap=document.createElement('div');actualWrap.className='table-wrap';const actualTable=document.createElement('table');actualTable.id='actualSummaryTable';actualTable.className='summary-table';actualTable.setAttribute('aria-label','記録月のライバー別獲得実績');actualWrap.append(actualTable);const pairWrap=document.createElement('div');pairWrap.className='table-wrap';const pairTable=document.createElement('table');pairTable.id='pairSummaryTable';pairTable.className='summary-table';pairWrap.append(pairTable);const legacy=document.createElement('details');legacy.className='entity-breakdown';const legacyLabel=document.createElement('summary');legacyLabel.textContent='以前のライバー単位の記録';legacy.append(legacyLabel,actualWrap);actualTitle.textContent='アカウント別の獲得実績';actualSummary.append(actualTitle,pairWrap,legacy);$('summaryContent').append(actualSummary);
function measure(values,accounts=[]){const counts=values.reduce((a,v,index)=>{const s=v.trim();if(s){a.filled++;if(/^[○〇◯]$/.test(s))a.circle++;else if(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)){const n=Number(s)*PocoCoins.accountMultiplier(accounts[index%accounts.length]);if(Number.isFinite(n)&&Number.isFinite(a.number+n))a.number+=n;}}return a;},{number:0,circle:0,filled:0});return {...counts,...PocoCoins.summarize(values,accounts)};}
const fmt=new Intl.NumberFormat('ja-JP',{maximumFractionDigits:10}).format;
let serializedBook;
function getBookPayload(){return serializedBook??=JSON.stringify(book);}
function save(edited=true){
 serializedBook=undefined;
 if(edited)editedThisPage=true;
 let stored=false;
 try{
  localStorage.setItem(KEY,getBookPayload());
  if(edited)localStorage.setItem('pocolog.pending.v1','1');
  $('status').textContent='このブラウザに保存済み';stored=true;
 }catch{$('status').textContent='保存できません。バックアップを保存してください。';}
 if(edited)window.dispatchEvent(new Event('pocolog:edit'));
 return stored;
}
function input(value,label,onchange){const el=document.createElement('input');el.value=value;el.setAttribute('aria-label',label);el.addEventListener('input',()=>{onchange(el.value);save();});return el;}
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
cheerPicker.addEventListener('focusout',event=>{if(activeCheer&&event.relatedTarget&&event.relatedTarget!==activeCheer&&!cheerPicker.contains(event.relatedTarget))closeCheerPicker();});
function visibleViewport(){
 const view=window.visualViewport;
 return {left:view?.offsetLeft||0,top:view?.offsetTop||0,width:view?.width||window.innerWidth,height:view?.height||window.innerHeight};
}
function positionCheerPicker(){
 if(!activeCheer)return;
 const rect=activeCheer.getBoundingClientRect(),view=visibleViewport();
 const actual=cheerPicker.classList.contains('actual-picker');
 const wide=actual&&view.height<420&&view.width>=480;
 const maxHeight=Math.min(actual?420:300,view.height-16),width=Math.min(actual?(wide?400:320):220,view.width-16);
 cheerPicker.classList.toggle('actual-picker-wide',wide);
 cheerPicker.style.height=actual?maxHeight+'px':'';
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
function cheerSelect(value,label,onchange,{actual=false,onDetails=null}={}){
 const trigger=document.createElement('button');trigger.type='button';trigger.className='cheer-field';trigger.setAttribute('role','combobox');trigger.setAttribute('aria-label',label);trigger.setAttribute('aria-controls','cheerChoices');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
 trigger.textContent=/^[○〇◯]$/.test(value.trim())?'〇':value;
 function open(){
  if(trigger.disabled)return;
  if(activeCheer===trigger){closeCheerPicker(true);return;}
  closeCheerPicker();activeCheer=trigger;cheerPicker.replaceChildren();cheerPicker.classList.toggle('actual-picker',actual);highlightCheer(trigger);
  const context=document.createElement('div');context.className='cheer-picker-context';
  const heading=document.createElement('div');heading.className='cheer-picker-heading';const title=document.createElement('span');title.textContent=actual?label.replace(/の実績を選択$/,'の実績（K）'):label;
  const close=document.createElement('button');close.type='button';close.textContent='閉じる';close.setAttribute('aria-label','エール選択を閉じる');close.onclick=()=>closeCheerPicker(true);heading.append(title,close);
  const jumps=document.createElement('div');jumps.className='cheer-picker-jumps';jumps.setAttribute('role','group');jumps.setAttribute('aria-label','数字の範囲へ移動');
  if(!actual)for(const start of [1,13,25,37]){const jump=document.createElement('button');jump.type='button';jump.textContent=`${start}〜${start+11}`;jump.onclick=()=>{const option=options[start+(actual?0:1)];option.focus({preventScroll:true});list.scrollTop+=option.getBoundingClientRect().top-list.getBoundingClientRect().top;};jumps.append(jump);}
  const currentText=trigger.textContent.trim().replaceAll(',','');
  let current=currentText===''?null:Number(currentText);
  const deltaButtons=[];
  const currentLabel=document.createElement('strong');currentLabel.className='actual-picker-value';currentLabel.setAttribute('role','status');
  function updateActualControls(){
   currentLabel.textContent=current===null?'未記録':`${fmt(current)} K`;
   for(const [button,delta] of deltaButtons)button.disabled=(current!==null&&!Number.isFinite(current))||(current??0)+delta<0||(current??0)+delta>1e9;
  }
  function applyChoice(choice,keepOpen=false){
   if(onchange(choice)!==false){trigger.textContent=choice;current=choice===''?null:Number(choice);save();stats();}
   if(actual)updateActualControls();
   if(!keepOpen)closeCheerPicker(true);
  }
  if(actual){
   heading.append(currentLabel);
   jumps.setAttribute('aria-label','実績を入力（K）');
   for(const number of [1,2,5,10,20,30,40]){const button=document.createElement('button');button.type='button';button.textContent=String(number);button.setAttribute('aria-label',`${number}Kを入力`);button.onclick=()=>applyChoice(String(number));jumps.append(button);}
   const adjustments=document.createElement('div');adjustments.className='actual-picker-adjustments';adjustments.setAttribute('role','group');adjustments.setAttribute('aria-label','実績を増減（K）');
   for(const delta of [-1,-5,1,5,10]){const button=document.createElement('button');button.type='button';button.textContent=`${delta<0?'−':'＋'}${Math.abs(delta)}`;button.setAttribute('aria-label',`実績を${Math.abs(delta)}K${delta<0?'減らす':'増やす'}`);button.onclick=()=>applyChoice(String(Number(((current??0)+delta).toFixed(10))),true);adjustments.append(button);deltaButtons.push([button,delta]);}
   context.append(heading,jumps,adjustments);updateActualControls();
  }else context.append(heading,jumps);
  const list=document.createElement('div');list.id='cheerChoices';list.setAttribute('role','listbox');list.setAttribute('aria-label',label+'のエール数');cheerPicker.append(context,list);
  const choices=['',...(actual?[]:['〇']),...Array.from({length:48},(_,i)=>String(i+1))];
  const options=choices.map((choice,index)=>{
   const option=document.createElement('button');option.type='button';option.setAttribute('role','option');option.setAttribute('aria-selected',String(index===0));option.tabIndex=-1;option.textContent=actual&&choice===''?'空欄（未記録）':choice;if(choice==='')option.setAttribute('aria-label','空欄');
   option.onfocus=()=>options.forEach(item=>item.setAttribute('aria-selected',String(item===option)));
   option.onclick=()=>applyChoice(choice);
   list.append(option);return option;
  });
  if(onDetails){const details=document.createElement('button');details.type='button';details.className='cheer-picker-details';details.textContent='日数・時間を入力';details.onclick=()=>{closeCheerPicker(true);onDetails();};cheerPicker.append(details);}
  cheerPicker.onkeydown=event=>{
   const index=options.indexOf(document.activeElement);let next;
   if(event.key==='ArrowDown')next=Math.min(options.length-1,index+1);
   if(event.key==='ArrowUp')next=Math.max(0,index-1);
   if(event.key==='Home')next=0;
   if(event.key==='End')next=options.length-1;
   if(next!==undefined){event.preventDefault();options[next].focus();}
   if(event.key==='Escape'){event.preventDefault();closeCheerPicker(true);}
   if(event.key==='Tab'&&!onDetails)closeCheerPicker(true);
  };
  positionCheerPicker();
  trigger.setAttribute('aria-expanded','true');cheerPicker.showPopover();list.scrollTop=0;options[0].focus({preventScroll:true});
 }
 trigger.onclick=open;
 trigger.onkeydown=event=>{if(['ArrowDown','ArrowUp','Home'].includes(event.key)){event.preventDefault();open();}};
 return trigger;
}

let lastCheerEdit=null;
function canUndoCheer(){
 const edit=lastCheerEdit;
 return edit&&edit.table===data&&data.rows.includes(edit.row)&&data.columns.length===edit.columns.length&&data.columns.every((name,index)=>name===edit.columns[index])&&data.columns[edit.index]===edit.account&&(edit.kind==='actual'?PocoCalendar.pairDetails(data,edit.row,edit.index).cheerK:edit.row.values[edit.index])===edit.next;
}
function dismissCheerUndo(){lastCheerEdit=null;$('cheerUndoBar').hidden=true;}
function changeCheer(row,index,next){
 const previous=row.values[index];if(previous===next)return;
 row.values[index]=next;lastCheerEdit={table:data,row,index,account:data.columns[index],columns:[...data.columns],previous,next};
 $('cheerUndoMessage').textContent=`${row.name}・${data.columns[index]}：${next||'空欄'}に変更`;
 $('cheerUndoBar').hidden=false;
}
function changeActualCheer(row,index,value){
 const previous=PocoCalendar.pairDetails(data,row,index).cheerK,next=value===''?null:Number(value);
 if(previous===next)return false;
 PocoCalendar.pairDetails(data,row,index,true).cheerK=next;
 lastCheerEdit={kind:'actual',table:data,row,index,account:data.columns[index],columns:[...data.columns],previous,next};
 $('cheerUndoMessage').textContent=`${row.name}・${data.columns[index]}：${next===null?'空欄':next}に変更`;$('cheerUndoBar').hidden=false;
 return true;
}
$('dismissCheerUndo').onclick=dismissCheerUndo;
$('undoCheer').onclick=()=>{
 if(!canUndoCheer()){dismissCheerUndo();return;}
 const edit=lastCheerEdit;if(edit.kind==='actual')PocoCalendar.pairDetails(data,edit.row,edit.index,true).cheerK=edit.previous;else edit.row.values[edit.index]=edit.previous;dismissCheerUndo();save();render();
 $('orderStatus').textContent=`${edit.row.name}・${edit.account}の入力を元に戻しました`;
};
const normalizeSearch=value=>value.normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/[ァ-ヶ]/g,char=>String.fromCharCode(char.charCodeAt(0)-0x60)).trim();
let foundLiverTimer,nameSearchKind='liver';
function showLiverSearchResults(){
 const query=normalizeSearch($('liverSearch').value),accountMode=nameSearchKind==='account';
 const entries=accountMode?data.columns.map((name,index)=>({name,index})):data.rows.map((row,index)=>({name:row.name,index,row}));
 const matches=entries.filter(entry=>normalizeSearch(entry.name).includes(query));
 $('searchKindLiver').setAttribute('aria-pressed',String(!accountMode));$('searchKindAccount').setAttribute('aria-pressed',String(accountMode));
 $('nameSearchLabel').textContent=accountMode?'アカウント名':'ライバー名';$('liverSearch').placeholder=accountMode?'アカウント名の一部を入力':'ライバー名の一部を入力';$('clearNameSearch').disabled=$('liverSearch').value==='';
 $('liverSearchCount').textContent=matches.length?`${matches.length}${accountMode?'アカウント':'人'} ／ ${accountMode?'名前を押すとアカウント別表示':'名前を押すと一覧へ移動'}`:`該当する${accountMode?'アカウント':'ライバー'}がありません`;
 $('liverSearchResults').replaceChildren();
 for(const entry of matches){
  const button=document.createElement('button');button.type='button';button.textContent=entry.name||'（未設定）';
  button.onclick=()=>{
   if(accountMode){
    if(data.columns[entry.index]!==entry.name)return;
    $('findLiverDialog').close();setFocusedAccount(entry.index);
    $('grid').tHead?.rows[0]?.cells[entry.index+3]?.querySelector('.name-trigger')?.focus({preventScroll:true});$('orderStatus').textContent=`${entry.name}のアカウント別表示へ移動しました`;return;
   }
   const index=data.rows.indexOf(entry.row);if(index<0)return;
   $('findLiverDialog').close();const tr=$('grid').tBodies[0]?.rows[index];if(!tr)return;
   const wrap=$('grid').parentElement;wrap.scrollTop+=tr.getBoundingClientRect().top-wrap.getBoundingClientRect().top-$('grid').tHead.getBoundingClientRect().height;
   document.querySelectorAll('#grid .found-liver').forEach(el=>el.classList.remove('found-liver'));tr.classList.add('found-liver');clearTimeout(foundLiverTimer);foundLiverTimer=setTimeout(()=>tr.classList.remove('found-liver'),2500);
   tr.querySelector('.name-trigger').focus({preventScroll:true});$('orderStatus').textContent=`${entry.name}へ移動しました`;
  };$('liverSearchResults').append(button);
 }
}
for(const [id,kind] of [['searchKindLiver','liver'],['searchKindAccount','account']])$(id).onclick=()=>{nameSearchKind=kind;showLiverSearchResults();$('findLiverDialog').scrollTop=0;};
$('clearNameSearch').onclick=()=>{$('liverSearch').value='';showLiverSearchResults();$('liverSearch').focus({preventScroll:true});};
$('findLiver').onclick=()=>{
 closeCheerPicker();closeScheduleEditor();$('liverSearch').value='';showLiverSearchResults();updateOverlayViewport();$('findLiverDialog').showModal();$('findLiverDialog').scrollTop=0;$('findLiverClose').focus({preventScroll:true});
};
$('findLiverClose').onclick=()=>$('findLiverDialog').close();
$('liverSearch').oninput=showLiverSearchResults;
$('liverSearch').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing&&event.keyCode!==229){event.preventDefault();const results=$('liverSearchResults').querySelectorAll('button');if(results.length===1)results[0].click();}});
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
 button.title=`${row.name}：タップで詳細、長押しして順番を移動（マウスはドラッグ、Alt＋↑↓でも移動）`;
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
  rowDrag={button,row,pointerId:event.pointerId,pointerType:event.pointerType,startScrollTop:$('grid').parentElement.scrollTop,startScrollLeft:$('grid').parentElement.scrollLeft,scrolling:false,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,dragging:false,target:row,after:false};
  button.setPointerCapture(event.pointerId);rowDrag.timer=setTimeout(begin,300);
 };
 button.onpointermove=event=>{
  if(!rowDrag||rowDrag.pointerId!==event.pointerId)return;
  rowDrag.x=event.clientX;rowDrag.y=event.clientY;
  if(rowDrag.pointerType==='touch'&&!rowDrag.dragging&&(rowDrag.scrolling||Math.hypot(event.clientX-rowDrag.startX,event.clientY-rowDrag.startY)>8)){
   clearTimeout(rowDrag.timer);rowDrag.scrolling=true;
   const wrap=$('grid').parentElement;
   wrap.scrollTop=rowDrag.startScrollTop+rowDrag.startY-event.clientY;
   wrap.scrollLeft=rowDrag.startScrollLeft+rowDrag.startX-event.clientX;event.preventDefault();return;
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

const dailyEditorHome=document.createComment('日別実績の通常位置');
$('liverActualEditor').before(dailyEditorHome);
function positionDailyEditor(first){
 const editor=$('liverActualEditor');
 if(first)$('pairCheerEditor').before(editor);
 else dailyEditorHome.after(editor);
}
function showCoinDialog(kind,index){
 positionDailyEditor(false);
 $('pairAccountNavigation').hidden=true;
 $('coinDialog').classList.remove('pair-actual','actual-account');$('pairCheerEditor').hidden=true;
 const isAccount=kind==='account';
 const name=isAccount?data.columns[index]:data.rows[index].name;
 const entries=isAccount?data.rows.map(row=>({name:row.name,value:row.values[index]})):data.columns.map((name,j)=>({name,value:data.rows[index].values[j]}));
 const targetRow=isAccount?null:data.rows[index];
 const current=()=>isAccount?data.columns[index]===name:data.rows[index]===targetRow;
 $('nameEdit').setAttribute('aria-label',`${isAccount?'アカウント':'ライバー'} ${name}の${isAccount?'名前・グループ':'名前'}を編集`);
 $('nameDelete').textContent=isAccount?'アカウントを削除':'ライバーを削除';
 $('nameDelete').setAttribute('aria-label',`${isAccount?'アカウント':'ライバー'} ${name}を削除`);
 $('nameEdit').textContent=isAccount?'名前・グループを編集':'名前を編集';
 $('nameEdit').onclick=()=>{
  if(!current())return;
  if(isAccount){$('coinDialog').close();openAccountEditor(index);return;}const next=prompt(`${isAccount?'アカウント':'ライバー名'}を編集`,name);if(next===null)return;
  if(isAccount)data.columns[index]=next;else targetRow.name=next;
  save();render();showCoinDialog(kind,index);
 };
 $('nameDelete').onclick=()=>{
  if(!current())return;
  const question=isAccount?accountDeletionQuestion(index):`ライバー「${name}」の記録を削除しますか？`;
  if(!confirm(question))return;
  if(isAccount)removeAccount(index);else data.rows.splice(index,1);
  save();render();
  if(isAccount){if(data.columns.length)focusAccountHeader(Math.min(index,data.columns.length-1));else $('addCol').focus({preventScroll:true});$('orderStatus').textContent=`${name}を${book.currentMonth}から削除しました。`;}
 };
 const total=measure(entries.map(entry=>entry.value),isAccount?[name]:data.columns);
 $('coinDialogTitle').textContent=`${name||'（未設定）'}の必要コイン合計`;
 $('coinDialogMonth').textContent=`${book.currentMonth} ／ ${isAccount?`アカウント別 ／ ${PocoCoins.accountMultiplier(name)}アカウント分`:'ライバー別'}`;
 $('coinDialogTotal').textContent=fmt(total.coins);
 $('coinDialogUnknown').textContent=total.unknown?`表にない値など${total.unknown}件は未算定です。表示は換算できた分の合計です。`:'';
 $('coinDialogCheer').textContent=`エール合計 ${fmt(total.number)} K ／ 仮チェック ${total.circle}件`;
 const table=$('coinDialogBreakdown');table.replaceChildren();const header=table.createTHead().insertRow();
 for(const title of [isAccount?'ライバー':'アカウント','入力エール（K）','倍率','集計エール（K）','必要コイン'])cell(header,'th').textContent=title;
 const body=table.createTBody();entries.forEach(entry=>{
  const row=body.insertRow();cell(row).textContent=entry.name;cell(row).textContent=entry.value||'—';
  const account=isAccount?name:entry.name,multiplier=PocoCoins.accountMultiplier(account),converted=PocoCoins.convert(entry.value);cell(row).textContent=`×${multiplier}`;cell(row).textContent=['known','unlisted'].includes(converted.status)?fmt(Number(entry.value)*multiplier):'—';
  cell(row).textContent=converted.status==='known'?fmt(converted.coins*multiplier):['check','blank'].includes(converted.status)?'—':'未算定';
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
 $('manageActualAccount').hidden=true;
 $('actualAccountDialog').classList.toggle('time-group',monthView==='time');$('actualAccountTitle').textContent=monthView==='time'?title.replace('獲得実績','日数・時間').replace('アカウント別実績','アカウント別日数・時間'):title;$('actualAccountMonth').textContent=book.currentMonth;
 $('openLegacyLiverActual').hidden=legacyIndex===null||!Object.keys(data.rows[legacyIndex]?.actuals||{}).length;
 $('openLegacyLiverActual').onclick=()=>{$('actualAccountDialog').close();showCoinDialog('liver',legacyIndex);};
 let sum=0,known=0;const table=$('actualAccountTable');table.replaceChildren();const head=table.createTHead().insertRow();for(const text of [label,'集計エール（K）','日数・時間'])cell(head,'th').textContent=text;
 const body=table.createTBody();for(const entry of entries){const {row,index,name}=entry,pair=PocoCalendar.pairDetails(data,row,index),total=PocoCalendar.actualTotals(pair),tr=body.insertRow(),button=document.createElement('button');button.type='button';button.textContent=name;button.onclick=()=>{const scroll=$('actualAccountDialog').scrollTop;$('actualAccountDialog').close();showPairActual(row,index,{title,label,entries,legacyIndex,scroll},monthView==='actual'&&legacyIndex!==null);};cell(tr).append(button);cell(tr).textContent=pair.cheerK===null?'未記録':PocoCoins.accountMultiplier(data.columns[index])===1?fmt(pair.cheerK):`${fmt(pair.cheerK)} × ${PocoCoins.accountMultiplier(data.columns[index])} = ${fmt(pair.cheerK*PocoCoins.accountMultiplier(data.columns[index]))}`;cell(tr).textContent=total.records?`${total.days}日 ／ ${total.timeRecords?`${Math.floor(total.minutes/60)}時間${total.minutes%60}分`:'時間未記録'}`:'未記録';if(pair.cheerK!==null){sum+=pair.cheerK*PocoCoins.accountMultiplier(data.columns[index]);known++;}}
 $('actualAccountTotal').textContent=known?fmt(sum):'未記録';updateOverlayViewport();$('actualAccountDialog').showModal();$('actualAccountDialog').scrollTop=0;
}
function showActualAccount(index){showActualGroup(`${data.columns[index]}の獲得実績`,'ライバー',data.rows.map(row=>({row,index,name:row.name})));$('manageActualAccount').hidden=false;$('manageActualAccount').onclick=()=>{$('actualAccountDialog').close();openAccountEditor(index);};}
function liverActualGroup(index){
 const row=data.rows[index];
 return {title:`${row.name}のアカウント別実績`,label:'アカウント',
  entries:data.columns.map((name,col)=>({row,index:col,name})),legacyIndex:index,scroll:0};
}
let lastDailyAccount=null;
function showActualLiver(index){
 const group=liverActualGroup(index);
 if(monthView==='actual'&&data.columns.length){
  const recent=data.columns.indexOf(lastDailyAccount);
  showPairActual(data.rows[index],focusedAccount??(recent<0?0:recent),group,true);
 }else showActualGroup(group.title,group.label,group.entries,group.legacyIndex);
}
$('actualAccountClose').onclick=()=>$('actualAccountDialog').close();
let pairReturnGroup=null,pairOpeningCheer=null,pairOpensDaily=false;
function showPairActual(row,index,returnGroup=null,daily=monthView==='time',date=null){
 const quickDaily=daily&&monthView==='actual';
 pairOpensDaily=daily;
 pairReturnGroup=returnGroup;
 $('backToActualGroup').hidden=!returnGroup;
 $('backToActualGroup').textContent=returnGroup?.legacyIndex!=null?'アカウント別一覧':'一覧へ';
 const account=data.columns[index],table=data;
 if(quickDaily)lastDailyAccount=account;
 positionDailyEditor(quickDaily);
 $('pairAccountNavigation').hidden=false;
 if(daily)$('liverActualEditor').querySelector('.day-navigation').before($('pairAccountNavigation'));
 else $('pairCheerEditor').before($('pairAccountNavigation'));
 const accounts=$('pairAccountSelect');accounts.replaceChildren();
 data.columns.forEach((name,column)=>{const option=document.createElement('option');option.value=String(column);option.textContent=name||'（未設定）';accounts.append(option);});accounts.value=String(index);
 $('coinDialog').classList.remove('actual-account');$('coinDialog').classList.add('pair-actual');$('pairCheerEditor').hidden=false;
 $('coinDialogTitle').textContent=`${row.name} × ${account}`;$('coinDialogMonth').textContent=`${book.currentMonth} ／ アカウント別実績`;
 openEntityPlanner({kind:'pair',row,index,month:book.currentMonth,table,isCurrent:()=>table===data&&data.rows.includes(row)&&data.columns[index]===account},date);
 if(quickDaily)$('actualEntryShortcut').hidden=true;
 $('previousPairLiver').disabled=data.rows.indexOf(row)===0;$('nextPairLiver').disabled=data.rows.indexOf(row)===data.rows.length-1;$('pairPosition').textContent=`${data.rows.indexOf(row)+1} / ${data.rows.length}`;
 updatePairGoalProgress();pairOpeningCheer=entityDetails().cheerK??null;$('undoPairCheer').hidden=true;$('pairCheerCustom').open=false;$('pairCurrentCheer').value=pairOpeningCheer??'';$('pairCurrentCheer').setAttribute('aria-invalid','false');syncPairCheerSelect();$('pairCheerError').textContent='';updateOverlayViewport();$('coinDialog').showModal();$('coinDialog').scrollTop=0;
 if(quickDaily){$('liverActualEditor').tabIndex=-1;$('liverActualEditor').focus({preventScroll:true});}
 else if(daily)focusActualEditor();
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
 if(!canNavigateActualEntry())return;
 const account=currentEntity.index,date=currentEntity.date;
 const returnGroup=pairReturnGroup?.legacyIndex!=null?liverActualGroup(index):pairReturnGroup;
 $('coinDialog').close();showPairActual(row,account,returnGroup,pairOpensDaily,date);
 if(!pairOpensDaily)$('pairCheerSelect').focus({preventScroll:true});
}
$('previousPairLiver').onclick=()=>movePairLiver(-1);$('nextPairLiver').onclick=()=>movePairLiver(1);
function canNavigateActualEntry(){
 if(!isActualContext())return true;
 const cheer=$('pairCurrentCheer');
 let invalid;
 if(currentEntity.kind==='pair'&&!cheer.validity.valid){$('pairCheerCustom').open=true;cheer.setAttribute('aria-invalid','true');$('pairCheerError').textContent='0以上の獲得エールを入力してください。';invalid=cheer;}
 else invalid=invalidActualDayInput();
 if(invalid){revealPlannerElement(invalid);return false;}
 return true;
}
$('pairAccountSelect').onchange=()=>{
 if(currentEntity?.kind!=='pair'||!currentEntity.isCurrent())return;
 const index=Number($('pairAccountSelect').value);if(!Number.isInteger(index)||index<0||index>=data.columns.length)return;
 if(!canNavigateActualEntry()){$('pairAccountSelect').value=String(currentEntity.index);return;}
 const row=currentEntity.row,date=currentEntity.date,returnGroup=pairReturnGroup;
 $('coinDialog').close();showPairActual(row,index,returnGroup,pairOpensDaily,date);
 if(!pairOpensDaily)$('pairAccountSelect').focus({preventScroll:true});
};
$('pairCurrentCheer').addEventListener('input',()=>{
 if(currentEntity?.kind!=='pair')return;const input=$('pairCurrentCheer');input.setAttribute('aria-invalid',String(!input.validity.valid));$('undoPairCheer').hidden=input.value===String(pairOpeningCheer??'');if(!input.validity.valid){$('pairCheerError').textContent='0以上の獲得エールを入力してください。';return;}
 const entity=entityDetails(true);if(!entity)return;entity.cheerK=input.value===''?null:Number(input.value);syncPairCheerSelect();$('undoPairCheer').hidden=entity.cheerK===pairOpeningCheer;$('pairCheerError').textContent='';updateActualTotals();stats();plannerSaved('現時点の獲得エールを保存しました。');
});
$('backToActualGroup').onclick=()=>{
 if(!pairReturnGroup||!currentEntity?.isCurrent())return;
 if(!canNavigateActualEntry())return;
 const group=pairReturnGroup;$('coinDialog').close();showActualGroup(group.title,group.label,group.entries,group.legacyIndex);$('actualAccountDialog').scrollTop=group.scroll;
};
function setPairCheer(value){
 if(currentEntity?.kind!=='pair'||!currentEntity.isCurrent())return;
 $('pairCurrentCheer').value=value??'';$('pairCurrentCheer').dispatchEvent(new Event('input',{bubbles:true}));
}
function syncPairCheerSelect(){
 const select=$('pairCheerSelect'),value=entityDetails().cheerK;select.replaceChildren();
 for(const number of [null,...Array.from({length:48},(_,index)=>index+1)]){const option=document.createElement('option');option.value=number===null?'':String(number);option.textContent=number===null?'空欄（未記録）':String(number);select.append(option);}
 if(value!==null&&(value<1||!Number.isInteger(value)||value>48)){const option=document.createElement('option');option.value=String(value);option.textContent=`${fmt(value)}（現在の値）`;if(value===0){option.disabled=true;option.hidden=true;}select.append(option);}
 select.value=value===null?'':String(value);
}
$('pairCheerSelect').onchange=()=>setPairCheer($('pairCheerSelect').value===''?null:Number($('pairCheerSelect').value));
$('undoPairCheer').onclick=()=>setPairCheer(pairOpeningCheer);
$('finishPairEntry').onclick=()=>{
 if(currentEntity?.kind!=='pair'||!canNavigateActualEntry())return;
 revealPlannerElement($('pairGoalSummary'));
};
$('finishActualEntry').onclick=()=>{if(isActualContext()&&canNavigateActualEntry())focusActualEditor();};
for(const id of ['pairCurrentCheer','actualHours','actualMinutes','actualCheer'])$(id).addEventListener('keydown',event=>{
 if(event.key!=='Enter'||event.isComposing||event.keyCode===229||!isActualContext())return;
 event.preventDefault();if(!canNavigateActualEntry())return;
 if(id==='actualHours')revealPlannerElement($('actualMinutes'));
 else if(id==='actualMinutes'&&currentEntity.kind!=='pair')revealPlannerElement($('actualCheer'));
 else $(id==='pairCurrentCheer'?'finishPairEntry':'finishActualEntry').click();
});
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
  button.onclick=()=>{if(!selectEntityDay(day.date))return;if(currentEntity.kind==='pair')focusActualEditor();else $('entityCalendar').querySelector(`[data-date="${day.date}"]`)?.focus({preventScroll:true});};calendar.append(button);
 }
 const cells=info.weekday+info.days;for(let i=cells;i<Math.ceil(cells/7)*7;i++){const empty=document.createElement('span');empty.setAttribute('aria-hidden','true');calendar.append(empty);}
}
function selectEntityDay(date){
 const entity=entityDetails();if(!entity)return false;
 if(currentEntity.date&&!canNavigateActualEntry())return false;
 currentEntity.date=date;
 const day=Number(date.slice(8));const info=PocoCalendar.monthInfo(currentEntity.month);
 $('selectedDayTitle').textContent=`${info.number}月${day}日の予定（自由入力）`;
 $('daySchedule').value=entity.schedule?.[date]||'';loadActualDay(entity,date);
 $('previousPlanDay').disabled=day===1;$('nextPlanDay').disabled=day===info.days;
 const todayDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 $('todayPlanDay').disabled=!todayDate.startsWith(currentEntity.month+'-');
 renderEntityCalendar();
 return true;
}
let lastActualAction=null;
function focusActualEditor(){
 if(!isActualContext())return;
 revealPlannerElement($('liverActualEditor'));
}
function revealPlannerElement(target){
 const dialog=$('coinDialog'),header=dialog.querySelector('.dialog-header');
 const stickyNav=currentEntity.kind==='pair'&&getComputedStyle($('pairNavigation')).position==='sticky'?$('pairNavigation').getBoundingClientRect().height+8:0;
 dialog.scrollTop+=target.getBoundingClientRect().top-dialog.getBoundingClientRect().top-header.getBoundingClientRect().height-stickyNav-12;
 if(!target.matches('button,input,select,textarea,a[href]'))target.tabIndex=-1;
 target.focus({preventScroll:true});
}
$('backToActualCalendar').onclick=()=>{
 if(!isActualContext()||!entityDetails())return;
 const selected=$('entityCalendar').querySelector(`[data-date="${currentEntity.date}"]`);
 if(selected)revealPlannerElement(selected);
};
$('goActualEntry').onclick=focusActualEditor;
$('actualPreviousDay').onclick=()=>{if(movePlanDay(-1))focusActualEditor();};
$('actualNextDay').onclick=()=>{if(movePlanDay(1))focusActualEditor();};
$('actualToday').onclick=()=>{if(selectTodayPlanDay())focusActualEditor();};
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
 if(!canNavigateActualEntry())return;
 if(!isActualContext())return;
 try{const options=actualBulkOptions(),signature=JSON.stringify(options);if(signature===actualBulkAppliedSignature)return;
  const result=PocoCalendar.bulkActuals(entityDetails().actuals,currentEntity.month,options);if(!result.applied.length)return;
  applyActualAction(result.next,`${result.applied.length}日分を反映しました。エール・予定は変更していません。`);actualBulkAppliedSignature=signature;updateActualTools();
 }catch(error){$('actualBulkPreview').textContent=error.message;}
};
function currentMissingActualDates(){
 const entity=entityDetails();if(!isActualContext()||!entity)return [];
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return PocoCalendar.missingActualDates(entity,currentEntity.month,today);
}
$('findMissingActual').onclick=()=>{
 const missing=currentMissingActualDates();if(!missing.length)return;
 if(selectEntityDay(missing.find(date=>date>currentEntity.date)||missing[0]))focusActualEditor();
};
function updateActualTools(){
 const entity=entityDetails();if(!isActualContext()||!entity)return;
 const dates=PocoCalendar.dates(currentEntity.month),index=dates.findIndex(item=>item.date===currentEntity.date),value=entity.actuals?.[currentEntity.date];
 $('actualPreviousDay').disabled=index<1;$('actualNextDay').disabled=index===dates.length-1;
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());$('actualToday').disabled=!today.startsWith(currentEntity.month+'-');
 $('copyPreviousActualTime').disabled=index<1||entity.actuals?.[dates[index-1].date]?.minutes==null;
 $('actualMinus15').disabled=!(value?.minutes>0);$('clearActualDay').disabled=!value;
 const canUndo=lastActualAction&&lastActualAction.row===entity&&lastActualAction.table===data&&JSON.stringify(entity.actuals||{})===JSON.stringify(lastActualAction.after);
 const invalidDraft=hasInvalidActualDayDraft();
 $('undoActualAction').hidden=!canUndo&&!invalidDraft;$('undoActualAction').textContent=invalidDraft?'未保存の入力を戻す':'直前の操作を元に戻す';
 const missing=currentMissingActualDates();$('actualMissingInfo').textContent=`今日までの入力待ち：${missing.length}日（予定日の未記録・実績の時間未入力）`;$('findMissingActual').disabled=!missing.length;previewActualBulk();
}
function applyActualAction(next,message){
 const entity=entityDetails(true);if(!isActualContext()||!entity)return;
 const before=structuredClone(entity.actuals||{});if(!PocoCalendar.validActuals(next,currentEntity.month))throw Error('実績の内容を確認してください。');
 entity.actuals=next;loadActualDay(entity,currentEntity.date);renderEntityCalendar();stats();const stored=plannerSaved(message);
 lastActualAction={row:entity,table:data,before,after:structuredClone(next)};updateActualTools();return stored;
}
function addActualTime(changes,message){
 if(!canNavigateActualEntry())return;
 try{const entity=entityDetails();if(!isActualContext()||!entity)return;applyActualAction(PocoCalendar.addActualMinutes(entity.actuals,changes,currentEntity.month),message);}
 catch(error){$('actualError').textContent=error.message;}
}
for(const [id,minutes] of [['actualPlus15',15],['actualPlus30',30],['actualPlus60',60],['actualMinus15',-15]])$(id).onclick=()=>{
 if(!currentEntity?.date)return;addActualTime({[currentEntity.date]:minutes},`${minutes>0?'+':''}${minutes}分を反映しました。`);
};
$('copyPreviousActualTime').onclick=()=>{
 if(!canNavigateActualEntry())return;
 const entity=entityDetails();if(!isActualContext()||!entity)return;
 const days=PocoCalendar.dates(currentEntity.month),index=days.findIndex(item=>item.date===currentEntity.date),source=entity.actuals?.[days[index-1]?.date];
 if(source?.minutes==null)return;const next=structuredClone(entity.actuals||{}),old=next[currentEntity.date]||{earnedDay:false,minutes:null,cheerK:null};
 next[currentEntity.date]={...old,earnedDay:old.earnedDay||source.minutes>0,minutes:source.minutes};
 applyActualAction(next,'前日の時間をコピーしました。エールは変更していません。');
};
$('clearActualDay').onclick=()=>{
 const entity=entityDetails();if(!isActualContext()||!entity)return;const next=structuredClone(entity.actuals||{});delete next[currentEntity.date];applyActualAction(next,'この日の実績を消去しました。「元に戻す」で復元できます。');
};
$('undoActualAction').onclick=()=>undoActualDay();
function hasInvalidActualDayDraft(){
 const hours=$('actualHours'),minutes=$('actualMinutes'),inputs=currentEntity?.kind==='pair'?[hours,minutes]:[hours,minutes,$('actualCheer')];
 return inputs.some(input=>!input.validity.valid)||Number(hours.value||0)*60+Number(minutes.value||0)>1440;
}
function undoActualDay(){
 const entity=entityDetails(),action=lastActualAction;if(!isActualContext()||!entity)return;
 if(hasInvalidActualDayDraft()){
  loadActualDay(entity,currentEntity.date);lastActualAction=action;updateActualTools();
  $('plannerStatus').textContent='未保存の入力を保存済みの値へ戻しました。';focusActualEditor();return;
 }
 if(!action||action.row!==entity||action.table!==data||JSON.stringify(entity.actuals||{})!==JSON.stringify(action.after))return;
 entity.actuals=structuredClone(action.before);actualBulkAppliedSignature='';lastActualAction=null;loadActualDay(entity,currentEntity.date);renderEntityCalendar();stats();plannerSaved('直前の実績操作を元に戻しました。');
 focusActualEditor();
}
const formatViewingMinutes=minutes=>minutes<60?`${minutes}分`:`${Math.floor(minutes/60)}時間${minutes%60?minutes%60+'分':''}`;
function previewActualRange(){
 if(!isActualContext())return;
 const start=$('actualRangeStart').value,end=$('actualRangeEnd').value;
 const previous=entityDetails()?.actuals?.[currentEntity.date]?.minutes;
 const preview=$('actualRangePreview'),button=$('applyActualRange');
 button.disabled=true;
 button.textContent=previous==null?'この日の時間に記録':'この日の時間を更新';
 if(!start||!end){
  preview.textContent=previous==null?'開始と終了を選ぶと差分を表示します。':`記録済み：${formatViewingMinutes(previous)}`;
  return;
 }
 try{
  const duration=PocoCalendar.viewingDuration(start,end);
  const label=formatViewingMinutes(duration)+(end<start?'（翌日まで）':'');
  preview.textContent=previous==null?`視聴時間：${label}`:`記録済み ${formatViewingMinutes(previous)} → ${label}`;
  button.disabled=false;
 }catch(error){preview.textContent=error.message;}
}
for(const id of ['actualRangeStart','actualRangeEnd'])$(id).addEventListener('input',previewActualRange);
$('applyActualRange').onclick=()=>{
 if(!isActualContext()||!canNavigateActualEntry())return;
 const entity=entityDetails();
 if(!entity)return;
 try{
  const duration=PocoCalendar.viewingDuration($('actualRangeStart').value,$('actualRangeEnd').value);
  const date=currentEntity.date,next=structuredClone(entity.actuals||{});
  next[date]={earnedDay:true,minutes:duration,cheerK:next[date]?.cheerK??null};
  const message=`${formatViewingMinutes(duration)}をこの日の視聴時間に記録しました。`;
  const stored=applyActualAction(next,message);
  $('actualRangePreview').textContent=stored?message:$('plannerStatus').textContent;
 }catch(error){$('actualRangePreview').textContent=error.message;}
};
let viewingCopyContext=null;
function viewingCopyChoices(){
 return [...$('viewingCopyTargets').querySelectorAll('input[type=checkbox]')];
}
function updateViewingCopySelection(){
 const count=viewingCopyChoices().filter(input=>input.checked).length;
 $('applyViewingCopy').disabled=count===0;
 $('applyViewingCopy').textContent=count?`${count}アカウントに反映`:'選んだアカウントへ反映';
}
$('openViewingCopy').onclick=()=>{
 const entity=entityDetails();
 const current=currentEntity;
 const source=entity?.actuals?.[current?.date];
 if(current?.kind!=='pair'||source?.minutes==null||!canNavigateActualEntry())return;
 const {row,index,date,month}=current;
 viewingCopyContext={current,date,sourceMinutes:source.minutes,pairs:row.pairActuals};
 $('viewingCopySource').textContent=`${row.name} × ${data.columns[index]} ／ ${date} ／ ${formatViewingMinutes(source.minutes)}`;
 $('viewingCopyStatus').textContent='';
 const targets=$('viewingCopyTargets');
 targets.replaceChildren();
 data.columns.forEach((name,targetIndex)=>{
  if(targetIndex===index)return;
  const minutes=row.pairActuals?.[targetIndex]?.actuals?.[date]?.minutes;
  const label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');
  input.type='checkbox';input.value=String(targetIndex);input.dataset.unrecorded=String(minutes==null);
  input.disabled=minutes===source.minutes;
  input.addEventListener('change',updateViewingCopySelection);
  const oldTime=minutes==null?'時間未記録':formatViewingMinutes(minutes);
  text.textContent=`${name||'（未設定）'} ／ ${input.disabled?oldTime+'（反映済み）':oldTime+' → '+formatViewingMinutes(source.minutes)}`;
  label.append(input,text);targets.append(label);
 });
 $('selectUnrecordedViewing').disabled=!viewingCopyChoices().some(input=>input.dataset.unrecorded==='true');
 updateViewingCopySelection();updateOverlayViewport();$('viewingCopyDialog').showModal();
};
$('selectUnrecordedViewing').onclick=()=>{
 for(const input of viewingCopyChoices())input.checked=input.dataset.unrecorded==='true'&&!input.disabled;
 updateViewingCopySelection();
};
$('viewingCopyDialog').addEventListener('close',()=>{viewingCopyContext=null;});
$('applyViewingCopy').onclick=()=>{
 const context=viewingCopyContext,entity=entityDetails();
 if(!context||context.current!==currentEntity||context.date!==currentEntity.date||
    context.sourceMinutes!==entity?.actuals?.[context.date]?.minutes||context.pairs!==currentEntity.row.pairActuals){
  $('viewingCopyStatus').textContent='記録が変わりました。閉じて開き直してください。';return;
 }
 const selected=viewingCopyChoices().filter(input=>input.checked&&!input.disabled).map(input=>Number(input.value));
 if(!selected.length)return;
 const {row,index,date,month}=currentEntity;
 try{
  row.pairActuals=PocoCalendar.copyViewingTime(data,row,index,selected,date,month);
  const message=`${selected.length}アカウントへ${formatViewingMinutes(context.sourceMinutes)}を反映しました。`;
  stats();
  if(plannerSaved(message)){
   $('viewingCopyDialog').close();$('actualRangePreview').textContent=message;
  }else{
   $('viewingCopyStatus').textContent=$('plannerStatus').textContent;
   $('applyViewingCopy').disabled=true;
  }
 }catch(error){$('viewingCopyStatus').textContent=error.message;}
};
function updateViewingGoal(total){
 const pair=currentEntity.kind==='pair';
 $('viewingGoal').hidden=!pair;
 if(!pair)return;
 const raw=currentEntity.row.values[currentEntity.index];
 const hasGoal=PocoRows.targetState(raw,null)!==null;
 const required=hasGoal?PocoCoins.viewingMinutes(Number(raw)):null;
 $('viewingRequired').textContent=required===null?(hasGoal?'未確認':'目標未設定'):formatViewingMinutes(required);
 $('viewingCurrent').textContent=total.timeRecords?formatViewingMinutes(total.minutes):'未記録';
 $('viewingRemaining').textContent=required===null?'—':formatViewingMinutes(Math.max(0,required-total.minutes));
 $('viewingGoalNote').textContent=required!==null?'視聴時間の目安です。エール獲得にはコイン・日数などの条件もあります。':
  hasGoal?'このエール級の必要時間はPocochaアプリで確認してください。':'月目標に数値を入れると、確認済みの条件を表示します。';
}
function updateActualTotals(){
 if(!isActualContext())return;
 const total=PocoCalendar.actualTotals(entityDetails());
 $('actualTotalDays').textContent=total.records?`${total.days}日`:'未記録';
 $('actualTotalTime').textContent=total.timeRecords?`${Math.floor(total.minutes/60)}時間${total.minutes%60}分`:'未記録';
 $('actualTotalCheer').textContent=currentEntity.kind==='pair'?(entityDetails().cheerK===null?'未記録':fmt(entityDetails().cheerK)+' K'):total.cheerRecords?`${fmt(total.cheerK)} K`:'未記録';
 updateViewingGoal(total);
 $('openViewingCopy').hidden=currentEntity.kind!=='pair'||data.columns.length<2||
  entityDetails()?.actuals?.[currentEntity.date]?.minutes==null;
 const history=$('actualHistoryRows');history.replaceChildren();for(const [date,value] of Object.entries(entityDetails().actuals||{}).sort(([a],[b])=>a.localeCompare(b))){const button=document.createElement('button');button.type='button';button.textContent=`${Number(date.slice(5,7))}/${Number(date.slice(8))} ／ ${value.earnedDay?'1日':'日数対象外'} ／ ${value.minutes===null?'時間未記入':`${Math.floor(value.minutes/60)}時間${value.minutes%60}分`}`+(currentEntity.kind==='pair'?'':` ／ ${value.cheerK===null?'エール未記入':fmt(value.cheerK)+' K'}`);button.onclick=()=>{if(selectEntityDay(date))focusActualEditor();};history.append(button);}
 if(!history.childElementCount)history.textContent='実績はまだありません。';updateActualTools();
}
function loadActualDay(entity,date){
 if(!isActualContext())return;
 lastActualAction=null;$('actualRangeStart').value='';$('actualRangeEnd').value='';
 const value=entity.actuals?.[date];
 $('actualDayTitle').textContent=`${Number(date.slice(5,7))}月${Number(date.slice(8))}日の獲得実績`;
 $('actualEarnedDay').checked=value?.earnedDay||false;
 $('actualHours').value=value?.minutes==null?'':Math.floor(value.minutes/60);
 $('actualMinutes').value=value?.minutes==null?'':value.minutes%60;
 $('actualCheer').value=value?.cheerK??'';$('actualError').textContent='';
 for(const id of ['actualHours','actualMinutes','actualCheer'])$(id).setAttribute('aria-invalid','false');
 $('actualMinutes').enterKeyHint=currentEntity.kind==='pair'?'done':'next';
 updateActualTotals();previewActualRange();
}
function invalidActualDayInput(){
 const hours=$('actualHours'),minutes=$('actualMinutes'),inputs=currentEntity.kind==='pair'?[hours,minutes]:[hours,minutes,$('actualCheer')];
 for(const input of inputs)input.setAttribute('aria-invalid',String(!input.validity.valid));
 const invalid=inputs.find(input=>!input.validity.valid);
 if(invalid){$('actualError').textContent='時間・分・エールは範囲内の数値を入力してください。';return invalid;}
 if(Number(hours.value||0)*60+Number(minutes.value||0)>1440){hours.setAttribute('aria-invalid','true');minutes.setAttribute('aria-invalid','true');$('actualError').textContent='1日の時間は24時間以内で入力してください。';return hours;}
 $('actualError').textContent='';return null;
}
function saveActualDay(event){
 if(!isActualContext())return;const entity=entityDetails();if(!entity)return;
 const hours=$('actualHours'),minutes=$('actualMinutes'),cheer=$('actualCheer');
 if(invalidActualDayInput()){updateActualTools();return;}
 const duration=hours.value===''&&minutes.value===''?null:Number(hours.value||0)*60+Number(minutes.value||0);
 const cheerK=currentEntity.kind==='pair'?(entity.actuals?.[currentEntity.date]?.cheerK??null):cheer.value===''?null:Number(cheer.value);
 if(event.target!==$('actualEarnedDay')&&(duration>0||cheerK>0))$('actualEarnedDay').checked=true;
 const before=structuredClone(entity.actuals||{}),target=entityDetails(true);
 PocoCalendar.setActual(target,currentEntity.date,{earnedDay:$('actualEarnedDay').checked,minutes:duration,cheerK},currentEntity.month);
 if(JSON.stringify(before)!==JSON.stringify(target.actuals||{}))lastActualAction={row:target,table:data,before,after:structuredClone(target.actuals||{})};
 $('actualError').textContent='';updateActualTotals();renderEntityCalendar();stats();plannerSaved();previewActualRange();
}
for(const id of ['actualHours','actualMinutes','actualCheer'])$(id).addEventListener('input',saveActualDay);
$('actualEarnedDay').addEventListener('change',saveActualDay);
function movePlanDay(offset){
 if(!entityDetails()||!currentEntity.date)return;
 const day=Number(currentEntity.date.slice(8))+offset,info=PocoCalendar.monthInfo(currentEntity.month);
 if(day<1||day>info.days)return;
 return selectEntityDay(`${currentEntity.month}-${String(day).padStart(2,'0')}`);
}
$('previousPlanDay').onclick=()=>movePlanDay(-1);
$('nextPlanDay').onclick=()=>movePlanDay(1);
$('todayPlanDay').onclick=selectTodayPlanDay;
function selectTodayPlanDay(){
 if(!entityDetails())return;
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(date.startsWith(currentEntity.month+'-'))return selectEntityDay(date);
}
function openEntityPlanner(target,date=null){
 currentEntity=target;
 const actual=isActualContext(),pair=target.kind==='pair';
 $('planDayNavigation').hidden=actual;
 $('actualDayHelp').textContent=(pair?'0分を超えると日数にも数えます。':'時間やエールが0を超えると日数にも数えます。')+' 空欄は未記録、0は実績0です。1日24時間まで入力できます。';
 $('actualSummaryNote').textContent=pair?'日数・時間は今月の合計です。':'ライバー単位の旧記録です。';
 $('actualEntryShortcut').hidden=!actual;$('actualHistory').open=false;
 $('liverActualSummary').hidden=!actual;$('liverActualEditor').hidden=!actual;
 const entity=entityDetails();$('entityMemo').value=entity?.memo||'';$('plannerStatus').textContent='';

 const japanDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 selectEntityDay(date||(japanDate.startsWith(target.month+'-')?japanDate:target.month+'-01'));
 document.querySelector('.entity-breakdown').open=false;if(isActualContext())resetActualBulk();
}
function plannerSaved(message=''){
 const stored=save();$('plannerStatus').textContent=stored?`${message||'記録しました。'}（端末内）`:'保存できません。バックアップを保存してください。';
 return stored;
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
 if(!canUndoCheer())dismissCheerUndo();else $('cheerUndoBar').hidden=monthView!==(lastCheerEdit.kind==='actual'?'actual':'goal');
 if($('findLiverDialog').open)$('findLiverDialog').close();
 clearRowDrag();
 if(rowSort.month!==book.currentMonth)rowSort={field:null,direction:1,month:book.currentMonth};
 closeCheerPicker();
 if($('accountEditor').open)$('accountEditor').close();
 if($('coinDialog').open)$('coinDialog').close();if($('actualAccountDialog').open)$('actualAccountDialog').close();
 closeScheduleEditor();
 $('tablePanel').classList.toggle('actual-view',monthView!=='goal');$('tablePanel').classList.toggle('time-view',monthView==='time');$('timeViewNote').hidden=monthView!=='time';$('monthViewTime').setAttribute('aria-pressed',String(monthView==='time'));$('monthViewGoal').setAttribute('aria-pressed',String(monthView==='goal'));$('monthViewActual').setAttribute('aria-pressed',String(monthView==='actual'));$('addCol').hidden=false;
 const table=$('grid');table.setAttribute('aria-label',monthView==='time'?'ポコログの日数・時間一覧':monthView==='actual'?'ポコログの月実績一覧':'ポコログの月目標一覧');table.style.setProperty('--account-count',data.columns.length);table.style.setProperty('--compact-table-min-width',data.columns.length>15?`${106+data.columns.length*13}px`:'286px');table.replaceChildren();const head=table.createTHead().insertRow();
 cell(head,'th').textContent='ライバー名';
 sortHeader(head,'closingTime','締め','closing-col');sortHeader(head,'releaseDate','解禁日','release-col');
 data.columns.forEach((c,j)=>{
  const th=cell(head,'th');const group=PocoRows.achievementGroup(c,data.accountDetails?.[j]);th.dataset.accountGroup=group;th.setAttribute('aria-description',`目標達成の第${group}グループ。集計は${PocoCoins.accountMultiplier(c)}アカウント分`);th.title=`エール・コインの集計：${PocoCoins.accountMultiplier(c)}アカウント分`;th.append(nameControls(c,'アカウント',()=>monthView!=='goal'?showActualAccount(j):showCoinDialog('account',j)));if(monthView!=='goal')th.querySelector('button').setAttribute('aria-label',`アカウント ${c}の${monthView==='time'?'日数・時間':'獲得実績'}`);
 });
 if(monthView==='goal'){cell(head,'th','extra-col').textContent='合計（K）';cell(head,'th','extra-col').textContent='必要コイン';}cell(head,'th','extra-col').textContent='メモ';
 const body=table.createTBody();
 data.rows.forEach((r,i)=>{
  const tr=body.insertRow();const nameCell=cell(tr,'td','name');nameCell.append(nameControls(r.name,'ライバー',()=>monthView!=='goal'?showActualLiver(i):showCoinDialog('liver',i)));attachRowDrag(nameCell.querySelector('button'),r,tr);if(monthView!=='goal')nameCell.querySelector('button').setAttribute('aria-label',`ライバー ${r.name}の日数・時間`);
  cell(tr,'td','closing-col').append(scheduleField(r,'closingTime','締め'));cell(tr,'td','release-col').append(scheduleField(r,'releaseDate','解禁日'));
  if(monthView!=='goal'){
   data.columns.forEach((account,j)=>{const td=cell(tr),pair=PocoCalendar.pairDetails(data,r,j),button=monthView==='actual'?cheerSelect(pair.cheerK===null?'':String(pair.cheerK),`${r.name}・${account}の実績を選択`,value=>changeActualCheer(r,j,value),{actual:true,onDetails:()=>showPairActual(r,j,liverActualGroup(i),true)}):document.createElement('button');button.type='button';button.classList.add('cheer-field','pair-actual-cell');if(monthView==='time')button.classList.add('pair-time-cell');button.dataset.actualAccount=j;paintPairActualCell(button,pair);button.title=`${r.name} × ${account}：${monthView==='actual'?'数字を選択。日数・時間は詳細入力から':'日数・時間を記録'}`;if(monthView==='time'){button.setAttribute('aria-label',`${r.name}・${account}の日数・時間を編集`);button.onclick=()=>showPairActual(r,j);}td.append(button);});
  }else{
  r.values.forEach((v,j)=>{
   const td=cell(tr);td.append(cheerSelect(v,`${r.name}・${data.columns[j]}`,v=>changeCheer(r,j,v)));
  });
  const total=cell(tr,'td','total extra-col');total.dataset.row=i;
  const coins=cell(tr,'td','total coin-total extra-col');coins.dataset.coinRow=i;
  }
  cell(tr,'td','memo extra-col').append(input(r.memo,`${r.name}のメモ`,v=>r.memo=v));
 });
 applyAccountView();stats(false);
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
let summaryDirty=true;
function stats(repaintActual=true){
 summaryDirty=true;
 const liverTotals=data.rows.map(r=>({name:r.name,...measure(r.values,data.columns)}));
 const all=liverTotals.reduce((total,row)=>{
  for(const key of Object.keys(total)){
   if(key!=='number'||Number.isFinite(total.number+row.number))total[key]+=row[key];
  }
  return total;
 },{number:0,circle:0,filled:0,coins:0,unknown:0});
 $('people').textContent=data.rows.length;$('sum').textContent=fmt(all.number);$('circles').textContent=all.circle;$('filled').textContent=all.filled;
 $('coinSum').textContent=fmt(all.coins);$('coinUnknown').textContent=all.unknown?`別途、未算定のセルが${all.unknown}件あります`:'';
 document.querySelectorAll('[data-row]').forEach(e=>e.textContent=fmt(liverTotals[Number(e.dataset.row)].number));
 document.querySelectorAll('[data-coin-row]').forEach(e=>e.textContent=coinText(liverTotals[Number(e.dataset.coinRow)]));
 if(repaintActual)refreshActualGrid();
 applyRowHighlights();updatePairGoalProgress();if(lastCheerEdit&&!canUndoCheer())dismissCheerUndo();
 if($('summaryDialog').open)renderSummary(liverTotals);
}
function renderSummary(liverTotals=data.rows.map(r=>({name:r.name,...measure(r.values,data.columns)}))){
 const months=Object.entries(book.months).sort(([a],[b])=>a.localeCompare(b)).map(([name,d])=>({name,...measure(d.rows.flatMap(r=>r.values),d.columns)}));
 $('monthly').replaceChildren();const monthMax=Math.max(0,...months.map(m=>m.number));months.forEach(m=>bar($('monthly'),m.name,m.number,monthMax,fmt(m.number)+' K'));
 const metric=$('metric').value;const ranked=[...liverTotals].sort((a,b)=>b[metric]-a[metric]);
 $('ranking').replaceChildren();const max=Math.max(0,...ranked.map(r=>r[metric]));
 ranked.forEach(r=>bar($('ranking'),r.name,r[metric],max,metric==='coins'?coinText(r):undefined));
 if(!ranked.length)$('ranking').textContent='ライバーを追加すると集計が表示されます。';
 const cols=data.columns.map((name,j)=>({name,...measure(data.rows.map(r=>r.values[j]),[name])}));
 $('columns').replaceChildren();const colmax=Math.max(0,...cols.map(c=>c.number));cols.forEach(c=>bar($('columns'),c.name,c.number,colmax,`${fmt(c.number)} ／ ${c.circle} ／ ${c.filled}`));
 coinSummary('liverCoins',liverTotals);coinSummary('accountCoins',cols);
 const pairs=$('pairSummaryTable');pairs.replaceChildren();const pairHead=pairs.createTHead().insertRow();for(const title of ['ライバー','アカウント','入力エール（K）','倍率','集計エール（K）','日数','時間'])cell(pairHead,'th').textContent=title;const pairBody=pairs.createTBody();
 for(const row of data.rows)data.columns.forEach((account,index)=>{const pair=row.pairActuals?.[index];if(!pair)return;const total=PocoCalendar.actualTotals(pair),tr=pairBody.insertRow();for(const value of [row.name,account,pair.cheerK===null?'未記録':fmt(pair.cheerK),`×${PocoCoins.accountMultiplier(account)}`,pair.cheerK===null?'未記録':fmt(pair.cheerK*PocoCoins.accountMultiplier(account)),total.records?total.days+'日':'未記録',total.timeRecords?`${Math.floor(total.minutes/60)}時間${total.minutes%60}分`:'未記録'])cell(tr).textContent=value;});
 if(!pairBody.rows.length){const td=cell(pairBody.insertRow());td.colSpan=7;td.textContent='月実績の各アカウント欄から記録できます。';}
 const actuals=$('actualSummaryTable');actuals.replaceChildren();const actualHead=actuals.createTHead().insertRow();for(const title of ['ライバー','記録日数','記録時間','実獲得エール（K）'])cell(actualHead,'th').textContent=title;
 const actualBody=actuals.createTBody();for(const row of data.rows){const total=PocoCalendar.actualTotals(row),tr=actualBody.insertRow();for(const value of [row.name,total.records?`${total.days}日`:'未記録',total.timeRecords?`${Math.floor(total.minutes/60)}時間${total.minutes%60}分`:'未記録',total.cheerRecords?fmt(total.cheerK):'未記録'])cell(tr).textContent=value;}
 summaryDirty=false;
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
 document.documentElement.classList.toggle('short-viewport',view.height<420);
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
let accountEditorContext=null;
function removeAccount(index){
 if(focusedAccount===index)focusedAccount=null;else if(focusedAccount!==null&&focusedAccount>index)focusedAccount--;
 data.columns.splice(index,1);if(data.accountDetails)data.accountDetails.splice(index,1);
 data.rows.forEach(row=>{row.values.splice(index,1);if(row.pairActuals)row.pairActuals.splice(index,1);});
}
function openAccountEditor(index=null){
 if(!gridEditingEnabled)return;
 if(index===null&&data.columns.length>=100)return alert('自分アカウントは100件までです。');
 accountEditorContext={table:data,month:book.currentMonth,index};
 $('accountEditorScope').textContent=`対象：${book.currentMonth.replace('-', '年')}月。ほかの月は変わりません。新しい月には名前とグループを引き継ぎます。`;
 $('accountName').removeAttribute('aria-invalid');
 $('accountEditorTitle').textContent=index===null?'自分アカウントを追加':'自分アカウントの設定';
 $('accountName').value=index===null?'':data.columns[index];
 const group=index===null?2:PocoRows.achievementGroup(data.columns[index],data.accountDetails?.[index]);
 document.querySelector(`#accountEditorForm input[name=accountGroup][value="${group}"]`).checked=true;
 $('accountEditorSubmit').textContent=index===null?'追加':'変更を保存';
 $('deleteAccount').hidden=index===null;$('accountEditorError').textContent='';
 $('accountEditor').showModal();
}
function focusAccountHeader(index){$('grid').tHead?.rows[0].cells[index+3]?.querySelector('.name-trigger')?.focus({preventScroll:true});}
function accountDeletionQuestion(index){return `${book.currentMonth}の「${data.columns[index]}」を削除しますか？ このアカウントの目標・実績・メモ・予定を削除します。他のアカウントと他の月は残ります。`;}
$('accountName').addEventListener('input',()=>{$('accountName').removeAttribute('aria-invalid');$('accountEditorError').textContent='';});
function accountEditorIsCurrent(){return gridEditingEnabled&&accountEditorContext?.table===data&&accountEditorContext.month===book.currentMonth;}
$('addCol').onclick=()=>openAccountEditor();
$('accountEditorClose').onclick=()=>$('accountEditor').close();
$('accountEditorForm').onsubmit=event=>{
 event.preventDefault();if(!accountEditorIsCurrent())return;
 const name=$('accountName').value.trim(),group=Number(document.querySelector('#accountEditorForm input[name=accountGroup]:checked')?.value),index=accountEditorContext.index;
 if(!name||name.length>100||![1,2].includes(group)){$('accountEditorError').textContent='アカウント名を1〜100文字で入力し、グループを選んでください。';$('accountName').setAttribute('aria-invalid','true');$('accountName').focus();return;}
 if(data.columns.some((existing,j)=>j!==index&&existing.trim()===name)){$('accountEditorError').textContent='同じ名前のアカウントがあります。別の名前を入力してください。';$('accountName').setAttribute('aria-invalid','true');$('accountName').focus();return;}
 if(index!==null&&name===data.columns[index]&&group===PocoRows.achievementGroup(data.columns[index],data.accountDetails?.[index])){$('accountEditor').close();focusAccountHeader(index);return;}
 if(index===null){
  if(data.columns.length>=100)return;
  const details=data.columns.map((_,j)=>({...PocoCalendar.accountDetails(data,j),group:PocoRows.achievementGroup(data.columns[j],data.accountDetails?.[j])}));
  data.columns.push(name);data.accountDetails=[...details,{memo:'',schedule:{},group}];
  data.rows.forEach(row=>{row.values.push('');if(row.pairActuals)row.pairActuals.push(null);});focusedAccount=null;
 }else{const details=PocoCalendar.accountDetails(data,index,true);details.group=group;data.columns[index]=name;}
 $('accountEditor').close();save();render();
 focusAccountHeader(index??data.columns.length-1);
 $('orderStatus').textContent=`${name}をグループ${group}で${index===null?'追加':'変更'}しました。`;
 if(index===null){revealGridColumn(data.columns.length-1);markAddedName($('grid').tHead.rows[0].cells[data.columns.length+2].querySelector('.name-trigger'),'自分アカウントを追加しました。');}
};
$('deleteAccount').onclick=()=>{
 if(!accountEditorIsCurrent()||accountEditorContext.index===null)return;
 const index=accountEditorContext.index;
 if(!confirm(accountDeletionQuestion(index)))return;
 const name=data.columns[index];
 $('accountEditor').close();removeAccount(index);save();render();
 if(data.columns.length)focusAccountHeader(Math.min(index,data.columns.length-1));else $('addCol').focus({preventScroll:true});
 $('orderStatus').textContent=`${name}を${book.currentMonth}から削除しました。`;
};
$('metric').onchange=()=>renderSummary();
$('tableMode').onclick=()=>{const expanded=$('tablePanel').classList.toggle('table-detail');$('tableMode').setAttribute('aria-pressed',String(expanded));$('tableMode').textContent=expanded?'一覧に戻る':'編集・詳細';toolsMenu.open=false;refreshTableViewport();};
const publicShareUrl=$('publicShareUrl');
const shareUrlDialog=$('shareUrlDialog');
$('shareUrl').onclick=async()=>{
 if(typeof navigator.share==='function'){
  try{
   await navigator.share({title:'ポコログ',url:publicShareUrl.value});
   return;
  }catch(error){
   if(error.name==='AbortError')return;
  }
 }
 $('shareUrlStatus').textContent='';
 updateOverlayViewport();
 shareUrlDialog.showModal();
};
$('copyShareUrl').onclick=async()=>{
 try{
  await navigator.clipboard.writeText(publicShareUrl.value);
  $('shareUrlStatus').textContent='URLをコピーしました。';
 }catch{
  publicShareUrl.focus();
  publicShareUrl.select();
  $('shareUrlStatus').textContent='選択したURLをコピーしてください。';
 }
};
$('syncInfo').onclick=()=>{updateOverlayViewport();$('syncInfoDialog').showModal();};
$('closeSyncInfo').onclick=()=>$('syncInfoDialog').close();
$('openSummary').onclick=()=>{if(summaryDirty)renderSummary();updateOverlayViewport();$('summaryDialog').showModal();$('summaryDialog').scrollTop=0;};
$('closeSummary').onclick=()=>$('summaryDialog').close();
let refreshLabelTimer;
$('refresh').onclick=async()=>{
 const button=$('refresh'),current=document.querySelector('meta[name=pocolog-build]')?.content;
 clearTimeout(refreshLabelTimer);
 button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='確認中';
 try{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),5000);
  let latest;
  try{
   const response=await fetch('./version.json',{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error('版を確認できません');
   latest=(await response.json()).version;
   if(!/^[a-f0-9]{16}$/.test(latest))throw Error('版を確認できません');
  }catch{
   button.textContent='再試行';
   return;
  }finally{clearTimeout(timeout);}
  if(latest===current){
   button.textContent='最新版';
   return;
  }
  const payload=getBookPayload();
  if(localStorage.getItem(KEY)!==payload)localStorage.setItem(KEY,payload);
  location.reload();
 }catch{
  button.textContent='保存失敗';
  $('status').textContent='保存できないため更新を中止しました。バックアップを保存してください。';
 }finally{
  button.disabled=false;button.removeAttribute('aria-busy');
  refreshLabelTimer=setTimeout(()=>{button.textContent='更新';},2400);
 }
};
function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download').onclick=()=>download(JSON.stringify(book,null,2),'application/json','pocolog-backup.json');
$('upload').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>10000000)throw Error();const next=JSON.parse(await f.text());if(!validBook(next)&&!valid(next,book.currentMonth))throw Error();if(confirm('全月の記録をバックアップの内容で置き換えますか？')){book=validBook(next)?next:{version:2,currentMonth:book.currentMonth,months:{[book.currentMonth]:next}};addMoeAccount();PocoRows.addExtraAccounts(book);addPhotoLivers();rowSort={field:null,direction:1,month:book.currentMonth};data=book.months[book.currentMonth];$('month').value=book.currentMonth;save();render();}}catch{alert('読み込めませんでした。ポコログのJSONバックアップを選択してください。');}e.target.value='';};
$('csv').onclick=()=>{const quote=s=>'"'+String(s).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';if(monthView==='time'){const rows=[['ライバー名','アカウント','記録日数','記録時間（分）','メモ']];for(const row of data.rows){data.columns.forEach((account,index)=>{const pair=PocoCalendar.pairDetails(data,row,index),total=PocoCalendar.actualTotals(pair);rows.push([row.name,account,total.records?total.days:'',total.timeRecords?total.minutes:'',pair.memo]);});const legacy=PocoCalendar.actualTotals(row);if(legacy.records)rows.push([row.name,'以前のライバー単位の記録',legacy.days,legacy.timeRecords?legacy.minutes:'',row.memo]);}download('\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8','pocolog-time.csv');return;}if(monthView==='actual'){const rows=[['ライバー名','アカウント','入力エール（K）','集計倍率','集計エール（K）','記録日数','記録時間（分）','メモ']];for(const row of data.rows){data.columns.forEach((account,index)=>{const pair=PocoCalendar.pairDetails(data,row,index),total=PocoCalendar.actualTotals(pair);rows.push([row.name,account,pair.cheerK??'',PocoCoins.accountMultiplier(account),pair.cheerK===null?'':pair.cheerK*PocoCoins.accountMultiplier(account),total.records?total.days:'',total.timeRecords?total.minutes:'',pair.memo]);});const legacy=PocoCalendar.actualTotals(row);if(legacy.records)rows.push([row.name,'以前のライバー単位の記録',legacy.cheerRecords?legacy.cheerK:'',1,legacy.cheerRecords?legacy.cheerK:'',legacy.days,legacy.timeRecords?legacy.minutes:'',row.memo]);}download('\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8','pocolog-actual.csv');return;}const rows=[['ライバー名','締め','解禁日',...data.columns,'エール合計（倍率込み・K）','必要コイン（倍率込み・換算済み分）','未算定セル数','メモ','記録日数','記録時間（分）','実獲得エール（K）'],...data.rows.map(r=>{const total=measure(r.values,data.columns);const actual=PocoCalendar.actualTotals(r);return [r.name,r.closingTime||'',PocoRows.formatRelease(r.releaseDate,book.currentMonth),...r.values,total.number,total.coins,total.unknown,r.memo,actual.records?actual.days:'',actual.timeRecords?actual.minutes:'',actual.cheerRecords?actual.cheerK:''];})];download('\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8','pocolog.csv');};
const reference=$('coinReference');const referenceHead=reference.createTHead().insertRow();
cell(referenceHead,'th').textContent='エール（K）';cell(referenceHead,'th').textContent='必要コイン（条件1）';
const referenceBody=reference.createTBody();PocoCoins.tiers.forEach(([level,coins])=>{const row=referenceBody.insertRow();cell(row).textContent=fmt(level);cell(row).textContent=fmt(coins);});
render();

function installBook(next){
 const previous=book,previousPayload=serializedBook,selected=book.currentMonth;
 const migrated=PocoRows.addExtraAccounts(next);
 if(next.months[selected])next.currentMonth=selected;
 const reuseMonth=selected===next.currentMonth&&JSON.stringify(data)===JSON.stringify(next.months[selected]);
 if(reuseMonth)next.months[selected]=data;
 book=next;
 if(!save(false)){book=previous;serializedBook=previousPayload;throw Error('端末に保存できません。バックアップを保存してください。');}
 if(reuseMonth){
  summaryDirty=true;
  if($('summaryDialog').open)renderSummary();
 }else{
  data=book.months[book.currentMonth];$('month').value=book.currentMonth;
  rowSort={field:null,direction:1,month:book.currentMonth};render();
 }
 return migrated;
}
window.pocolog = {
 getBook:()=>structuredClone(book),
 getPayload:getBookPayload,
 localBookState:()=>({valid:openedWithValidBook,edited:editedThisPage}),
 setBook(next){
  if(!validBook(next))throw Error('共有データの形式を確認できません。');
  return installBook(structuredClone(next));
 },
 setBookPayload(payload, beforeApply){
  let next;
  try{next=JSON.parse(payload);}catch{}
  if(!validBook(next))throw Error('共有データの形式を確認できません。');
  beforeApply();
  return installBook(next);
 },
 setEditing(enabled){gridEditingEnabled=enabled;if(!enabled){clearRowDrag();closeCheerPicker();$('accountEditor').close();}document.querySelectorAll('#grid input,#grid select,#grid button,#addRow,#addCol,#upload,#month,#undoCheer').forEach(el=>el.disabled=!enabled);document.querySelectorAll('#grid .sort-label').forEach(el=>{el.setAttribute('aria-disabled',String(!enabled));el.tabIndex=enabled?0:-1;});},
 downloadBackup:(backup=book)=>download(JSON.stringify(backup,null,2),'application/json','pocolog-unsynced-backup.json')
};
