const ADULT_ROLES = ['owner', 'parent', 'adult'];

function isAdultRole(role) {
  return ADULT_ROLES.includes(role);
}

function requireSameFamily(actorMember, familyId) {
  if (!actorMember || actorMember.get('family') !== familyId) {
    throw newApiError(403, 'Нет доступа к этой семье', {});
  }
}

function canCreateAssignmentFor(actorMember, assigneeMember) {
  if (!actorMember || !assigneeMember) return false;
  if (actorMember.get('family') !== assigneeMember.get('family')) return false;
  if (actorMember.get('role') === 'owner' || actorMember.get('role') === 'parent') return true;
  return isAdultRole(actorMember.get('role')) && assigneeMember.get('role') !== 'child';
}

function canManageMember(actorMember, targetMember) {
  if (!actorMember || !targetMember) return false;
  if (actorMember.get('family') !== targetMember.get('family')) return false;
  if (!actorMember.get('active') || !targetMember.get('active')) return false;
  if (!['child', 'teen'].includes(targetMember.get('role'))) return false;
  if (actorMember.get('role') === 'owner') return true;
  if (actorMember.get('role') !== 'parent') return false;
  return require(`${__hooks}/_shared/auth.pb.js`)
    .getRecordArray(targetMember, 'managed_by')
    .includes(actorMember.id);
}

function canViewItem(app, member, item) {
  if (!member || !member.get('active') || member.get('family') !== item.get('family')) return false;
  const { getRecordArray } = require(`${__hooks}/_shared/auth.pb.js`);
  const visibility = item.get('visibility');
  if (visibility === 'family') return true;
  if (visibility === 'adults') return isAdultRole(member.get('role'));
  if ([item.get('created_by'), item.get('owner')].includes(member.id)) return true;
  if (visibility !== 'assignees') return false;
  const explicit = [...getRecordArray(item, 'assignees'), ...getRecordArray(item, 'participants')];
  if (explicit.includes(member.id)) return true;
  return explicit.some((id) => {
    const target = app.findRecordById('family_members', id);
    return target.get('active') && target.get('family') === item.get('family') &&
      ['child', 'teen'].includes(target.get('role')) &&
      ['owner', 'parent'].includes(member.get('role')) &&
      getRecordArray(target, 'managed_by').includes(member.id);
  });
}

module.exports = {
  canViewItem,
  canManageMember,
  canCreateAssignmentFor,
  isAdultRole,
  requireSameFamily
};
