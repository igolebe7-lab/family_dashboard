// Export the approved ImageGen artwork; no runtime dependency is added to the app.
// Usage: SHARP_MODULE=/absolute/path/to/sharp node scripts/export-app-icons.mjs
import { createRequire } from 'node:module';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, 'docs/design/app-icon');
const icons = path.join(root, 'apps/web/static/icons');
const source = path.join(pack, 'master.png');
const sizes = [16, 20, 24, 29, 32, 40, 48, 57, 58, 60, 64, 72, 76, 80, 87, 96, 114, 120, 128, 144, 152, 167, 180, 192, 256, 384, 512, 1024];
await mkdir(path.join(pack, 'transparent'), { recursive: true });
await mkdir(path.join(pack, 'install'), { recursive: true });
const meta = await sharp(source).metadata();
if (!meta.hasAlpha || meta.width !== meta.height) throw new Error('Expected square master with alpha');
for (const size of sizes) {
  await sharp(source).resize(size, size).png().toFile(path.join(pack, `transparent/icon-${size}.png`));
}
// Maskable artwork fits entirely within the guaranteed central 80%-diameter circle.
// Even the corners of this centered 56% square remain inside that circle.
const trimmed = await sharp(source).trim({ threshold: 5 }).toBuffer();
for (const size of [192, 512]) {
  const mark = await sharp(trimmed).resize(Math.floor(size * 0.56), Math.floor(size * 0.56), { fit: 'inside' }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 3, background: '#fffaf3' } })
    .composite([{ input: mark, gravity: 'centre' }]).removeAlpha().png()
    .toFile(path.join(pack, `install/maskable-${size}.png`));
}
for (const size of [120, 152, 167, 180]) {
  await sharp(source).resize(size, size).flatten({ background: '#fffaf3' }).png()
    .toFile(path.join(pack, `install/apple-touch-icon-${size}.png`));
}
// ICO directory containing PNG-compressed 16/32/48px images.
const icoSizes = [16, 32, 48];
const buffers = await Promise.all(icoSizes.map(size => sharp(source).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * buffers.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(buffers.length, 4);
let offset = header.length;
buffers.forEach((buffer, i) => {
  const at = 6 + 16 * i;
  header[at] = icoSizes[i]; header[at + 1] = icoSizes[i];
  header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(buffer.length, at + 8); header.writeUInt32LE(offset, at + 12);
  offset += buffer.length;
});
await writeFile(path.join(pack, 'favicon.ico'), Buffer.concat([header, ...buffers]));
for (const size of [32, 192, 512]) await copyFile(path.join(pack, `transparent/icon-${size}.png`), path.join(icons, `icon-${size}.png`));
for (const size of [192, 512]) await copyFile(path.join(pack, `install/maskable-${size}.png`), path.join(icons, `maskable-${size}.png`));
for (const size of [120, 152, 167, 180]) {
  const name = size === 180 ? 'apple-touch-icon.png' : `apple-touch-icon-${size}.png`;
  await copyFile(path.join(pack, `install/apple-touch-icon-${size}.png`), path.join(icons, name));
}
await copyFile(path.join(pack, 'favicon.ico'), path.join(root, 'apps/web/static/favicon.ico'));
console.log(`Exported ${sizes.length} transparent PNGs, 4 Apple icons, 2 maskable icons and favicon.ico`);
