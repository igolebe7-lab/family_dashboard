import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';

import AttentionPanel from './AttentionPanel.svelte';

describe('AttentionPanel', () => {
  it('shows a calm empty state when no attention items need action', () => {
    const { body } = render(AttentionPanel, {
      props: {
        items: [],
        labelledBy: 'attention-empty-title'
      }
    });

    expect(body).toContain('Ничего срочного');
    expect(body).toContain('Когда появятся поручения на проверку или важные записи, они будут здесь.');
    expect(body).not.toContain('today-attention-card--');
  });
  it('limits the initial list to five with an accessible expansion control', () => {
    const { body } = render(AttentionPanel, { props: { items: Array.from({ length: 7 }, (_, index) => ({
      id: String(index), itemId: String(index), body: `Record ${index}`, memberName: 'Игорь', memberInitial: 'И', memberPortrait: 'mom' as const, color: 'green' as const, actionLabel: 'Открыть'
    })) } });
    expect(body).toContain('Record 4'); expect(body).not.toContain('Record 5');
    expect(body).toContain('Показать все (7)'); expect(body).toContain('aria-expanded="false"');
  });
});
