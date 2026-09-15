# Web Push: Stage 14.1-14.4

## Реализация

PocketBase 0.38.2 собирается с webpush-go 1.4.0; шифрование RFC 8291/VAPID выполняет
библиотека, не JS hooks. Отдельного Node-сервиса, Redis и внешней очереди нет.
Четыре JS runtime в pool вместо стандартных пятнадцати уменьшают базовый расход.
В Go 1.27 нужен GOEXPERIMENT=nojsonv2: проверено интеграционным тестом миграций.

`notifications` остаётся источником истины. OnRecordAfterCreateSuccess будит
обработчик после commit; cron раз в минуту восстанавливает пропущенную работу.
В короткой SQLite-транзакции выбирается не более 100 необработанных notices,
создаются доставки для подписок получателя, существовавших на момент уведомления,
и устанавливается push_enqueued. Исторический inbox миграция помечает обработанным.
Уникальный индекс notification/subscription защищает от повторного enqueue.
Сетевые отправки происходят вне транзакций, последовательно, до 32 за проход.

Запрос имеет timeout 8 секунд. 2xx означает принятие провайдером (не доставку ОС).
404/410 удаляет подписку и связанные доставки. Сетевые ошибки, 429 и 5xx повторяются
с backoff, максимум шесть попыток и 24 часа жизни доставки; TTL у провайдера 1 час.
Другие ответы заканчивают доставку как failed. Stable topic/tag схлопывает повторы,
но exactly-once между SQLite и внешним провайдером не гарантируется.
Ежедневная ограниченная очистка удаляет старые доставки и давно истёкшие подписки.

## API

- GET `/api/familytime/push/config`: enabled/publicKey, no-store, без секретов.
- PUT `/api/familytime/push/subscription`: users auth, endpoint/keys/secret/label;
  не более 10 устройств, нельзя захватить endpoint другого пользователя или устройства.
- POST `/api/familytime/push/revoke`: id + 256-bit browser secret, работает без auth
  после logout/expiry; idempotent 204 и для отсутствующей/неподходящей записи.
- POST `/api/familytime/push/test`: своё устройство + secret, не чаще раза в минуту.

Все обычные CRUD rules push-коллекций равны null. Endpoint/key/secret не передаются
в realtime. Endpoint ограничен HTTPS официальных Apple/FCM/Mozilla/Windows providers;
redirects и proxy отключены, DNS проверяется при соединении на public unicast IP.
Поддержка нового browser provider требует отдельного изменения allowlist и проверки.

## Приватность и выход

Подписка привязана к auth user, hash tokenKey и сроку auth token. Смена пароля или
истечение сессии запрещает отправку. Auth refresh при открытии приложения продлевает
подписку, постоянного клиентского polling нет. Перед каждой отправкой повторно
вычисляется notification viewRule с текущим пользователем. Прочитанные, недоступные
записи и напоминания завершённых/отменённых occurrences не отправляются.

В push нет названий/описаний семейных дел: только нейтральный текст, opaque IDs и
внутренний URL. Worker читает device gate из IndexedDB, сверяет subscriptionId/expiry.
Logout удаляет gate, закрывает показанные уведомления, вызывает browser unsubscribe
и capability revoke. Неудавшиеся offline revoke остаются в IndexedDB и повторяются
при открытии приложения/восстановлении сети. Auth токен в worker не хранится.
Клик допускает только `/app/items/<15-character-id>` или `/app/notifications`.
Обычные API/route guards проверяют доступ снова; старое уведомление не предоставляет прав.

## PWA

Manifest имеет стабильный id, standalone display, PNG 192/512, safe-area maskable,
apple-touch-icon 180. Нет принудительной portrait orientation на desktop.
Настройки: `/app/settings/notifications`. Вызов Notification.requestPermission
выполняется непосредственно из обработчика кнопки (требование Safari).
Тестировать service worker нужно на production preview, не Vite dev.

## Граница готовности

Локально: schema/API/security, шифрованный transport, retry/revoke, работа реального
SW с синтетическим PushEvent, desktop/mobile layout и iPhone install gating.
Эмуляция user-agent не является испытанием настоящего Safari/iPhone.
После разрешения Stage 14.5: публичный IP HTTPS, APNs/FCM на реальных устройствах,
закрытое приложение/заблокированный экран, настройки ОС/Focus, сертификат renewal,
совместная нагрузка VPN, backup/restore. Доставка зависит от ОС, сети и разрешений.
