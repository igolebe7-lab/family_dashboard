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
  if (actorMember.get('role') === 'owner') return true;
  if (actorMember.get('role') !== 'parent') return false;
  return require(`${__hooks}/_shared/auth.pb.js`)
    .getRecordArray(targetMember, 'managed_by')
    .includes(actorMember.id);
}

module.exports = {
  canManageMember,
  canCreateAssignmentFor,
  isAdultRole,
  requireSameFamily
};
