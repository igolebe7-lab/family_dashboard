import { describe, expect, it } from 'vitest';

import { createTodayViewModel } from './today-view-model';

describe('createTodayViewModel', () => {
  it('provides demo-ready Today sections with Russian quick actions and attention count', () => {
    const model = createTodayViewModel();

    expect(model.familyMembers).toHaveLength(4);
    expect(model.weekDays).toHaveLength(7);
    expect(model.weekEvents).toHaveLength(10);
    expect(model.weekTimes).toEqual(['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00']);
    expect(model.timelineItems.length).toBeGreaterThan(0);
    expect(model.attentionItems).toHaveLength(2);
    expect(model.attentionCount).toBe(2);
    expect(model.quickActions.map((action) => action.label)).toEqual([
      '+ Дело',
      '+ Поручение',
      '+ Событие'
    ]);
    expect(model.emptyState.isEmpty).toBe(false);
  });
});
