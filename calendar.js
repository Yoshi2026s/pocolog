(() => {
  function monthInfo(month) {
    if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
    const [year, number] = month.split('-').map(Number);
    if (year < 100) return null;
    return { year, number, days: new Date(Date.UTC(year, number, 0)).getUTCDate(), weekday: new Date(Date.UTC(year, number - 1, 1)).getUTCDay() };
  }
  function dates(month) {
    const info = monthInfo(month);
    if (!info) return [];
    return Array.from({ length: info.days }, (_, index) => ({ day: index + 1, date: `${month}-${String(index + 1).padStart(2, '0')}`, weekday: (info.weekday + index) % 7 }));
  }
  function validSchedule(schedule, month) {
    if (schedule === undefined) return true;
    if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule) || Object.keys(schedule).length > 31) return false;
    return Object.entries(schedule).every(([date, text]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof text !== 'string' || text.length > 2000) return false;
      const prefix = date.slice(0, 7), info = monthInfo(prefix), day = Number(date.slice(8));
      return info && day >= 1 && day <= info.days && (!month || prefix === month);
    });
  }
  function validAccounts(table, month) {
    return table.accountDetails === undefined || (Array.isArray(table.accountDetails)
      && table.accountDetails.length === table.columns.length
      && table.accountDetails.every(item => item && typeof item.memo === 'string' && validSchedule(item.schedule, month)));
  }
  function accountDetails(table, index, create = false) {
    if (table.accountDetails) return table.accountDetails[index];
    if (!create) return { memo: '', schedule: {} };
    table.accountDetails = table.columns.map(() => ({ memo: '', schedule: {} }));
    return table.accountDetails[index];
  }
  function setDay(entity, date, text) {
    if (!entity.schedule) entity.schedule = {};
    if (text === '') delete entity.schedule[date];
    else entity.schedule[date] = text;
  }
  function validActuals(actuals, month){
    if(actuals===undefined)return true;
    if(!actuals||typeof actuals!=='object'||Array.isArray(actuals)||Object.keys(actuals).length>31)return false;
    const allowed=new Set(dates(month).map(item=>item.date));
    return Object.entries(actuals).every(([date,value])=>allowed.has(date)&&value&&typeof value==='object'&&!Array.isArray(value)
      &&Object.keys(value).length===3&&typeof value.earnedDay==='boolean'
      &&(value.minutes===null||Number.isInteger(value.minutes)&&value.minutes>=0&&value.minutes<=1440)
      &&(value.cheerK===null||typeof value.cheerK==='number'&&Number.isFinite(value.cheerK)&&value.cheerK>=0&&value.cheerK<=1e9));
  }
  function setActual(entity,date,value,month){
    if(!validActuals({[date]:value},month))throw Error('実績の日時・数値を確認してください。');
    if(!entity.actuals)entity.actuals={};
    if(!value.earnedDay&&value.minutes===null&&value.cheerK===null)delete entity.actuals[date];
    else entity.actuals[date]={...value};
  }
  function actualTotals(entity){
    return Object.values(entity.actuals||{}).reduce((total,value)=>({days:total.days+Number(value.earnedDay),minutes:total.minutes+(value.minutes??0),cheerK:total.cheerK+(value.cheerK??0),records:total.records+1,timeRecords:total.timeRecords+Number(value.minutes!==null),cheerRecords:total.cheerRecords+Number(value.cheerK!==null)}),{days:0,minutes:0,cheerK:0,records:0,timeRecords:0,cheerRecords:0});
  }
  function splitActualRange(date,start,end,nextDay,month){
    const parse=value=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))return null;const [h,m]=value.split(':').map(Number);return h*60+m;};
    const from=parse(start),to=parse(end);
    if(!dates(month).some(item=>item.date===date)||from===null||to===null)throw Error('開始・終了時刻を入力してください。');
    const duration=to+(nextDay?1440:0)-from;
    if(duration<=0||duration>1440)throw Error('終了が翌日の場合は「翌日まで」にチェックしてください。時間は24時間以内です。');
    const changes={};
    if(!nextDay)changes[date]=duration;
    else{
      changes[date]=1440-from;
      if(to>0){const next=new Date(date+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);const key=next.toISOString().slice(0,10);
        if(!key.startsWith(month+'-'))throw Error('月をまたぐ時間は、それぞれの記録月で入力してください。');
        changes[key]=to;
      }
    }
    return changes;
  }
  function addActualMinutes(actuals,changes,month){
    if(!validActuals(actuals,month))throw Error('実績データを確認してください。');
    const result=structuredClone(actuals||{}),allowed=new Set(dates(month).map(item=>item.date));
    for(const [date,delta] of Object.entries(changes)){
      if(!allowed.has(date)||!Number.isInteger(delta))throw Error('日付・加算する時間を確認してください。');
      const previous=result[date]||{earnedDay:false,minutes:null,cheerK:null};
      const minutes=Math.max(0,(previous.minutes??0)+delta);
      if(minutes>1440)throw Error('加算後の時間が1日24時間を超えます。');
      result[date]={...previous,earnedDay:previous.earnedDay||minutes>0,minutes};
    }
    return result;
  }
  function bulkActuals(actuals,month,options){
    const info=monthInfo(month),{from,to,weekdays,minutes,countDay,mode}=options;
    if(!info||!validActuals(actuals,month)||!Number.isInteger(from)||!Number.isInteger(to)||from<1||to>info.days||from>to)throw Error('記録月の範囲内で開始日・終了日を指定してください。');
    if(!Array.isArray(weekdays)||weekdays.some(day=>!Number.isInteger(day)||day<0||day>6)||!weekdays.length)throw Error('対象の曜日を選んでください。');
    if(typeof countDay!=='boolean'||!['missing','add','replace'].includes(mode)||minutes!==null&&(!Number.isInteger(minutes)||minutes<0||minutes>1440))throw Error('時間・反映方法を確認してください。');
    if(minutes===null&&!countDay)throw Error('時間か「日数にも数える」を指定してください。');
    const next=structuredClone(actuals||{}),applied=[],skipped=[];
    for(const day of dates(month).filter(day=>day.day>=from&&day.day<=to&&weekdays.includes(day.weekday))){
      const old=next[day.date]||{earnedDay:false,minutes:null,cheerK:null};
      if(mode==='missing'&&old.minutes!==null){skipped.push(day.date);continue;}
      const time=minutes===null?old.minutes:mode==='add'?(old.minutes??0)+minutes:minutes;
      if(time>1440)throw Error(`${day.day}日の合計が24時間を超えます。反映していません。`);
      next[day.date]={...old,earnedDay:old.earnedDay||countDay,minutes:time};applied.push(day.date);
    }
    return {next,applied,skipped};
  }
  function missingActualDates(entity,month,today){
    return dates(month).filter(({date})=>{
      if(date>today)return false;const actual=entity.actuals?.[date];
      return !actual?Boolean(entity.schedule?.[date]?.trim()):actual.minutes===null&&(Boolean(entity.schedule?.[date]?.trim())||actual.earnedDay||actual.cheerK!==null);
    }).map(item=>item.date);
  }
  function validPairActuals(row,columns,month){
    return row.pairActuals===undefined||(Array.isArray(row.pairActuals)&&row.pairActuals.length===columns.length&&row.pairActuals.every(value=>value===null||value&&typeof value==='object'&&!Array.isArray(value)&&typeof value.memo==='string'&&(value.cheerK===null||typeof value.cheerK==='number'&&Number.isFinite(value.cheerK)&&value.cheerK>=0&&value.cheerK<=1e9)&&validActuals(value.actuals,month)&&validSchedule(value.schedule,month)));
  }
  function pairDetails(table,row,index,create=false){
    if(!table.rows.includes(row)||index<0||index>=table.columns.length)return null;
    const blank=()=>({cheerK:null,memo:''});
    if(!create)return row.pairActuals?.[index]||blank();
    if(!row.pairActuals)row.pairActuals=table.columns.map(()=>null);
    if(!row.pairActuals[index])row.pairActuals[index]=blank();return row.pairActuals[index];
  }
  globalThis.PocoCalendar = Object.freeze({ monthInfo, dates, validSchedule, validAccounts, accountDetails, setDay, validActuals, setActual, actualTotals, splitActualRange, addActualMinutes, bulkActuals, missingActualDates, validPairActuals, pairDetails });
})();
