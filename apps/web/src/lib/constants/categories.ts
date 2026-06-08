import type { AccentColor } from './colors';

export const ITEM_CATEGORIES = [
  'family',
  'home',
  'school',
  'sport',
  'health',
  'shopping',
  'work',
  'money',
  'travel',
  'other'
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export type CategoryMeta = {
  label: string;
  color: AccentColor;
  icon: string;
};

export const CATEGORY_META = {
  family: { label: 'Семья', color: 'yellow', icon: 'users-round' },
  home: { label: 'Дом', color: 'green', icon: 'house' },
  school: { label: 'Школа', color: 'green', icon: 'backpack' },
  sport: { label: 'Спорт', color: 'peach', icon: 'dumbbell' },
  health: { label: 'Здоровье', color: 'lavender', icon: 'stethoscope' },
  shopping: { label: 'Покупки', color: 'blue', icon: 'shopping-bag' },
  work: { label: 'Работа', color: 'blue', icon: 'briefcase-business' },
  money: { label: 'Финансы', color: 'yellow', icon: 'wallet-cards' },
  travel: { label: 'Поездка', color: 'peach', icon: 'map-pinned' },
  other: { label: 'Другое', color: 'gray', icon: 'sparkles' }
} satisfies Record<ItemCategory, CategoryMeta>;

export function getCategoryMeta(category: ItemCategory): CategoryMeta {
  return CATEGORY_META[category];
}
