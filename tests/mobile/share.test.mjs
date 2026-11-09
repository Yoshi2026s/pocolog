import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const origin = 'https://pocolog.test';
const publicUrl = 'https://yoshi2026s.github.io/pocolog/';
const dist = resolve('dist');
let browser;

before(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
});
after(async () => {
  await browser?.close();
});

async function openMobile(t, viewport, shareBehavior = 'unavailable') {
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
  t.after(() => context.close());
  // Serve the generated site inside the browser. Block every external request,
  // including the shared database module, to keep the test offline.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    const file = resolve(dist, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (url.origin !== origin || !file.startsWith(dist + sep) ||
        /\/(?:shared|firebase-config)\.[a-f0-9]+\.js$/.test(url.pathname)) return route.abort();
    return route.fulfill({ path: file });
  });
  await context.addInitScript(behavior => {
    Object.defineProperty(navigator, 'share', {
      value: behavior === 'unavailable' ? undefined : async data => {
        window.sharedPayload = data;
        if (behavior === 'cancel') throw new DOMException('Canceled', 'AbortError');
        if (behavior === 'reject') throw new DOMException('Blocked', 'NotAllowedError');
      }
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async value => { window.copiedUrl = value; } }
    });
  }, shareBehavior);
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(origin);
  await page.waitForFunction(() => Boolean(window.pocolog));
  return page;
}

async function assertFits(page, locator, minTouch = 0) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box, 'control must be visible');
  assert.ok(box.width >= minTouch && box.height >= minTouch, JSON.stringify(box));
  assert.ok(box.x >= -1 && box.y >= -1, JSON.stringify(box));
  assert.ok(box.x + box.width <= viewport.width + 1 &&
    box.y + box.height <= viewport.height + 1, JSON.stringify({ box, viewport }));
}

for (const [label, width, height] of [
  ['small portrait', 320, 568],
  ['portrait', 390, 844],
  ['landscape', 667, 375],
  ['short landscape', 568, 320]
]) {
  test(`URL share fallback fits and works on ${label} (${width}×${height})`, async t => {
    const page = await openMobile(t, { width, height });
    const button = page.getByRole('button', { name: 'URL共有', exact: true });
    const dialog = page.getByRole('dialog', { name: 'ポコログのURL共有' });
    const original = await page.evaluate(() => localStorage.getItem('pocolog.v1'));
    await assertFits(page, page.locator('#bottomMenus'));
    await assertFits(page, button, 48);
    await button.tap();
    await dialog.waitFor();
    await assertFits(page, dialog);
    assert.equal(await dialog.getByLabel('公開URL').inputValue(), publicUrl);
    const copy = dialog.getByRole('button', { name: 'URLをコピー' });
    await assertFits(page, copy, 48);
    await copy.tap();
    await dialog.getByRole('status').filter({ hasText: 'URLをコピーしました。' }).waitFor();
    assert.equal(await page.evaluate(() => window.copiedUrl), publicUrl);
    await dialog.getByRole('button', { name: '閉じる' }).tap();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'shareUrl');
    await page.reload();
    await assertFits(page, button, 48);
    assert.equal(await page.evaluate(() => localStorage.getItem('pocolog.v1')), original);
  });
}

for (const behavior of ['success', 'cancel', 'reject']) {
  test(`native share request handles ${behavior}`, async t => {
    const page = await openMobile(t, { width: 390, height: 844 }, behavior);
    await page.getByRole('button', { name: 'URL共有', exact: true }).tap();
    const dialog = page.getByRole('dialog', { name: 'ポコログのURL共有' });
    assert.deepEqual(await page.evaluate(() => window.sharedPayload), { title: 'ポコログ', url: publicUrl });
    assert.equal(await dialog.isVisible(), behavior === 'reject');
  });
}

