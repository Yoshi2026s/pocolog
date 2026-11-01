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
  globalThis.PocoCalendar = Object.freeze({ monthInfo, dates, validSchedule, validAccounts, accountDetails, setDay });
})();
