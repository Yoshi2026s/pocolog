(() => {
  const normalize = value => String(value ?? '').trim().replace(/[０-９]/g, char => String(char.charCodeAt(0) - 0xff10)).replaceAll('：', ':');
  function closingKey(value) {
    const match = normalize(value).match(/^(\d{1,2})(?:時(?:(\d{1,2})分?)?|:(\d{2}))$/);
    if (!match) return null;
    const hour = Number(match[1]), minute = Number(match[2] ?? match[3] ?? 0);
    return hour < 24 && minute < 60 ? hour * 60 + minute : null;
  }
  function releaseKey(value, month) {
    const text = normalize(value).replace(/\s*[(（]仮[)）]\s*$/, '');
    const dayOnly = text.match(/^(\d{1,2})日?$/);
    if(dayOnly){const day=Number(dayOnly[1]);return day>=1 && day<=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate()?day:null;}
    const match = text.match(/^(?:(\d{4})[/-])?(\d{1,2})[/-](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2}))?$/);
    if (!match) return null;
    const year = Number(match[1] ?? month.slice(0, 4));
    const mon = Number(match[2]), day = Number(match[3]), hour = Number(match[4] ?? 0), minute = Number(match[5] ?? 0);
    if (year < 100 || year > 9999 || mon < 1 || mon > 12 || day < 1 || hour > 23 || minute > 59) return null;
    const date = new Date(Date.UTC(year, mon - 1, day, hour, minute));
    return date.getUTCFullYear() === year && date.getUTCMonth() === mon - 1 && date.getUTCDate() === day ? day : null;
  }
  function formatRelease(value, month){
    const day=releaseKey(value,month);
    return day===null?String(value??'').trim():`${day}日${/[(（]仮[)）]\s*$/.test(value)?'(仮)':''}`;
  }
  // Upgrade saved tables once, keeping values and account metadata aligned.
  function addExtraAccounts(book){
    if(book.extraAccountsVersion===1)return false;
    for(const table of Object.values(book.months)){
      let anchor=table.columns.indexOf('ヨシ');
      if(anchor<0)continue;
      for(const name of ['海斗','レオ']){
        const existing=table.columns.indexOf(name);
        if(existing>=0){anchor=existing;continue;}
        const index=++anchor;
        table.columns.splice(index,0,name);
        table.rows.forEach(row=>{row.values.splice(index,0,'');if(row.pairActuals)row.pairActuals.splice(index,0,null);});
        if(table.accountDetails)table.accountDetails.splice(index,0,{memo:'',schedule:{}});
      }
    }
    book.extraAccountsVersion=1;
    return true;
  }
  function sortRows(rows, field, direction, month) {
    const key = field === 'closingTime' ? row => closingKey(row.closingTime) : row => releaseKey(row.releaseDate, month);
    return rows.map((row, index) => ({ row, index, key: key(row) })).sort((a, b) => {
      if (a.key === null || b.key === null) return a.key === b.key ? a.index - b.index : a.key === null ? 1 : -1;
      return (direction === -1 ? -1 : 1) * (a.key - b.key) || a.index - b.index;
    }).map(item => item.row);
  }
  function moveRow(rows, from, to) {
    const result = [...rows];
    if (![from, to].every(index => Number.isInteger(index) && index >= 0 && index < rows.length)) return result;
    const [row] = result.splice(from, 1); result.splice(to, 0, row); return result;
  }
  globalThis.PocoRows = Object.freeze({ closingKey, releaseKey, formatRelease, addExtraAccounts, sortRows, moveRow });
})();
