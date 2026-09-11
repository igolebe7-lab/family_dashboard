# Серверные напоминания

`items.reminder_enabled` отделяет отсутствие напоминания от offset `0`.
Create API передаёт `reminder_enabled: reminderOffsetMinutes !== undefined`.
Миграция `20260911093000_item_reminders.js` включает старые положительные offsets;
старые нули остаются выключенными, поскольку их исходный смысл утрачен.
Item mapper читает `reminderEnabled`; выключенное напоминание не выдаётся как offset `0`.
Изменение напоминания существующей записи в UI пока не предусмотрено.

`pb_hooks/reminders.pb.js` регистрирует `familytime_reminders` каждую минуту.
Shared helper обрабатывает только уже материализованные occurrences; генерация
повторов принадлежит recurrence scheduler и здесь не реализуется.

- Для события время напоминания: `occurrence.start_at - offset`.
- Для дела/поручения: `occurrence.due_at`, иначе `start_at`, минус offset.
- Окно доставки: последние 24 часа включительно; будущие напоминания не доставляются.
- Пропускаются archived items, статусы `done`, `approved`, `skipped`, `cancelled`,
  отсутствующая дата, отрицательные/дробные offsets и несовпадение семей item/occurrence.
- Получатели: участники события, исполнители поручения, владелец дела (иначе автор).
  Видимость сама по себе не подписывает всю семью на напоминания.
- Перед записью проверяются актуальная активность, семья и `canViewItem`.
  Детские профили без user сохраняют member-scoped inbox по существующему механизму.
- Доставка выполняется транзакционно на occurrence. Уникальный partial index
  гарантирует одно `item.reminder` на `(occurrence, recipient_member)`, включая retries.
  Смена времени/offset не создаёт второе напоминание той же паре.

За запуск читаются максимум две страницы по 50 occurrences. Keyset cursor в
`app.store()` продолжает обход на следующем запуске; завершение обхода сбрасывает
его. После перезапуска обход начинается заново, но уникальность хранится в БД.
Ошибка одной записи не блокирует остальные; запись повторяется при следующем
обходе в пределах 24-часового окна. Это ограничивает обработку и память приложения,
но SQL-фильтр времени всё ещё вычисляется по occurrences в базе.

Это только in-app inbox: `delivered_at` означает создание записи, не Web Push,
не доставку устройству и не прочтение.

## Проверка

`node scripts/smoke-reminders-isolated.mjs` проверяет свободный порт 8092,
создаёт временную БД и копию hooks, регистрирует test-only routes только в этой
копии, запускает сценарии и удаляет собственные временные данные после остановки.
Рабочая БД на 8090 не используется; credentials не выводятся.

Покрытие: none/at-time/offset, границы 24 часов, terminal/archive, recipients,
private/adults, смена семьи и active, pagination/continuation, уникальный индекс,
ошибка хранения с retry и реальный callback cron. Тест API mapping находится в
`apps/web/src/lib/api/reminder-create.test.ts`.

Синтаксис cron и изоляция handlers сверены через Context7 с официальными
[PocketBase jobs docs](https://pocketbase.io/docs/js-jobs-scheduling/).
