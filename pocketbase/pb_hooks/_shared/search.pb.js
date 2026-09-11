function updateSearchText(record) {
  const text = ['title', 'description', 'location_text'].map((field) => record.getString(field)).join(' ');
  record.set('search_text', text.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim());
}
module.exports = { updateSearchText };
