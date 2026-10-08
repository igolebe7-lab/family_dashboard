import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync('src/lib/design/tokens.css', 'utf8');
const theme = readFileSync('src/lib/design/liquid-glass.css', 'utf8');
function colors(source: string): Record<string, string> {
  return Object.fromEntries([...source.matchAll(/(--[\w-]+):\s*(#[\da-f]{6})\s*;/gi)].map(match => [match[1], match[2]]));
}
function luminance(hex: string): number {
  return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}
function contrast(a: string, b: string): number {
  const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (bright + 0.05) / (dark + 0.05);
}

describe('semantic theme contrast', () => {
  for (const name of ['light', 'dark']) {
    const block = theme.match(new RegExp(`:root\\[data-theme='${name}'\\] \\{([^}]+)\\}`))?.[1] ?? '';
    const palette: Record<string, string> = { '--primary-ink': '#ffffff', ...colors(tokens), ...colors(block) };
    it(`${name}: readable body, secondary text and primary actions`, () => {
      expect(block, 'theme palette must exist').not.toBe('');
      for (const surface of ['--color-bg', '--color-surface', '--color-surface-soft']) {
        for (const text of ['--color-text', '--color-text-muted']) {
          expect(contrast(palette[text], palette[surface]), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(contrast(palette['--primary-ink'], palette['--color-green'])).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: semantic badges do not rely on pale text`, () => {
      for (const color of ['green', 'blue', 'lavender', 'peach', 'yellow', 'danger']) {
        expect(contrast(palette[`--color-${color}`], palette[`--color-${color}-soft`]), color).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
