(() => {
  const weekdays = '日月火水木金土';
  const clean = value => String(value ?? '').normalize('NFKC').replace(/[～~]/g, '〜').replace(/(\d)\s*[:：]\s*(\d)/g, '$1:$2').replace(/(\d)\s+([年月日/])/g, '$1$2').replace(/([年月/])\s+(?=\d)/g, '$1').replace(/([\u3040-\u30ff\u3400-\u9fff])\s+(?=[\u3040-\u30ff\u3400-\u9fff])/g,'$1').trim();
  const dateKey = (year, month, day) => `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const validDate = (date, month) => PocoCalendar.validSchedule({[date]:''}, month);
  const meaningful = text => text && !/^[\d\s.,・/|〜-]+$/.test(text) && !/^[日月火水木金土\s・、,()曜日]+$/.test(text);
  const withoutWeekday = text => clean(text).replace(/^\s*[（(]?[日月火水木金土](?:曜日?)?[)）]\s*/, '').replace(/^\s*[:：・|]\s*/, '').trim();
  function combineText(before, after) {
    const lines = before ? before.split('\n') : [];
    for (const line of after.split('\n').map(line=>line.trim()).filter(Boolean)) if (!lines.some(old=>old.trim()===line)) lines.push(line);
    return lines.join('\n');
  }
  function dateMatches(line, year) {
    const matches = [];
    for (const pattern of [/(?:(\d{4})[年/])?(\d{1,2})[月/](\d{1,2})日?/g, /(\d{4})-(\d{2})-(\d{2})/g]) {
      for (const match of line.matchAll(pattern)) matches.push({index:match.index,end:match.index+match[0].length,date:dateKey(match[1]||year,Number(match[2]),Number(match[3]))});
    }
    return matches.sort((a,b)=>a.index-b.index).filter((item,index,array)=>index===0||item.index>=array[index-1].end);
  }
  function parseText(text, month) {
    const info = PocoCalendar.monthInfo(month); if (!info) return {entries:[],warnings:['対象月を確認してください。']};
    const byDate = new Map(), warnings = new Set(); let current = null, contextMonth = info.number, contextYear = info.year;
    const add = (date, value) => {
      const content = withoutWeekday(value);
      if (!validDate(date,month)) { warnings.add('対象月以外の日付や存在しない日付を除外しました。'); return; }
      if (meaningful(content)) byDate.set(date,combineText(byDate.get(date)||'',content));
    };
    for (const raw of String(text||'').split(/\r?\n/)) {
      const line=clean(raw);if(!line)continue;
      const matches=dateMatches(line,contextYear);
      if (matches.length) {
        if(matches.length===2 && /^[\s〜\-–—至]+$/.test(line.slice(matches[0].end,matches[1].index)) && matches[0].date<=matches[1].date && validDate(matches[0].date,month)&&validDate(matches[1].date,month)) {
          for(const day of PocoCalendar.dates(month))if(day.date>=matches[0].date&&day.date<=matches[1].date)add(day.date,line.slice(matches[1].end));current=null;continue;
        }
        matches.forEach((match,index)=>{current=validDate(match.date,month)?match.date:null;add(match.date,line.slice(match.end,matches[index+1]?.index??line.length));});continue;
      }
      const heading=line.match(/^(?:(\d{4})年\s*)?(\d{1,2})月/);
      if(heading){contextYear=Number(heading[1]||info.year);contextMonth=Number(heading[2]);current=null;if(contextYear!==info.year||contextMonth!==info.number)warnings.add('画像の年月と選択中の月が異なる部分があります。');continue;}
      const weekly=line.match(/毎週\s*([日月火水木金土](?:[・、,と\s]*[日月火水木金土])*)曜(?:日)?\s*(.+)$/);
      if(weekly){if(contextYear===info.year&&contextMonth===info.number)for(const day of PocoCalendar.dates(month))if(weekly[1].includes(weekdays[day.weekday]))add(day.date,weekly[2]);current=null;continue;}
      const day=line.match(/^(?:[-・•]\s*)?(\d{1,2})(?:日|\([日月火水木金土](?:曜(?:日)?)?\)|\s+(?=\d{1,2}[:時]|お?休|OFF|未定|配信))(.*)$/i);
      if(day){const date=dateKey(contextYear,contextMonth,Number(day[1]));current=validDate(date,month)?date:null;add(date,day[2]);continue;}
      if(current && meaningful(line))add(current,line);
    }
    return { entries:[...byDate].sort(([a],[b])=>a.localeCompare(b)).map(([date,text])=>({date,text,source:'文字から抽出'})),warnings:[...warnings] };
  }
  function wordsFrom(data) {
    const words=[];
    for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[])for(const word of line.words||[])if(word.bbox)words.push({...word,text:clean(word.text)});
    return words;
  }
  const centerX = word => (word.bbox.x0+word.bbox.x1)/2;
  const centerY = word => (word.bbox.y0+word.bbox.y1)/2;
  const median = values => {const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
  function parseGrid(data, month) {
    const info=PocoCalendar.monthInfo(month),words=wordsFrom(data);if(!info||words.length===0)return [];
    const headers=[];
    for(const original of words){
      const aliases={Sun:'日',Mon:'月',Tue:'火',Wed:'水',Thu:'木',Fri:'金',Sat:'土','目':'日','士':'土'};const word={...original,text:aliases[original.text]||original.text.replace(/^([日月火水木金土])曜(?:日)?$/,'$1').replaceAll('目','日').replaceAll('士','土')};
      if(weekdays.includes(word.text)&&word.text.length===1)headers.push({...word,day:weekdays.indexOf(word.text)});
      else if(word.text.replaceAll(' ','').length===7&&new Set(word.text.replaceAll(' ','')).size===7&&[...word.text.replaceAll(' ','')].every(char=>weekdays.includes(char)))for(let i=0;i<7;i++)headers.push({...word,day:weekdays.indexOf(word.text.replaceAll(' ','')[i]),bbox:{...word.bbox,x0:word.bbox.x0+(word.bbox.x1-word.bbox.x0)*i/7,x1:word.bbox.x0+(word.bbox.x1-word.bbox.x0)*(i+1)/7}});
    }
    let columns;
    for(const seed of headers){const nearby=headers.filter(word=>Math.abs(centerY(word)-centerY(seed))<Math.max(12,seed.bbox.y1-seed.bbox.y0)).sort((a,b)=>centerX(a)-centerX(b));const sequence=nearby.filter((word,index)=>nearby.findIndex(item=>item.day===word.day)===index);if(sequence.length===7&&sequence.every((word,i)=>i===0||(word.day-sequence[i-1].day+7)%7===1)){columns=sequence;break;}}
    if(!columns){
      let best=null;
      for(const seed of headers){
        const nearby=headers.filter(word=>Math.abs(centerY(word)-centerY(seed))<Math.max(15,seed.bbox.y1-seed.bbox.y0));
        for(const start of [0,1])for(const a of nearby)for(const b of nearby){
          const ca=(a.day-start+7)%7,cb=(b.day-start+7)%7;if(ca===cb)continue;
          const pitch=(centerX(b)-centerX(a))/(cb-ca);if(pitch<20)continue;
          const left=centerX(a)-ca*pitch;const matches=nearby.filter(word=>Math.abs(centerX(word)-(left+((word.day-start+7)%7)*pitch))<pitch*.2);
          const unique=new Set(matches.map(word=>word.day));if(unique.size<4)continue;
          const score=unique.size,error=matches.reduce((sum,word)=>sum+Math.abs(centerX(word)-(left+((word.day-start+7)%7)*pitch)),0)/matches.length;
          if(!best||score>best.score||score===best.score&&error<best.error)best={score,error,left,pitch,start,y:median(matches.map(centerY)),height:median(matches.map(word=>word.bbox.y1-word.bbox.y0))};
        }
      }
      if(best)columns=Array.from({length:7},(_,i)=>({day:(best.start+i)%7,bbox:{x0:best.left+i*best.pitch-5,x1:best.left+i*best.pitch+5,y0:best.y-best.height/2,y1:best.y+best.height/2}}));
    }
    if(!columns)return [];
    const xs=columns.map(centerX),headerY=median(columns.map(centerY)),offset=(info.weekday-columns[0].day+7)%7;
    const borders=[xs[0]-(xs[1]-xs[0])/2,...xs.slice(0,-1).map((x,i)=>(x+xs[i+1])/2),xs[6]+(xs[6]-xs[5])/2];
    const colAt=word=>borders.findIndex((left,index)=>index<7&&centerX(word)>=left&&centerX(word)<borders[index+1]);
    const anchors=[];
    for(const word of words){const match=word.text.match(/^(\d{1,2})日?$/);if(!match||centerY(word)<=headerY+5)continue;const day=Number(match[1]);if(day<1||day>info.days||colAt(word)!==(offset+day-1)%7)continue;anchors.push({word,day,week:Math.floor((offset+day-1)/7)});}
    const earliest=new Map();for(const item of anchors)if(!earliest.has(item.day)||centerY(item.word)<centerY(earliest.get(item.day).word))earliest.set(item.day,item);
    if(earliest.size<Math.min(10,info.days))return [];
    const weeks=Math.ceil((offset+info.days)/7),known=[];
    for(let week=0;week<weeks;week++){const group=[...earliest.values()].filter(item=>item.week===week);if(group.length)known.push({week,y:median(group.map(item=>centerY(item.word)))});}
    if(known.length<2)return [];
    const pitches=[];for(let i=1;i<known.length;i++)pitches.push((known[i].y-known[i-1].y)/(known[i].week-known[i-1].week));
    const pitch=median(pitches);if(pitch<20)return [];
    const firstY=median(known.map(item=>item.y-item.week*pitch));
    if(known.some(item=>Math.abs(item.y-(firstY+item.week*pitch))>pitch*.25))return [];
    const ys=Array.from({length:weeks},(_,week)=>firstY+week*pitch);
    const height=median([...earliest.values()].map(item=>item.word.bbox.y1-item.word.bbox.y0));const tops=ys.map(y=>y-height/2-3),bottom=tops.at(-1)+median(ys.slice(1).map((y,i)=>y-ys[i]));const cells=new Map();
    for(const word of words){const col=colAt(word);if(col<0||centerY(word)<tops[0]||centerY(word)>=bottom)continue;let week=0;while(week+1<weeks&&centerY(word)>=tops[week+1])week++;const day=week*7+col-offset+1;if(day<1||day>info.days)continue;if(/^(\d{1,2})日?$/.test(word.text)&&Number(word.text.replace('日',''))===day&&Math.abs(centerY(word)-ys[week])<height*1.2)continue;const date=dateKey(info.year,info.number,day);if(!cells.has(date))cells.set(date,[]);cells.get(date).push(word);}
    const entries=[];
    for(const [date,items]of cells){const lines=[];for(const word of items.sort((a,b)=>centerY(a)-centerY(b)||centerX(a)-centerX(b))){let line=lines.find(line=>Math.abs(line.y-centerY(word))<Math.max(5,(word.bbox.y1-word.bbox.y0)*.5));if(!line){line={y:centerY(word),words:[]};lines.push(line);}line.words.push(word);}const text=lines.map(line=>clean(line.words.sort((a,b)=>centerX(a)-centerX(b)).map(word=>word.text).join(' '))).filter(meaningful).join('\n');if(text)entries.push({date,text,source:'カレンダー位置から推定'});}
    return entries.sort((a,b)=>a.date.localeCompare(b.date));
  }
  function extract(data, month) {
    const parsed=parseText(data.text||'',month),grid=parsed.warnings.some(w=>w.includes('画像の年月'))?[]:parseGrid(data,month),byDate=new Map(grid.map(item=>[item.date,item]));
    for(const item of parsed.entries)if(!byDate.has(item.date))byDate.set(item.date,item);
    return {entries:[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)),warnings:parsed.warnings};
  }
  function merge(existing, entries, month, mode='append') {
    const result={...(existing||{})},grouped=new Map();
    for(const entry of entries){if(!validDate(entry.date,month))throw Error('選択月内の正しい日付に修正してください。');const text=String(entry.text??'').trim();if(!text)throw Error('予定の内容を入力するか、対象から外してください。');grouped.set(entry.date,combineText(grouped.get(entry.date)||'',text));}
    if(!grouped.size)throw Error('反映する予定を選んでください。');
    for(const [date,text]of grouped){const combined=mode==='replace'?text:combineText(result[date]||'',text);if(combined.length>2000)throw Error('1日の予定が長すぎます。内容を短くしてください。');result[date]=combined;}
    return result;
  }
  globalThis.PocoImageImport=Object.freeze({parseText,parseGrid,extract,merge});
})();
