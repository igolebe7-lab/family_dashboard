import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import RepeatRuleEditor from './RepeatRuleEditor.svelte';

describe('Weekday time editor', () => {
  it('uses the common time by default without showing individual fields', () => {
    const { body } = render(RepeatRuleEditor, { props: { value: 'weekly', days: ['MO', 'WE'], enableDayTimes: true } });
    expect(body).toContain('Разное время по дням недели');
    expect(body).not.toContain('weekday-time-row');
  });
  it('shows times only for selected days, with common-time fallbacks', () => {
    const { body } = render(RepeatRuleEditor, { props: { value: 'weekly', days: ['MO', 'WE'], enableDayTimes: true,
      individualTimes: true, startTime: '09:00', endTime: '10:00', times: { WE: { startTime: '17:00', endTime: '18:30' } } } });
    expect(body.match(/class="weekday-time-row/g)).toHaveLength(2);
    expect(body).toContain('value="09:00"');
    expect(body).toContain('value="17:00"');
    expect(body).toContain('Начало · Понедельник');
    expect(body).not.toContain('Начало · Пятница');
  });
  it('does not offer individual times for all-day or monthly events', () => {
    for (const props of [{ value: 'weekly' as const, enableDayTimes: false }, { value: 'monthly' as const, enableDayTimes: true }]) {
      expect(render(RepeatRuleEditor, { props }).body).not.toContain('Разное время по дням недели');
    }
  });
});
