import { describe, expect, it } from 'vitest';
import { shouldDismissSheet } from './sheet-swipe';

describe('sheet dismissal gesture', () => {
  it('accepts an intentional downward drag or short fast flick', () => {
    expect(shouldDismissSheet(100, 4, 600)).toBe(true);
    expect(shouldDismissSheet(45, 2, 60)).toBe(true);
  });
  it('rejects taps, short slow drags, upward and sideways gestures', () => {
    expect(shouldDismissSheet(5, 1, 5)).toBe(false);
    expect(shouldDismissSheet(40, 0, 600)).toBe(false);
    expect(shouldDismissSheet(-120, 0, 100)).toBe(false);
    expect(shouldDismissSheet(100, 140, 100)).toBe(false);
  });
});
