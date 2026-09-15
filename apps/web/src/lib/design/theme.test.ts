import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = () => readFileSync('static/theme.js', 'utf8');
function setup(saved: string | null = null, dark = false, blocked = false) {
  const root = { dataset: {} as Record<string, string>, style: { colorScheme: '' } };
  const meta = { content: '' };
  const media = Object.assign(new EventTarget(), { matches: dark });
  const window = Object.assign(new EventTarget(), { matchMedia: () => media });
  const values = new Map(saved ? [['familytime.theme', saved]] : []);
  const storage = {
    getItem: (key: string) => { if (blocked) throw new Error('blocked'); return values.get(key) ?? null; },
    setItem: (key: string, value: string) => { if (blocked) throw new Error('blocked'); values.set(key, value); }
  };
  runInNewContext(source(), { window, document: { documentElement: root, querySelector: () => meta }, localStorage: storage, CustomEvent });
  return { root, meta, values, window,
    choose: (value: string) => window.dispatchEvent(new CustomEvent('familytime:set-theme', { detail: value })),
    system: (value: boolean) => { media.matches = value; media.dispatchEvent(new Event('change')); }
  };
}

describe('theme bootstrap', () => {
  it('follows the system by default before hydration and reacts to changes', () => {
    const app = setup(null, true);
    expect(app.root.dataset).toMatchObject({ theme: 'dark', themePreference: 'system' });
    app.system(false); expect(app.root.dataset.theme).toBe('light');
  });
  it('persists explicit preference and ignores system changes until system is selected', () => {
    const app = setup('light', true);
    expect(app.root.dataset.theme).toBe('light');
    app.choose('dark'); app.system(false);
    expect(app.root.dataset.theme).toBe('dark');
    expect(app.values.get('familytime.theme')).toBe('dark');
    app.choose('system'); expect(app.root.dataset.theme).toBe('light');
  });
  it('tolerates unavailable storage and invalid values', () => {
    const app = setup('invalid', false, true);
    app.choose('dark'); expect(app.root.dataset.theme).toBe('dark');
    expect(app.root.dataset.themeStorage).toBe('unavailable');
    app.choose('invalid'); expect(app.root.dataset.themePreference).toBe('dark');
  });
  it('synchronizes changes from another tab', () => {
    const app = setup();
    app.window.dispatchEvent(Object.assign(new Event('storage'), { key: 'familytime.theme', newValue: 'dark' }));
    expect(app.root.dataset.theme).toBe('dark');
    expect(app.root.style.colorScheme).toBe('dark');
    expect(app.meta.content).toBe('#0c1923');
  });
});
