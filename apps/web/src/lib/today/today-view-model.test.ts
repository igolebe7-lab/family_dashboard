import { describe, expect, it } from 'vitest';

import { createTodayViewModel } from './today-view-model';

describe('createTodayViewModel', () => {
  it('provides demo-ready Today sections with Russian quick actions and attention count', () => {
    const model = createTodayViewModel();

    expect(model.familyMembers).toHaveLength(4);
    expect(model.weekDays).toHaveLength(7);
    expect(model.weekEvents).toHaveLength(13);
    expect(model.weekTimes).toEqual(['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00']);
    expect(model.timelineItems.length).toBeGreaterThan(0);
    expect(model.attentionItems).toHaveLength(2);
    expect(model.attentionCount).toBe(2);
    expect(model.feedItems).toHaveLength(3);
    expect(model.quickActions.map((action) => action.label)).toEqual([
      '+ Дело',
      '+ Поручение',
      '+ Событие'
    ]);
    expect(model.emptyState.isEmpty).toBe(false);
  });

  it('provides the desktop reference fixture for visual QA', () => {
    const model = createTodayViewModel({ fixture: 'desktop-reference' });

    expect(model.dateLabel).toBe('Сегодня, 24 мая 2024 г., пятница');
    expect(model.weekLabel).toBe('20 — 26 мая 2024');
    expect(model.weekDays.map((day) => day.dateKey)).toEqual([
      '2024-05-20',
      '2024-05-21',
      '2024-05-22',
      '2024-05-23',
      '2024-05-24',
      '2024-05-25',
      '2024-05-26'
    ]);
    expect(model.weekEvents).toHaveLength(13);
    expect(model.weekEvents[1]).toMatchObject({
      day: '2024-05-20',
      start: '10:30',
      durationMinutes: 60,
      title: 'Врач',
      memberName: 'Мама',
      color: 'lavender'
    });
  });
});
