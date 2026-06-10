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
    expect(body).toContain('Когда появятся поручения на проверку или напоминания, они будут здесь.');
    expect(body).not.toContain('today-attention-card--');
  });
});
