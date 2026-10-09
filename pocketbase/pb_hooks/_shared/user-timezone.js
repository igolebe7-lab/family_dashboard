function validateUserTimezone(event) {
  const zone = event.record.getString('timezone');
  if (zone && (!/^(UTC|[A-Za-z_+-]+\/[A-Za-z0-9_+/-]+)$/.test(zone) || new Timezone(zone).string() !== zone)) {
    throw new ApiError(400, 'Выберите корректный часовой пояс', { timezone: { message: 'Неизвестный часовой пояс' } });
  }
  event.next();
}
module.exports = { validateUserTimezone };