for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }]) {
  test(`viewing time replaces the selected day and survives reload (${viewport.width}×${viewport.height})`, async t => {
    const page = await openMobile(t, viewport);
    const month = await page.locator('#month').inputValue();
    const date = month + '-01';
    const otherDate = month + '-02';
    await page.evaluate(({month,date,otherDate}) => {
      const current = window.pocolog.getBook();
      current.months[month] = {columns:['こた','こじ','もえ'],rows:[{
        name:'検証用',memo:'',values:['5','',''],pairActuals:[{memo:'',cheerK:2,actuals:{
          [date]:{earnedDay:true,minutes:30,cheerK:1},
          [otherDate]:{earnedDay:true,minutes:60,cheerK:null}
        }},{memo:'保護',cheerK:8,actuals:{[date]:{earnedDay:false,minutes:25,cheerK:4}}},null]
      }]};
      window.pocolog.setBook(current);
    }, {month,date,otherDate});
    await page.locator('#monthViewTime').tap();
    const openDay = async () => {
      await page.locator('#grid [data-actual-account="0"]').first().tap();
      await page.locator(`#entityCalendar [data-date="${date}"]`).tap();
    };
    await openDay();
    const start = page.getByLabel('視聴開始');
    const end = page.getByLabel('視聴終了');
    await start.waitFor();
    await end.waitFor();
    assert.equal(await page.locator('#viewingRequired').textContent(), '5時間');
    assert.equal(await page.locator('#viewingCurrent').textContent(), '1時間30分');
    assert.equal(await page.locator('#viewingRemaining').textContent(), '3時間30分');
    await start.fill('23:30');
    await end.fill('01:15');
    const update = page.getByRole('button', { name: 'この日の時間を更新' });
    assert.match(await page.locator('#actualRangePreview').textContent(), /30分 → 1時間45分（翌日まで）/);
    await update.tap();
    assert.equal(await page.locator('#viewingCurrent').textContent(), '2時間45分');
    assert.equal(await page.locator('#viewingRemaining').textContent(), '2時間15分');
    assert.equal(await update.isDisabled(), true);
    const readPair = () => page.evaluate(month=>window.pocolog.getBook().months[month].rows[0].pairActuals[0],month);
    assert.deepEqual(await readPair(), {memo:'',cheerK:2,actuals:{
      [date]:{earnedDay:true,minutes:105,cheerK:1},
      [otherDate]:{earnedDay:true,minutes:60,cheerK:null}
    }});
    await page.getByRole('button', { name: '他アカウントへ反映' }).tap();
    const copyDialog = page.getByRole('dialog', { name: '視聴時間を他アカウントへ反映' });
    const filled = copyDialog.getByRole('checkbox', { name: /こじ.*25分/ });
    const empty = copyDialog.getByRole('checkbox', { name: /もえ.*時間未記録/ });
    assert.equal(await copyDialog.getByRole('button', { name: '選んだアカウントへ反映' }).isDisabled(), true);
    await copyDialog.getByRole('button', { name: '時間が未記録のアカウントを選択' }).tap();
    assert.equal(await filled.isChecked(), false);
    assert.equal(await empty.isChecked(), true);
    await copyDialog.getByRole('button', { name: '1アカウントに反映' }).tap();
    await copyDialog.waitFor({ state:'hidden' });
    const readTargets=()=>page.evaluate(month=>window.pocolog.getBook().months[month].rows[0].pairActuals.slice(1),month);
    const expectedTargets=[
      {memo:'保護',cheerK:8,actuals:{[date]:{earnedDay:false,minutes:25,cheerK:4}}},
      {memo:'',cheerK:null,actuals:{[date]:{earnedDay:true,minutes:105,cheerK:null}}}
    ];
    assert.deepEqual(await readTargets(),expectedTargets);
    await page.reload();
    assert.deepEqual(await readTargets(),expectedTargets);
    await openDay();
    assert.equal(await page.locator('#actualHours').inputValue(), '1');
    assert.equal(await page.locator('#actualMinutes').inputValue(), '45');
    assert.equal(await page.locator('#viewingRemaining').textContent(), '2時間15分');
  });
}

