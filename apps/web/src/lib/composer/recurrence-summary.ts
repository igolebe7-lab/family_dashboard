import { RRule } from 'rrule';

const weekdayLabels = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const plurals = new Intl.PluralRules('ru');

export function describeRecurrence(rule?: string, until?: string, timezone = 'UTC'): string {
  if (!rule) return 'Не повторяется';
  try {
    const options = RRule.parseString(rule);
    if (Object.keys(options).some((key) => !['freq', 'interval', 'byweekday'].includes(key))) return 'По заданному расписанию';
    const interval = options.interval ?? 1;
    const days = options.byweekday ? (Array.isArray(options.byweekday) ? options.byweekday : [options.byweekday]) : [];
    const indexes = days.map((day) => typeof day === 'number' ? day : typeof day === 'string' ? -1 : day.n ? -1 : day.weekday);
    if (indexes.some((day) => day < 0 || day > 6) || (days.length && options.freq !== RRule.WEEKLY)) return 'По заданному расписанию';
    const frequency = options.freq;
    const unit = frequency === RRule.DAILY ? ['день', 'дня', 'дней'] : frequency === RRule.WEEKLY ? ['неделю', 'недели', 'недель'] : ['месяц', 'месяца', 'месяцев'];
    if (![RRule.DAILY, RRule.WEEKLY, RRule.MONTHLY].includes(frequency!)) return 'По заданному расписанию';
    const category = plurals.select(interval);
    let text = interval === 1
      ? frequency === RRule.DAILY ? 'Каждый день' : frequency === RRule.WEEKLY ? 'Каждую неделю' : 'Каждый месяц'
      : `${category === 'one' ? frequency === RRule.WEEKLY ? 'Каждую' : 'Каждый' : 'Каждые'} ${interval} ${unit[category === 'one' ? 0 : category === 'few' ? 1 : 2]}`;
    const selectedDays = [...new Set(indexes)].sort();
    if (frequency === RRule.WEEKLY && selectedDays.join(',') === '0,1,2,3,4' && interval === 1) text = 'По будням';
    else if (selectedDays.length) text += ` · ${selectedDays.map((day) => weekdayLabels[day]).join(', ')}`;
    if (until) text += ` · по ${new Intl.DateTimeFormat('ru', { timeZone: timezone, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(until))} включительно`;
    return text;
  } catch {
    return 'По заданному расписанию';
  }
}
