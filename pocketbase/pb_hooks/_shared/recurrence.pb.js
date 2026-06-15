const DEFAULT_MATERIALIZATION_DAYS = 60;

function shouldMaterializeSingleOccurrence(record) {
  return !!(record.get('start_at') || record.get('due_at'));
}

module.exports = {
  DEFAULT_MATERIALIZATION_DAYS,
  shouldMaterializeSingleOccurrence
};