test('loading a large month defers the hidden summary and preserves it on reopen', async t => {
  const page = await openMobile(t, { width: 320, height: 568 });
  const month = await page.locator('#month').inputValue();
  await page.evaluate(month => {
    const next = window.pocolog.getBook();
    const columns = Array.from({length: 15}, (_, index) => '検証アカウント' + index);
    next.months[month] = {columns, rows: Array.from({length: 80}, (_, index) => ({
      name: '検証ライバー' + index, memo: '', values: columns.map(() => '1'),
      pairActuals: columns.map(() => ({memo: '', cheerK: 1}))
    }))};
    window.pocolog.setBookPayload(JSON.stringify(next), () => {});
  }, month);
  assert.equal(await page.locator('#sum').textContent(), '1,200');
  assert.equal(await page.locator('#pairSummaryTable tbody tr').count(), 0);
  await page.locator('#openSummary').tap();
  assert.equal(await page.locator('#pairSummaryTable tbody tr').count(), 1200);
  const firstSummaryRow = await page.locator('#pairSummaryTable tbody tr').first().elementHandle();
  await page.locator('#closeSummary').tap();
  await page.locator('#openSummary').tap();
  assert.equal(await firstSummaryRow.evaluate(node => node.isConnected), true);
  await page.locator('#closeSummary').tap();
  await page.reload();
  assert.equal(await page.locator('#sum').textContent(), '1,200');
  assert.equal(await page.locator('#pairSummaryTable tbody tr').count(), 0);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }]) {
  test(`app update reloads only when the release changes (${viewport.width}×${viewport.height})`, async t => {
    const page = await openMobile(t, viewport);
    const refresh = page.locator('#refresh');
    const navigation = await page.evaluate(() => performance.timeOrigin);
    await assertFits(page, refresh, 48);
    await refresh.tap();
    await refresh.filter({hasText:'最新版'}).waitFor();
    assert.equal(await page.evaluate(() => performance.timeOrigin), navigation);
    await page.locator('#addRow').tap();
    const current = await page.evaluate(() => {
      const payload = window.pocolog.getPayload();
      if (payload !== localStorage.getItem('pocolog.v1')) throw Error('local save differs');
      return payload;
    });
    const version = await page.locator('meta[name=pocolog-build]').getAttribute('content');
    const changed = version === '0000000000000000' ? '1111111111111111' : '0000000000000000';
    await page.route('**/version.json', route => route.fulfill({json:{version:changed}}));
    await Promise.all([page.waitForEvent('framenavigated'), refresh.tap()]);
    await page.waitForFunction(() => Boolean(window.pocolog));
    assert.notEqual(await page.evaluate(() => performance.timeOrigin), navigation);
    assert.equal(await page.evaluate(() => window.pocolog.getPayload()), current);
  });
}

test('loading another month retains the current table and editable records', async t => {
  const page = await openMobile(t, { width: 320, height: 568 });
  const currentRow = await page.locator('#grid tbody tr').first().elementHandle();
  await page.evaluate(() => {
    const book = window.pocolog.getBook();
    const month = book.currentMonth === '2090-01' ? '2090-02' : '2090-01';
    book.months[month] = {columns:['テスト'],rows:[]};
    window.pocolog.setBookPayload(JSON.stringify(book), () => {});
  });
  assert.equal(await currentRow.evaluate(node => node.isConnected), true);
  await page.locator('#addRow').tap();
  const result = await page.evaluate(() => {
    const {months,currentMonth}=JSON.parse(window.pocolog.getPayload());
    return {row:months[currentMonth].rows.at(-1).name,hasOther:Object.keys(months).length===2};
  });
  assert.deepEqual(result,{row:'新しいライバー',hasOther:true});
});

test('one display menu restores all accounts and uncommon cheer values remain editable', async t => {
  const page = await openMobile(t, { width: 320, height: 568 });
  const display = page.locator('#viewControlsSummary');
  await display.tap();
  await page.locator('#accountViewChoices').getByRole('button', {name:'こた', exact:true}).tap();
  assert.match(await display.textContent(), /こた/);
  await display.tap();
  await page.locator('#accountViewChoices').getByRole('button', {name:'全アカウント', exact:true}).tap();
  assert.equal(await display.textContent(), '表示');
  await page.locator('#monthViewTime').tap();
  await page.locator('#grid [data-actual-account="0"]').first().tap();
  assert.equal(await page.locator('#planDayNavigation').isVisible(), false);
  assert.equal(await page.locator('#actualPreviousDay').isVisible(), true);
  const preset = page.locator('#pairCheerSelect');
  const custom = page.locator('#pairCurrentCheer');
  assert.equal(await custom.isVisible(), false);
  await preset.selectOption('3');
  await page.locator('#pairCheerCustom summary').tap();
  await custom.fill('0.5');
  assert.equal(await preset.inputValue(), '0.5');
  await page.locator('#undoPairCheer').tap();
  assert.equal(await preset.inputValue(), '');
  await preset.selectOption('3');
  await preset.selectOption('');
  assert.equal(await custom.inputValue(), '');
});

