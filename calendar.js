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
  globalThis.PocoCalendar = Object.freeze({ monthInfo, dates, validSchedule, validAccounts, accountDetails, setDay, validActuals, setActual, actualTotals });
})();
