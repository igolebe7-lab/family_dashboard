import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWorkMedia, saveWorkMedia } from './work-media.api';
import { resetPocketBaseClient, setPocketBaseClient } from './pocketbase';

const context = { familyId: 'family', memberId: 'member' };
const row = { id: 'media', family: 'family', item: 'item', occurrence: 'occurrence', photos: ['a.jpg'], links_json: [{ id: 'one', title: 'Link', url: 'https://example.org' }] };
afterEach(resetPocketBaseClient);
describe('work media API', () => {
  it('loads only the selected occurrence in its family', async () => {
    const send = vi.fn().mockResolvedValue(row);
    setPocketBaseClient({ authStore: { token: 'token', isValid: true, clear() {}, record: {} }, collection: () => ({}), send });
    expect(await getWorkMedia('occurrence', context)).toMatchObject({ photos: ['a.jpg'], links: row.links_json });
    expect(send.mock.calls[0][0]).toBe('/api/familytime/work/occurrence/media');
    expect(send.mock.calls[0][1].headers['X-Family-Member-Id']).toBe('member');
  });
  it('rejects a response from a different family', async () => {
    setPocketBaseClient({ authStore: { token: '', isValid: true, clear() {}, record: {} }, collection: () => ({}), send: async () => ({ ...row, family: 'other' }) });
    await expect(getWorkMedia('occurrence', context)).rejects.toThrow();
  });
  it('uploads photos without placing file content in JSON', async () => {
    const send = vi.fn().mockResolvedValue(row);
    setPocketBaseClient({ authStore: { token: '', isValid: true, clear() {}, record: {} }, collection: () => ({}), send });
    await saveWorkMedia('occurrence', { photos: [new File(['test'], 'photo.jpg', { type: 'image/jpeg' })], links: row.links_json, expectedLinks: [] }, context);
    const body = send.mock.calls[0][1].body;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('photos')).toBeInstanceOf(File);
    expect(JSON.parse(body.get('links_json'))).toEqual(row.links_json);
    expect(JSON.parse(body.get('expected_links_json'))).toEqual([]);
  });
});
