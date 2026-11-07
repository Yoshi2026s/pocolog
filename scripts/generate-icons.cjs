// Run with Node.js and sharp installed (npm install --no-save --package-lock=false sharp).
// favicon.svg is the canonical source for every installed-app icon.
const sharp = require('sharp');
(async () => {
  for (const [size, name] of [[180, 'apple-touch-icon'], [192, 'icon-192'], [512, 'icon-512']]) {
    await sharp('favicon.svg').resize(size, size).flatten({background:'#203d43'}).png().toFile(`icons/${name}.png`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
