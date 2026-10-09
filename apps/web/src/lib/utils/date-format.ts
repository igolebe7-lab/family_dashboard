const formatters = new Map<string, Intl.DateTimeFormat>();
const MAX_FORMATTERS = 64;

// Only immutable formatting rules are retained, never account or record data.
export function getDateTimeFormatter(locale: string, options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat {
  const key = JSON.stringify([locale, Object.entries(options).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b))]);
  const cached = formatters.get(key);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat(locale, options);
  if (formatters.size >= MAX_FORMATTERS) formatters.delete(formatters.keys().next().value!);
  formatters.set(key, formatter);
  return formatter;
}
