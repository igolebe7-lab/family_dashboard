import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ItemDetailsDialog from './ItemDetailsDialog.svelte';

describe('item details dialog', () => {
  it('uses an accessible native dialog without page navigation or another workspace', () => {
    const { body } = render(ItemDetailsDialog, { props: { itemId: '123456789abcdef', onclose() {} } });
    expect(body).toContain('<dialog');
    expect(body).toContain('aria-label="Подробности записи"');
    expect(body).toContain('aria-label="Закрыть подробности"');
    expect(body).not.toContain('href="/app/search"');
    expect(body).not.toContain('workspace-page');
  });
});
