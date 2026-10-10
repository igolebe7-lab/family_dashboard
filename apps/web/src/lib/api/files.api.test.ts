import { afterEach, describe, expect, it, vi } from 'vitest';
import { protectedFileUrl } from './files.api';
import { canEditMemberAvatar, mapFamilyMemberRecord, updateMemberAvatar } from './members.api';
import { resetPocketBaseClient, setPocketBaseClient } from './pocketbase';
import type { FamilyMember } from '$lib/types/domain';

function client() {
  return { baseURL: 'https://family.test/pb/', authStore: { token: 'account-a', isValid: true, record: { id: 'user-a' }, clear() {} },
    collection: vi.fn(() => ({ update: vi.fn(async () => ({ id: 'member', avatar: 'cropped.jpg' })) })),
    send: vi.fn(async () => ({ token: 'file-token' })) };
}
afterEach(() => { resetPocketBaseClient(); vi.useRealTimers(); });

describe('protected file access', () => {
  it('encodes the file path and reuses a short-lived token across images', async () => {
    const pb = client(); setPocketBaseClient(pb);
    const url = new URL(await protectedFileUrl('family_members', 'member', 'photo #1.jpg', '100x100'));
    expect(url.pathname).toBe('/pb/api/files/family_members/member/photo%20%231.jpg');
    expect(url.searchParams.get('token')).toBe('file-token');
    expect(url.searchParams.get('thumb')).toBe('100x100');
    await protectedFileUrl('family_members', 'other', 'other.jpg');
    expect(pb.send).toHaveBeenCalledTimes(1);
  });
  it('deduplicates concurrent token requests and refreshes only on demand or expiry', async () => {
    vi.useFakeTimers(); const pb = client(); setPocketBaseClient(pb);
    await Promise.all([protectedFileUrl('c', 'a', 'a.jpg'), protectedFileUrl('c', 'b', 'b.jpg')]);
    expect(pb.send).toHaveBeenCalledTimes(1);
    await protectedFileUrl('c', 'a', 'a.jpg', undefined, true);
    expect(pb.send).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(61000);
    await protectedFileUrl('c', 'a', 'a.jpg');
    expect(pb.send).toHaveBeenCalledTimes(3);
  });
  it('does not request a file token when signed out', async () => {
    const pb = client(); pb.authStore.token = ''; setPocketBaseClient(pb);
    await expect(protectedFileUrl('c', 'a', 'a.jpg')).rejects.toThrow();
    expect(pb.send).not.toHaveBeenCalled();
  });
  it('rejects a late result after logout/account change and does not cache it for the new account', async () => {
    const pb = client(); let resolve!: (value: { token: string }) => void;
    pb.send.mockImplementationOnce(() => new Promise(r => { resolve = r; })); setPocketBaseClient(pb);
    const pending = protectedFileUrl('c', 'a', 'a.jpg');
    pb.authStore.token = 'account-b'; resolve({ token: 'old-file-token' });
    await expect(pending).rejects.toThrow();
    expect(await protectedFileUrl('c', 'a', 'a.jpg')).toContain('file-token');
    expect(pb.send).toHaveBeenCalledTimes(2);
  });
  it('does not downgrade to a public URL if token authorization fails', async () => {
    const pb = client(); pb.send.mockRejectedValueOnce(new Error('403')); setPocketBaseClient(pb);
    await expect(protectedFileUrl('c', 'a', 'a.jpg')).rejects.toThrow('403');
  });
  it('rejects a pending token even if the original account is restored before the response', async () => {
    let changed: ((token: string, record: unknown) => void) | undefined;
    const pb = client();
    const observable = { ...pb, authStore: { ...pb.authStore, onChange: (callback: typeof changed) => { changed = callback; return () => {}; } } };
    let resolve!: (value: { token: string }) => void;
    pb.send.mockImplementationOnce(() => new Promise(r => { resolve = r; })); setPocketBaseClient(observable);
    const pending = protectedFileUrl('c', 'a', 'a.jpg');
    observable.authStore.token = ''; changed?.('', null);
    observable.authStore.token = 'account-a'; changed?.('account-a', { id: 'user-a' });
    resolve({ token: 'stale-token' });
    await expect(pending).rejects.toThrow('Аккаунт изменился');
  });
  it('uses the SDK file service when available', async () => {
    const pb = { ...client(), files: { getToken: vi.fn(async () => 'sdk-token'), getURL: vi.fn(() => 'https://family.test/sdk-protected-url') } };
    setPocketBaseClient(pb);
    expect(await protectedFileUrl('family_members', 'member', 'avatar.jpg', '100x100')).toBe('https://family.test/sdk-protected-url');
    expect(pb.files.getURL).toHaveBeenCalledWith({ id: 'member', collectionName: 'family_members' }, 'avatar.jpg', { token: 'sdk-token', thumb: '100x100' });
    expect(pb.send).not.toHaveBeenCalled();
  });
});

