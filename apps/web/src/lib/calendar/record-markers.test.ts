import { expect, it } from 'vitest';
import { createRecordMarker, limitRecordMarkers } from './record-markers';

it('shows one dot per record, caps crowded days and never uses readers as owners', () => {
  const members = [{ id: 'a', family: 'f', colorKey: 'blue' }, { id: 'b', family: 'f', colorKey: 'peach' }];
  const marker = createRecordMarker({ id: '1', kind: 'task', startAt: '2026-10-08T22:30Z', memberIds: ['a'], family: 'f' }, members, 'Europe/Moscow');
  expect(marker).toMatchObject({ dateKey: '2026-10-09', colors: ['blue'] });
  expect(createRecordMarker({ id: '2', kind: 'event', memberIds: ['a','b'], family: 'f', startAt: '2026-10-08T22:30Z' }, members, 'UTC')?.colors).toEqual(['blue','peach']);
  expect(createRecordMarker({ id: '3', kind: 'task', memberIds: ['a'], family: 'other', startAt: '2026-10-08T22:30Z' }, members, 'UTC')?.colors).toEqual(['gray']);
  expect(limitRecordMarkers(Array.from({length: 9}, (_, i) => ({...marker!, id: String(i)})))).toMatchObject({ visible: expect.any(Array), hidden: 7 });
  expect(limitRecordMarkers([marker!,marker!,marker!]).visible).toHaveLength(3);
  const other = { ...marker!, id: 'other', colors: ['peach'] as const };
  expect(limitRecordMarkers([marker!, marker!, marker!, { ...other, colors: [...other.colors] }]).visible[1].colors).toEqual(['peach']);
  expect(limitRecordMarkers(Array.from({ length: 100 }, (_, i) => ({ ...marker!, id: String(i) }))).hidden).toBe(99);
});
