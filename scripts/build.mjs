import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, copyFile, readFile, writeFile, rename, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'design.css', 'favicon.svg', 'app.js', 'coins.js', 'rows.js', 'calendar.js', 'firebase-config.js']) {
  await copyFile(file, `dist/${file}`);
}
await build({ entryPoints: ['shared.js'], outfile: 'dist/shared.js', bundle: true, format: 'esm', minify: true, target: ['es2022'] });
let html = await readFile('dist/index.html', 'utf8');
for (const file of ['firebase-config.js', 'coins.js', 'rows.js', 'calendar.js', 'app.js', 'shared.js', 'design.css', 'favicon.svg']) {
  const content = await readFile(`dist/${file}`);
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 12);
  const versioned = file.replace(/\.(js|css|svg)$/, `.${hash}.$1`);
  await rename(`dist/${file}`, `dist/${versioned}`);
  html = html.replaceAll(`src="${file}"`, `src="${versioned}"`).replaceAll(`href="${file}"`, `href="${versioned}"`);
}
await writeFile('dist/index.html', html);