for (const viewport of [{width:320,height:568},{width:568,height:320}]) {
  test(`monthly actuals open daily input directly and keep the selected date (${viewport.width}×${viewport.height})`, async t => {
    const page = await openMobile(t, viewport);
    const month = await page.locator('#month').inputValue();
    await page.evaluate(month => {
      const book=window.pocolog.getBook();
      book.months[month]={columns:['こた','もえ'],rows:[
        {name:'ライバーA',memo:'',values:['','']},
        {name:'ライバーB',memo:'',values:['','']}
      ]};
      window.pocolog.setBook(book);
    },month);
    await page.locator('#monthViewActual').tap();
    const openLiver = name => page.getByRole('button',{name:`ライバー ${name}の日数・時間`,exact:true}).tap();
    await openLiver('ライバーA');
    assert.equal(await page.locator('#actualAccountDialog').isVisible(),false);
    assert.match(await page.locator('#coinDialogTitle').textContent(),/ライバーA × こた/);
    assert.equal(await page.locator('#actualEntryShortcut').isVisible(),false);
    if(viewport.height>400)await assertFits(page,page.locator('#actualRangeStart'),48);
    const initialDate=await page.locator('#entityCalendar [aria-pressed=true]').getAttribute('data-date');
    const direction=initialDate.endsWith('-01')?'Next':'Previous';
    await page.locator('#actual'+direction+'Day').tap();
    const chosenDate=await page.locator('#entityCalendar [aria-pressed=true]').getAttribute('data-date');
    assert.notEqual(chosenDate,initialDate);
    await page.locator('#pairAccountSelect').selectOption('1');
    assert.equal(await page.locator('#entityCalendar [aria-pressed=true]').getAttribute('data-date'),chosenDate);
    await page.locator('#actualRangeStart').fill('09:00');
    await page.locator('#actualRangeEnd').fill('09:45');
    await page.locator('#applyActualRange').tap();
    assert.equal(await page.evaluate(({month,chosenDate})=>window.pocolog.getBook().months[month].rows[0].pairActuals[1].actuals[chosenDate].minutes,{month,chosenDate}),45);
    await page.locator('#nextPairLiver').tap();
    assert.match(await page.locator('#coinDialogTitle').textContent(),/ライバーB × もえ/);
    assert.equal(await page.locator('#entityCalendar [aria-pressed=true]').getAttribute('data-date'),chosenDate);
    await page.locator('#backToActualGroup').tap();
    assert.match(await page.locator('#actualAccountTitle').textContent(),/ライバーB/);
    await page.locator('#actualAccountClose').tap();
    await openLiver('ライバーA');
    assert.match(await page.locator('#coinDialogTitle').textContent(),/ライバーA × もえ/);
    await page.locator('#coinDialogClose').tap();
    await page.reload();
    assert.equal(await page.evaluate(({month,chosenDate})=>window.pocolog.getBook().months[month].rows[0].pairActuals[1].actuals[chosenDate].minutes,{month,chosenDate}),45);
  });
}

