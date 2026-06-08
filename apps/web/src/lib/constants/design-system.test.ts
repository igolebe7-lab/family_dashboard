import { describe, expect, it } from 'vitest';

import { APP_ROUTES } from './routes';
import { ITEM_CATEGORIES, getCategoryMeta } from './categories';
import { MEMBER_COLORS } from './colors';

describe('design system constants', () => {
  it('keeps the primary mobile navigation in the MVP order', () => {
    expect(APP_ROUTES.primaryNavigation.map((item) => item.label)).toEqual([
      'Сегодня',
      'Календарь',
      'Поручения',
      'Семья'
    ]);
  });

  it('defines category metadata with Russian labels and Lucide icon keys', () => {
    expect(ITEM_CATEGORIES).toContain('school');
    expect(getCategoryMeta('school')).toEqual({
      label: 'Школа',
      color: 'green',
      icon: 'backpack'
    });
  });

  it('keeps default family member colors aligned with the visual references', () => {
    expect(MEMBER_COLORS.mom.accent).toBe('var(--color-lavender)');
    expect(MEMBER_COLORS.dad.accent).toBe('var(--color-blue)');
    expect(MEMBER_COLORS.misha.accent).toBe('var(--color-green)');
    expect(MEMBER_COLORS.anya.accent).toBe('var(--color-peach)');
  });
});
