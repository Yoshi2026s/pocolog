import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, copyFile, readFile, writeFile, rename, rm, readdir } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'app.js', 'coins.js', 'rows.js', 'calendar.js', 'image-import.js', 'firebase-config.js']) {
  await copyFile(file, `dist/${file}`);
}
await build({ entryPoints: ['shared.js'], outfile: 'dist/shared.js', bundle: true, format: 'esm', minify: true, target: ['es2022'] });
await build({ entryPoints: ['ocr-client.js'], outfile: 'dist/ocr-client.js', bundle: true, format: 'iife', minify: true, platform: 'browser', target: ['es2022'] });
await mkdir('dist/ocr-assets/core', { recursive: true });
await mkdir('dist/ocr-assets/lang', { recursive: true });
await mkdir('dist/ocr-assets/licenses', { recursive: true });
await copyFile('node_modules/tesseract.js/dist/worker.min.js', 'dist/ocr-assets/worker.min.js');
await copyFile('node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt', 'dist/ocr-assets/worker.min.js.LICENSE.txt');
for (const file of await readdir('node_modules/tesseract.js-core')) {
  if (/\.wasm(?:\.js)?$/.test(file)) await copyFile(`node_modules/tesseract.js-core/${file}`, `dist/ocr-assets/core/${file}`);
}
for (const lang of ['jpn', 'eng']) await copyFile(`node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`, `dist/ocr-assets/lang/${lang}.traineddata.gz`);
await copyFile('node_modules/tesseract.js/LICENSE.md', 'dist/ocr-assets/licenses/tesseract-js.txt');
await copyFile('node_modules/tesseract.js-core/LICENSE', 'dist/ocr-assets/licenses/tesseract-core.txt');
await copyFile('scripts/licenses/tessdata-LICENSE', 'dist/ocr-assets/licenses/tessdata.txt');
let html = await readFile('dist/index.html', 'utf8');
for (const file of ['firebase-config.js', 'coins.js', 'rows.js', 'calendar.js', 'image-import.js', 'ocr-client.js', 'app.js', 'shared.js']) {
  const content = await readFile(`dist/${file}`);
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 12);
  const versioned = file.replace(/\.js$/, `.${hash}.js`);
  await rename(`dist/${file}`, `dist/${versioned}`);
  html = html.replaceAll(`src="${file}"`, `src="${versioned}"`);
}
await writeFile('dist/index.html', html);
