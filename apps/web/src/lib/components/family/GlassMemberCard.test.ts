import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import GlassMemberCard from './GlassMemberCard.svelte';
import ActiveProfileSwitcher from './ActiveProfileSwitcher.svelte';
import type { FamilyMember } from '$lib/types/domain';

const member: FamilyMember = { id: 'member', family: 'family', displayName: 'Ева', role: 'child', colorKey: 'peach', active: true, managedBy: ['parent'] };
const callbacks = { onedit() {}, oninvite() {}, onchild() {}, oncopy() {} };

describe('Family glass specimen', () => {
  it('keeps child action and a named edit control without turning the whole card into a button', () => {
    const { body } = render(GlassMemberCard, { props: { member, roleLabel: 'Ребёнок', editable: true, childMode: true, ...callbacks } });
    expect(body).toContain('<article');
    expect(body).toContain('aria-label="Изменить профиль Ева"');
    expect(body).toContain('Детский режим');
    expect(body).not.toContain('Пригласить');
    expect(body).toContain('var(--color-peach)');
  });
  it('does not expose management actions when the parent passes no permission', () => {
    const { body } = render(GlassMemberCard, { props: { member, roleLabel: 'Ребёнок', ...callbacks } });
    expect(body).not.toContain('<button');
  });
  it('retains the own-account badge and copyable invitation state', () => {
    const { body } = render(GlassMemberCard, { props: { member, roleLabel: 'Ребёнок', own: true, inviteLink: 'https://example.test/invite/code', ...callbacks } });
    expect(body).toContain('Ваш профиль');
    expect(body).toContain('https://example.test/invite/code');
    expect(body).toContain('aria-label="Скопировать ссылку"');
  });
  it('uses a native select and leaves the default switcher unchanged', () => {
    const props = { members: [member, { ...member, id: 'parent' }], activeMember: member, canSwitch: true };
    const glass = render(ActiveProfileSwitcher, { props: { ...props, glass: true } }).body;
    expect(glass).toContain('<select');
    expect(glass).toContain('family-glass-select__avatar');
    expect(render(ActiveProfileSwitcher, { props }).body).not.toContain('family-glass-select__avatar');
  });
});
