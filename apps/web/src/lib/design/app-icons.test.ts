import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface AppIcon { src: string; sizes: string; type: string; purpose: string }
const manifest = JSON.parse(readFileSync('static/manifest.webmanifest', 'utf8')) as {
  id: string; start_url: string; scope: string; icons: AppIcon[];
};
const html = readFileSync('src/app.html', 'utf8');

function png(url: string) {
  const parsed = new URL(url, 'https://familytime.test');
  const bytes = readFileSync(`static${parsed.pathname}`);
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}

describe('approved app icon pack', () => {
  it('keeps the existing installed app identity and separate any/maskable PNGs', () => {
    expect([manifest.id, manifest.start_url, manifest.scope]).toEqual(['/', '/app/today', '/']);
    expect(manifest.icons).toHaveLength(4);
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png');
      expect(new URL(icon.src, 'https://familytime.test').searchParams.has('v')).toBe(true);
      const size = Number(icon.sizes.split('x')[0]);
      expect([192, 512]).toContain(size);
      expect(png(icon.src)).toEqual({ width: size, height: size, colorType: icon.purpose === 'maskable' ? 2 : 6 });
    }
    expect(manifest.icons.map(icon => `${icon.purpose}:${icon.sizes}`).sort()).toEqual([
      'any:192x192', 'any:512x512', 'maskable:192x192', 'maskable:512x512'
    ]);
  });
  it('provides opaque Apple icons for phone and tablet sizes', () => {
    const links = [...html.matchAll(/<link\b[^>]*rel="apple-touch-icon"[^>]*>/g)].map(match => match[0]);
    const sizes = links.map(link => {
      const size = Number(link.match(/sizes="(\d+)x\d+"/)?.[1]);
      const href = link.match(/href="([^"]+)"/)?.[1] ?? '';
      expect(new URL(href, 'https://familytime.test').searchParams.has('v')).toBe(true);
      expect(png(href)).toEqual({ width: size, height: size, colorType: 2 });
      return size;
    });
    expect(sizes.sort((a, b) => a - b)).toEqual([120, 152, 167, 180]);
  });
  it('uses the approved favicon instead of the old SVG', () => {
    expect(html).not.toContain('/icons/icon.svg');
    const ico = readFileSync('static/favicon.ico');
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
    expect([6, 22, 38].map(offset => ico[offset])).toEqual([16, 32, 48]);
    expect(png('/icons/icon-32.png').width).toBe(32);
  });
});
