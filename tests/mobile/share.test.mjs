import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const origin = 'https://pocolog.test';
const publicUrl = 'https://yoshi2026s.github.io/pocolog/';
const dist = resolve('dist');
let browser;

before(async () => {
  browser = await chromium.launch();
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
    await copyDialog.getByRole('button', { name: '時間未記録をまとめて選択' }).tap();
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