describe('member avatar updates', () => {
  const parent: FamilyMember = { id: 'parent', family: 'f', user: 'user-a', displayName: 'Parent', role: 'parent', active: true, managedBy: [] };
  const child: FamilyMember = { ...parent, id: 'child', user: undefined, role: 'child', managedBy: ['parent'] };
  it('uses the signed-in actor for own/managed-child controls, independent of selected profile', () => {
    expect(canEditMemberAvatar([parent, child], 'user-a', parent)).toBe(true);
    expect(canEditMemberAvatar([parent, child], 'user-a', child)).toBe(true);
    expect(canEditMemberAvatar([parent, child], undefined, child)).toBe(false);
    expect(canEditMemberAvatar([parent, child], 'user-a', { ...child, managedBy: [] })).toBe(false);
    expect(canEditMemberAvatar([parent, child], 'user-a', { ...child, family: 'other' })).toBe(false);
    expect(canEditMemberAvatar([parent, child], 'user-a', { ...child, role: 'adult' })).toBe(false);
  });
  it('maps the existing file field', () => {
    expect(mapFamilyMemberRecord({ avatar: 'crop.jpg' }).avatar).toBe('crop.jpg');
    expect(mapFamilyMemberRecord({ avatar: '' }).avatar).toBeUndefined();
  });
  it('sends only the cropped file as replacement, and null as removal', async () => {
    const pb = client(); const update = vi.fn(async () => ({ id: 'member', avatar: 'crop.jpg' }));
    pb.collection.mockReturnValue({ update }); setPocketBaseClient(pb);
    const file = new File(['crop'], 'avatar.jpg', { type: 'image/jpeg' });
    const context = { familyId: 'f', memberId: 'parent' };
    await updateMemberAvatar('member', file, context);
    expect(update).toHaveBeenLastCalledWith('member', { avatar: file }, { headers: { 'X-Family-Member-Id': 'parent' } });
    await updateMemberAvatar('member', null, context);
    expect(update).toHaveBeenLastCalledWith('member', { avatar: '' }, { headers: { 'X-Family-Member-Id': 'parent' } });
  });
  it('rejects a late member update response after the account changes', async () => {
    const pb = client(); let resolve!: (value: { id: string; avatar: string }) => void;
    pb.collection.mockReturnValue({ update: vi.fn(() => new Promise(r => { resolve = r; })) }); setPocketBaseClient(pb);
    const pending = updateMemberAvatar('member', null, { familyId: 'f', memberId: 'parent' });
    pb.authStore.token = 'account-b'; resolve({ id: 'member', avatar: '' });
    await expect(pending).rejects.toThrow('Аккаунт изменился');
  });
  it('ignores an avatar response from a session that logged out and logged back in', async () => {
    let changed: ((token: string, record: unknown) => void) | undefined;
    const pb = client();
    const observable = { ...pb, authStore: { ...pb.authStore, onChange: (callback: typeof changed) => { changed = callback; return () => {}; } } };
    let resolve!: (value: { id: string; avatar: string }) => void;
    pb.collection.mockReturnValue({ update: vi.fn(() => new Promise(r => { resolve = r; })) }); setPocketBaseClient(observable);
    const pending = updateMemberAvatar('member', null, { familyId: 'f', memberId: 'parent' });
    observable.authStore.token = ''; changed?.('', null);
    observable.authStore.token = 'account-a'; changed?.('account-a', { id: 'user-a' });
    resolve({ id: 'member', avatar: '' });
    await expect(pending).rejects.toThrow('Аккаунт изменился');
  });
});
