import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'app.js', 'coins.js', 'firebase-config.js']) {
  await copyFile(file, `dist/${file}`);
}
await build({ entryPoints: ['shared.js'], outfile: 'dist/shared.js', bundle: true, format: 'esm', minify: true, target: ['es2022'] });