test('goal and actual cells keep their independent group colors through row highlights', async t => {
  const page = await openMobile(t, { width: 390, height: 844 });
  await page.evaluate(() => {
    const book = window.pocolog.getBook();
    const date = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    const month = date.slice(0, 7);
    book.currentMonth = month;
    book.months[month] = {
      columns: ['こじ', 'こた', 'もえ', '別アカウントA', '別アカウントB'],
      rows: [[5, 4, 6, 5, 6], [5, 5, 6, 5, 4], [5, 5, 5, 5, 5]].map((actuals, index) => ({
        name: `ライバー${index + 1}`, memo: '', releaseDate: date.slice(-2),
        values: actuals.map(() => '5'),
        pairActuals: actuals.map(cheerK => ({ cheerK, memo: '' }))
      }))
    };
    window.pocolog.setBook(book);
  });
  const pink = 'rgb(252, 228, 239)';
  const blue = 'rgb(227, 239, 252)';
  const assertHeaderColors = async () => {
    const headers = await page.locator('#grid thead th[data-account-group]').evaluateAll(cells => cells.map(th => ({ group: th.dataset.accountGroup, color: getComputedStyle(th).backgroundColor })));
    assert.deepEqual(headers, [
      { group: '1', color: pink }, { group: '1', color: pink }, { group: '1', color: pink },
      { group: '2', color: blue }, { group: '2', color: blue }
    ]);
  };
  const assertColors = async () => {
    await assertHeaderColors();
    const rows = await page.locator('#grid tbody tr').evaluateAll(rows => rows.map(row => ({
      groups: row.dataset.metGroups,
      colors: Array.from(row.cells).slice(3, 8).map(td => getComputedStyle(td).backgroundColor)
    })));
    assert.deepEqual(rows.map(row => row.groups), ['2', '1', '1 2']);
    assert.deepEqual(rows.map(row => row.colors.map(color => [pink, blue].includes(color) ? color : null)), [
      [pink, null, pink, blue, blue],
      [pink, pink, pink, blue, null],
      [pink, pink, pink, blue, blue]
    ]);
  };
  const highlight = async (kind, state) => {
    await page.locator('#colorControls summary').tap();
    await page.locator(`[data-${kind}-highlight="${state}"]`).tap();
  };
  await assertColors();
  await highlight('achievement', 'met');
  await assertColors();
  await highlight('achievement', 'unmet');
  await assertColors();
  await highlight('release', 'today');
  assert.equal(await page.locator('#grid tbody tr[data-release-match=today]').count(), 3);
  await assertColors();
  await page.locator('#monthViewActual').tap();
  await assertColors();
  await page.reload();
  await assertColors();
  await page.locator('#monthViewTime').tap();
  await assertHeaderColors();
  await page.locator('#monthViewActual').tap();
  await page.locator('#grid [data-actual-account="0"]').first().tap();
  await assertColors();
  await page.locator('#cheerPicker').getByRole('button', { name: 'エール選択を閉じる' }).tap();
  await page.evaluate(() => {
    const book = window.pocolog.getBook();
    book.months[book.currentMonth].columns[0] = '別アカウントC';
    window.pocolog.setBook(book);
  });
  assert.equal(await page.locator('#grid thead th[data-account-group]').first().getAttribute('data-account-group'), '2');
  assert.equal(await page.locator('#grid thead th[data-account-group]').first().evaluate(th => getComputedStyle(th).backgroundColor), blue);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }]) {
  test(`swiping a liver name scrolls without editing or reordering (${viewport.width}×${viewport.height})`, async t => {
    const page = await openMobile(t, viewport);
    await page.evaluate(() => {
      const book = window.pocolog.getBook();
      book.months[book.currentMonth] = {
        columns: Array.from({ length: 24 }, (_, i) => `アカウント${i + 1}`),
        rows: Array.from({ length: 40 }, (_, i) => ({ name: `ライバー${i + 1}`, memo: '', values: Array(24).fill('5') }))
      };
      window.pocolog.setBook(book);
    });
    await page.locator('#monthViewTime').tap();
    const original = await page.evaluate(() => JSON.stringify(window.pocolog.getBook()));
    const wrap = page.locator('#tablePanel>.table-wrap');
    assert.ok(await wrap.evaluate(el => el.scrollWidth > el.clientWidth));
    const client = await page.context().newCDPSession(page);
    const swipe = async (dx, dy) => {
      await page.locator('#grid tbody .name-trigger').first().scrollIntoViewIfNeeded();
      const box = await page.locator('#grid tbody .name-trigger').first().boundingBox();
      const x = box.x + box.width - 5, y = box.y + box.height / 2;
      const touch = async (type, x, y) => client.send('Input.dispatchTouchEvent', {
        type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }]
      });
      await touch('touchStart', x, y);
      for (let i = 1; i <= 5; i++) await touch('touchMove', x + dx * i / 5, y + dy * i / 5);
      await touch('touchEnd', x + dx, y + dy);
    };
    await page.screenshot({ path: `/tmp/pocolog-swipe-${viewport.width}.png` });
    await swipe(-45, 0);
    assert.ok(await wrap.evaluate(el => el.scrollLeft > 20), 'horizontal swipe must scroll');
    await wrap.evaluate(el => { el.scrollLeft = 0; });
    await page.locator('#grid tbody .name-trigger').first().scrollIntoViewIfNeeded();
    const initialTop = await wrap.evaluate(el => el.scrollTop);
    await swipe(0, -15);
    assert.ok(await wrap.evaluate(el => el.scrollTop) > initialTop + 5, 'vertical swipe must scroll');
    assert.equal(await page.locator('#coinDialog').isVisible(), false);
    assert.equal(await page.evaluate(() => JSON.stringify(window.pocolog.getBook())), original);
  });
}

