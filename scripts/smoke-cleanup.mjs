const FAMILY_COLLECTIONS = [
  'notifications', 'item_activity', 'item_comments', 'item_occurrences', 'items',
  'day_annotations', 'invitations', 'family_members'
];

export async function cleanupSmokeRun({ owned, list, remove }) {
  const deleted = {};
  const families = owned.filter((record) => record.collection === 'families');
  const erase = async (collection, id) => {
    await remove(collection, id);
    deleted[collection] = (deleted[collection] || 0) + 1;
  };
  for (const collection of FAMILY_COLLECTIONS) {
    for (const family of families) {
      for (const record of await list(collection, family.id)) {
        // Verify scope again even when the API already received a family filter.
        if (record.family === family.id) await erase(collection, record.id);
      }
    }
  }
  for (const family of families) await erase('families', family.id);
  for (const user of owned.filter((record) => record.collection === 'users')) {
    await erase('users', user.id);
  }
  return deleted;
}
