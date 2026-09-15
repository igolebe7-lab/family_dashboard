// Runs before the application stylesheet and hydration to avoid a light-theme flash.
(() => {
  const key = 'familytime.theme';
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['light', 'dark', 'system'].includes(value);
  let preference = 'system';
  try { const saved = localStorage.getItem(key); if (valid(saved)) preference = saved; } catch {}

  function apply() {
    const theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    root.dataset.themePreference = preference;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#0c1923' : '#f5f7ef';
    window.dispatchEvent(new CustomEvent('familytime:theme-change'));
  }
  window.addEventListener('familytime:set-theme', event => {
    if (!valid(event.detail)) return;
    preference = event.detail;
    try { localStorage.setItem(key, preference); root.dataset.themeStorage = 'available'; }
    catch { root.dataset.themeStorage = 'unavailable'; }
    apply();
  });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = valid(event.newValue) ? event.newValue : 'system';
    apply();
  });
  media.addEventListener('change', () => { if (preference === 'system') apply(); });
  apply();
})();