test('mobile secondary actions remain reachable and explain local saving', async t => {
  const page = await openMobile(t, { width: 320, height: 568 });
  await page.locator('#syncInfo').tap();
  await page.locator('#syncInfoDialog').getByText('入力はこの端末に自動保存されます。上部の「保存」で共有先へ送信します。').waitFor();
  await assertFits(page, page.locator('#closeSyncInfo'), 44);
  await page.locator('#closeSyncInfo').tap();
  await page.locator('.table-tools>summary').tap();
  const upload = page.getByLabel('バックアップから復元', { exact: true });
  await upload.focus();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'upload');
  await page.screenshot({ path: '/tmp/pocolog-mobile-menu.png' });
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 568, height: 320 }]) {
  test(`actual shortcuts and repeated adjustments fit and preserve records (${viewport.width}×${viewport.height})`, async t => {
    const page = await openMobile(t, viewport);
    const month = await page.locator('#month').inputValue();
    await page.evaluate(month => {
      const book = window.pocolog.getBook();
      book.months[month] = { columns: ['検証アカウント'], rows: [{ name: '検証ライバー', memo: '保持', values: ['5'], pairActuals: [{ cheerK: null, memo: '実績メモ', actuals: { [month+'-01']: { earnedDay: true, minutes: 30, cheerK: null } } }] }] };
      window.pocolog.setBook(book);
    }, month);
    await page.locator('#monthViewActual').tap();
    const cell = page.locator('#grid [data-actual-account="0"]').first();
    const picker = page.locator('#cheerPicker');
    const read = () => page.evaluate(month => window.pocolog.getBook().months[month].rows[0].pairActuals[0].cheerK, month);
    await cell.tap();
    await assertFits(page, picker);
    assert.deepEqual(await picker.locator('.cheer-picker-jumps button').allTextContents(), ['1','2','5','10','20','30','40']);
    assert.deepEqual(await picker.locator('.actual-picker-adjustments button').allTextContents(), ['−1','−5','＋1','＋5','＋10']);
    for (const button of await picker.locator('.cheer-picker-jumps button,.actual-picker-adjustments button').all()) await assertFits(page, button, 44);
    await assertFits(page, picker.locator('.cheer-picker-details'), 44);
    assert.equal(await picker.getByRole('button', { name: '実績を1K減らす', exact: true }).isDisabled(), true);
    await picker.getByRole('button', { name: '実績を1K増やす', exact: true }).tap();
    assert.equal(await read(), 1);
    await picker.getByRole('button', { name: '実績を5K増やす', exact: true }).tap();
    await picker.getByRole('button', { name: '実績を10K増やす', exact: true }).tap();
    assert.equal(await read(), 16);
    await picker.getByRole('button', { name: '実績を5K減らす', exact: true }).tap();
    await picker.getByRole('button', { name: '実績を1K減らす', exact: true }).tap();
    assert.equal(await read(), 10);
    await picker.getByRole('button', { name: 'エール選択を閉じる' }).tap();
    await cell.tap();
    assert.equal(await picker.locator('.actual-picker-value').textContent(), '10 K');
    await picker.getByRole('button', { name: '40Kを入力', exact: true }).tap();
    assert.equal(await read(), 40);
    await page.locator('#undoCheer').tap();
    assert.equal(await read(), 10);
    await cell.tap();
    await picker.getByRole('option', { name: '空欄', exact: true }).tap();
    assert.equal(await read(), null);
    await page.locator('#undoCheer').tap();
    assert.equal(await read(), 10);
    const row = await page.evaluate(month => window.pocolog.getBook().months[month].rows[0], month);
    assert.equal(row.values[0], '5');
    assert.equal(row.memo, '保持');
    assert.equal(row.pairActuals[0].memo, '実績メモ');
    assert.equal(row.pairActuals[0].actuals[month+'-01'].minutes, 30);
    await page.reload();
    assert.equal(await read(), 10);
    await page.locator('#grid [data-actual-account="0"]').first().tap();
    await page.screenshot({ path: `/tmp/pocolog-actual-shortcuts-${viewport.width}.png` });
  });
}

