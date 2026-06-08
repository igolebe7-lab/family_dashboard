import { describe, expect, it } from 'vitest';

import { createTodayViewModel } from './today-view-model';

describe('createTodayViewModel', () => {
  it('provides demo-ready Today sections with Russian quick actions and attention count', () => {
    const model = createTodayViewModel();

    expect(model.familyMembers).toHaveLength(4);
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
