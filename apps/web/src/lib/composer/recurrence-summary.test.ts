import { describe, expect, it } from 'vitest';
import { describeRecurrence } from './recurrence-summary';

describe('recurrence details', () => {
  it('describes standard presets and custom weekdays in Russian', () => {
    expect(describeRecurrence('FREQ=DAILY;INTERVAL=1')).toBe('Каждый день');
    expect(describeRecurrence('FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR')).toBe('По будням');
    expect(describeRecurrence('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR')).toBe('Каждые 2 недели · пн, пт');
    expect(describeRecurrence('FREQ=MONTHLY;INTERVAL=5')).toBe('Каждые 5 месяцев');
    expect(describeRecurrence('FREQ=WEEKLY')).toBe('Каждую неделю');
  });

  it('formats the inclusive final date in the item timezone', () => {
    expect(describeRecurrence('FREQ=DAILY', '2026-06-11T21:59:59.999Z', 'Europe/Amsterdam'))
      .toBe('Каждый день · по 11 июня 2026 г. включительно');
    expect(describeRecurrence('FREQ=DAILY', '2026-06-11T23:59:59.999Z', 'Asia/Tokyo'))
      .toBe('Каждый день · по 12 июня 2026 г. включительно');
  });

  it('does not crash or misdescribe unsupported rules', () => {
    expect(describeRecurrence(undefined)).toBe('Не повторяется');
    expect(describeRecurrence('bad rule')).toBe('По заданному расписанию');
    expect(describeRecurrence('FREQ=MONTHLY;BYDAY=1MO')).toBe('По заданному расписанию');
  });
});