test('actual adjustments protect zero, decimal values, and the upper limit', async t => {
  const page = await openMobile(t, { width: 390, height: 844 });
  const setValue = async value => {
    await page.evaluate(value => {
      const book = window.pocolog.getBook(), month = book.currentMonth;
      book.months[month] = { columns: ['アカウント'], rows: [{ name: 'ライバー', memo: '', values: ['20'], pairActuals: [{ cheerK: value, memo: '' }] }] };
      window.pocolog.setBook(book);
    }, value);
    await page.locator('#monthViewActual').tap();
    await page.locator('#grid [data-actual-account="0"]').first().tap();
  };
  const picker = page.locator('#cheerPicker');
  const minus = picker.getByRole('button', { name: '実績を1K減らす', exact: true });
  const plus = picker.getByRole('button', { name: '実績を1K増やす', exact: true });
  const read = () => page.evaluate(() => window.pocolog.getBook().months[window.pocolog.getBook().currentMonth].rows[0].pairActuals[0].cheerK);
  await setValue(1);
  await minus.tap();
  assert.equal(await read(), 0);
  assert.equal(await minus.isDisabled(), true);
  await picker.getByRole('button', { name: 'エール選択を閉じる' }).tap();
  await page.locator('#undoCheer').tap();
  assert.equal(await read(), 1);
  await setValue(0.5);
  assert.equal(await minus.isDisabled(), true);
  await plus.tap();
  assert.equal(await read(), 1.5);
  await minus.tap();
  assert.equal(await read(), 0.5);
  await setValue(1e9);
  assert.equal(await plus.isDisabled(), true);
  await minus.tap();
  assert.equal(await read(), 999999999);
  await plus.tap();
  assert.equal(await read(), 1e9);
  assert.equal(await plus.isDisabled(), true);
});

for (const viewport of [{width:320,height:568},{width:568,height:320}]) {
 test(`self accounts can be added, regrouped, and deleted without shifting records (${viewport.width}×${viewport.height})`, async t => {
  const page=await openMobile(t,viewport);
  const month=await page.locator('#month').inputValue();
  await page.evaluate(month=>{
   const book=window.pocolog.getBook();
   book.months[month]={columns:['こじ'],accountDetails:[{memo:'アカウントメモ',schedule:{[month+'-01']:'予定'}}],rows:[{name:'検証ライバー',memo:'保持',values:['5'],pairActuals:[{cheerK:5,memo:'実績メモ',actuals:{[month+'-01']:{earnedDay:true,minutes:30,cheerK:null}}}]}]};
   window.pocolog.setBook(book);
  },month);
  const add=page.getByRole('button',{name:'自分アカウントを追加',exact:true});
  assert.equal(await add.textContent(),'＋自分アカ');
  await assertFits(page,add,44);
  const snapshot=await page.evaluate(()=>JSON.stringify(window.pocolog.getBook()));
  await add.tap();
  const editor=page.locator('#accountEditor');
  await editor.waitFor();
  await assertFits(page,editor);
  await page.locator('#accountEditorClose').tap();
  assert.equal(await page.evaluate(()=>JSON.stringify(window.pocolog.getBook())),snapshot);
  const create=async(name,group)=>{
   await add.tap();await page.locator('#accountName').fill(name);
   await editor.locator(`[name=accountGroup][value="${group}"]`).check();
   await page.screenshot({path:`/tmp/pocolog-account-editor-${viewport.width}.png`});
   await page.locator('#accountEditorSubmit').tap();
  };
  await create('追加アカ',1);
  const read=()=>page.evaluate(month=>window.pocolog.getBook().months[month],month);
  assert.deepEqual((await read()).columns,['こじ','追加アカ']);
  assert.deepEqual((await read()).rows[0].values,['5','']);
  assert.equal((await read()).rows[0].pairActuals[1],null);
  assert.equal((await read()).accountDetails[1].group,1);
  await page.evaluate(month=>{const book=window.pocolog.getBook(),row=book.months[month].rows[0];row.values[1]='5';row.pairActuals[1]={cheerK:5,memo:''};window.pocolog.setBook(book);},month);
  assert.equal(await page.locator('#grid tbody tr').first().getAttribute('data-met-groups'),'1');
  assert.equal(await page.locator('#grid tbody td[data-goal-met]').nth(1).getAttribute('data-goal-met'),'1');
  await create('追加アカ',2);
  assert.match(await page.locator('#accountEditorError').textContent(),/同じ名前/);
  await page.locator('#accountEditorClose').tap();
  await create('青アカ',2);
  await page.reload();
  assert.deepEqual((await read()).accountDetails.map(item=>item.group),[1,1,2]);
  const openSettings=async(view,index)=>{
   await page.locator(view).tap();
   await page.locator('#grid thead th[data-account-group] .name-trigger').nth(index).tap();
   if(view==='#monthViewGoal')await page.locator('#nameEdit').tap();else await page.locator('#manageActualAccount').tap();
  };
  await openSettings('#monthViewActual',1);
  await editor.locator('[name=accountGroup][value="2"]').check();
  await page.locator('#accountName').fill('変更アカ');await page.locator('#accountEditorSubmit').tap();
  assert.equal(await page.locator('#grid thead th[data-account-group]').nth(1).getAttribute('data-account-group'),'2');
  // Keep a copy of another month's records before changing this month.
  const otherMonth='2030-02';
  await page.evaluate(({month,otherMonth})=>{const book=window.pocolog.getBook();book.months[otherMonth]=structuredClone(book.months[month]);for(const details of book.months[otherMonth].accountDetails)delete details.schedule;for(const row of book.months[otherMonth].rows)for(const pair of row.pairActuals)if(pair)delete pair.actuals;window.pocolog.setBook(book);},{month,otherMonth});
  await openSettings('#monthViewTime',1);
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('#deleteAccount').tap();
  assert.equal((await read()).columns.length,3);
  page.once('dialog',dialog=>dialog.accept());await page.locator('#deleteAccount').tap();
  assert.deepEqual((await read()).columns,['こじ','青アカ']);
  assert.equal((await read()).rows[0].pairActuals[0].actuals[month+'-01'].minutes,30);
  assert.equal((await read()).accountDetails[0].memo,'アカウントメモ');
  assert.equal((await read()).accountDetails[1].group,2);
  assert.equal(await page.evaluate(otherMonth=>window.pocolog.getBook().months[otherMonth].columns.length,otherMonth),3);
  await page.locator('#month').fill('2030-03');
  assert.deepEqual(await page.evaluate(()=>window.pocolog.getBook().months['2030-03'].accountDetails.map(item=>item.group)),[1,2]);
  await page.reload();
  assert.deepEqual(await page.evaluate(()=>window.pocolog.getBook().months['2030-03'].columns),['こじ','青アカ']);
 });
}

