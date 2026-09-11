onRecordUpdateRequest((event) => {
  if (event.hasSuperuserAuth()) return event.next();
  const body = event.requestInfo().body || {};
  for (const field of Object.keys(body)) {
    if (field !== 'read_at') throw newApiError(400, 'Можно менять только отметку прочтения', { field });
  }
  event.next();
}, 'notifications');

onRecordUpdateRequest((event) => {
  if (event.hasSuperuserAuth()) return event.next();
  const original = event.record.original();
  for (const field of ['family', 'item', 'occurrence', 'author']) {
    if (event.record.get(field) !== original.get(field)) {
      throw newApiError(400, 'Нельзя менять принадлежность или автора комментария', { field });
    }
  }
  event.next();
}, 'item_comments');
