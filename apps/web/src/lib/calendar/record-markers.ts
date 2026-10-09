import type { AccentColor } from '$lib/constants/colors';
import { dateKeyInZone } from '$lib/utils/timezone';

export type CalendarRecordMarker = { id: string; dateKey: string; colors: AccentColor[] };
export function createRecordMarker(
  record: { id: string; family?: string; kind: string; startAt?: string; dueAt?: string; memberIds?: string[]; allDay?: boolean; timezone?: string },
  members: readonly { id: string; family: string; colorKey?: string }[], timezone: string
): CalendarRecordMarker | null {
  const value = record.startAt ?? record.dueAt;
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  const colors = [...new Set((record.memberIds ?? []).flatMap(id => {
    const member = members.find(member => member.id === id && member.family === record.family);
    return member?.colorKey && ['green','blue','peach','lavender','yellow','gray','danger'].includes(member.colorKey) ? [member.colorKey as AccentColor] : [];
  }))];
  return { id: record.id, dateKey: dateKeyInZone(new Date(value), record.allDay && record.timezone ? record.timezone : timezone), colors: colors.length ? colors : ['gray'] };
}

export function limitRecordMarkers(markers: readonly CalendarRecordMarker[]) {
  const count = markers.length > 9999 ? 0 : markers.length > 99 ? 1 : markers.length > 3 ? 2 : 3;
  const visible = markers.slice(0, count);
  if (count === 2 && markers.length > 3) {
    const signature = markers[0].colors.join(',');
    const different = markers.find(marker => marker.colors.join(',') !== signature);
    if (different) visible[1] = different;
  }
  return { visible, hidden: Math.max(0, markers.length - count) };
}
