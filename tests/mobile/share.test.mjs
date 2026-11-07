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