for (const viewport of [{width:320,height:568},{width:568,height:320}]) {
 test(`account settings avoid no-op edits and keep actions reachable (${viewport.width}×${viewport.height})`, async t => {
  const page=await openMobile(t,viewport);
  const month=await page.locator('#month').inputValue();
  await page.evaluate(month=>{const book=window.pocolog.getBook();book.months[month]={columns:['単独アカ'],rows:[{name:'ライバー',memo:'保持',values:['5']}]};window.pocolog.setBook(book);},month);
  const before=await page.evaluate(()=>({payload:localStorage.getItem('pocolog.v1'),pending:localStorage.getItem('pocolog.pending.v1')}));
  const open=async()=>{await page.locator('#grid thead th[data-account-group] .name-trigger').first().tap();await page.locator('#nameEdit').tap();};
  await open();
  await assertFits(page,page.locator('#accountEditorSubmit'),48);
  await page.locator('#accountEditorSubmit').tap();
  assert.deepEqual(await page.evaluate(()=>({payload:localStorage.getItem('pocolog.v1'),pending:localStorage.getItem('pocolog.pending.v1')})),before);
  assert.equal(await page.locator('#accountEditor').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.activeElement.closest('th')?.dataset.accountGroup),'2');
  await open();
  await page.locator('#accountName').fill('   ');
  await page.locator('#accountEditorSubmit').tap();
  assert.equal(await page.locator('#accountName').getAttribute('aria-invalid'),'true');
  await page.locator('#accountName').fill('単独アカ');
  assert.equal(await page.locator('#accountName').getAttribute('aria-invalid'),null);
  const editor=page.locator('#accountEditor');
  await editor.evaluate(el=>el.scrollTop=el.scrollHeight);
  await assertFits(page,page.locator('#accountEditorClose'),48);
  await assertFits(page,page.locator('#deleteAccount'),48);
  await page.screenshot({path:`/tmp/pocolog-account-refined-${viewport.width}.png`});
  page.once('dialog',async dialog=>{assert.match(dialog.message(),new RegExp(month));assert.match(dialog.message(),/目標・実績・メモ・予定/);await dialog.accept();});
  await page.locator('#deleteAccount').tap();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'addCol');
  await page.reload();
  assert.deepEqual(await page.evaluate(month=>window.pocolog.getBook().months[month].columns,month),[]);
  await page.locator('#addCol').tap();
  await page.locator('#accountName').fill('復帰アカ');
  await page.locator('#accountEditorSubmit').tap();
  assert.deepEqual(await page.evaluate(month=>window.pocolog.getBook().months[month].columns,month),['復帰アカ']);
  assert.equal(await page.locator('#accountEditor').isVisible(),false);
 });
}
