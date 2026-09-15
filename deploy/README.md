# Размещение FamilyTime по IP (Stage 14.4)

Stage 14.1-14.4 выполнялись только локально. Stage 14.5 размещён 2026-09-14
после отдельного разрешения владельца и подтверждения ручного backup.
Состояние и границы проверки: [Stage 14.5](../docs/technical/deployment-stage145.md).
Команды ниже НЕ выполняются автоматически.

Полный CI/CD из GitHub Actions описан в [GITHUB.md](GITHUB.md): frontend,
backend и hooks автоматически, миграции после подтверждения в GitHub.

Для повторного обновления интерфейса без чата: [пошаговая инструкция](UPDATING.md)
и `update-ui.sh`. Скрипт отказывается применять изменения backend/миграций.

## Схема и локальная сборка

- `https://147.45.136.245/app/today`: Caddy TCP 443; HTTP 80 для ACME/redirect.
- PocketBase с JS hooks и Go Web Push: только `127.0.0.1:8090`.
- Существующие UDP 44912/51820, Docker, маршруты и NAT не менять.
- В production нет Node runtime. App shell не содержит семейных данных.
- Смена IP/домена требует повторного разрешения push и установки PWA.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm lint
pnpm test
pnpm backend:test
pnpm backend:build
pnpm release:package
```

Нужен Go 1.25+ в PATH или `GO_BIN=/path/to/go`. Scripts задают
`GOEXPERIMENT=nojsonv2`: PocketBase 0.38.2 рекурсивно вызывает Collection.UnmarshalJSON
на JSON v2 в Go 1.27. Build guard запрещает случайную несовместимую сборку.
Версии закреплены в `pocketbase/go.mod`/`go.sum`; штатного self-update нет.
Обновление: версия в исходниках, миграционные/security tests, пересборка.

В `dist/` создаётся архив Linux amd64 с `backend/pocketbase`, hooks, миграциями,
`web/`, `deploy/`, `SHA256SUMS`. В нём НЕТ VAPID keys, `pb_data` и тестовых пользователей.

## Перед изменениями VPS

1. Получить отдельное разрешение. Сохранить snapshot провайдера и защищённую копию VPN-конфигураций.
2. Проверить свободные 80/443, внешнюю доступность HTTP, outbound HTTPS, память и диск.
3. Обеспечить доступ через консоль провайдера и отдельную рабочую SSH-сессию.
4. Не запускать общий upgrade/reboot, не менять Docker/UFW/iptables/sysctl.
5. Создать пустую production-базу, не переносить локальную demo-семью.
   По разрешению владельца отдельная тестовая семья может создаваться через API;
   новые аккаунты не должны автоматически становиться её участниками.

## Каталоги и права

Создать отдельных системных пользователей `familytime` и `caddy` без shell login.
Путь бинарника Caddy в unit: `/usr/bin/caddy`; проверить фактический путь.
Не позволять штатной службе Caddy автоматически занимать порты при установке пакета:
использовать проверенный standalone binary либо заранее контролировать package service startup.

| Путь | Права / назначение |
|---|---|
| `/opt/familytime/releases/<release>/` | root, read/execute для служб; распакованный пакет |
| `/opt/familytime/current` | ссылка на проверенный release |
| `/var/lib/familytime/pb_data` | familytime:familytime, 0700 |
| `/etc/familytime/backend.env` | root:familytime, 0640, VAPID keys и контакт |
| `/etc/familytime/public.env` | root:caddy, 0640, только FAMILYTIME_PUBLIC_IP |
| `/etc/familytime/Caddyfile` | root:caddy, 0640 |
| `/var/lib/familytime-acme` | root, 0755, только ACME challenge files |
| `/etc/familytime/tls` | root:caddy, 0750; private key 0640 |
| `/var/backups/familytime` | root, 0700, секреты и семейные данные |

Проверить `sha256sum --check SHA256SUMS` внутри пакета. Один раз сгенерировать
VAPID `backend/pocketbase vapid-keygen`, сохранить вне git, добавить реальный
`FAMILYTIME_VAPID_SUBJECT=mailto:...`. Пустые три переменные отключают Web Push,
но in-app уведомления продолжают работать. Не ротировать ключи с каждым релизом.

## HTTPS без домена

IP-сертификаты Let's Encrypt действуют около 6 суток. Нужен Certbot **5.4+**;
не считать старый пакет Ubuntu 22.04 подходящим без проверки версии.
Источник: https://letsencrypt.org/2026/03/11/shorter-certs-certbot/

1. Запустить только `familytime-caddy.service` с `Caddyfile.bootstrap`. Проверить
   challenge-файл через внешний интернет на HTTP 80. Приложение по HTTP недоступно.
2. Проверить staging с отдельными каталогами:

```bash
certbot certonly --staging --preferred-profile shortlived --webroot \
  --webroot-path /var/lib/familytime-acme --ip-address 147.45.136.245 \
  --config-dir /var/lib/familytime-acme-staging/config \
  --work-dir /var/lib/familytime-acme-staging/work \
  --logs-dir /var/lib/familytime-acme-staging/logs
```

3. Получить production сертификат без `--staging` и staging-каталогов, указать
   действующий email владельца и принять условия CA. Staging/self-signed не использовать для PWA.
4. Установить `certificate-deploy.sh` как root-owned executable
   `/etc/letsencrypt/renewal-hooks/deploy/familytime`. Выполнить первый раз с
   `RENEWED_LINEAGE=/etc/letsencrypt/live/147.45.136.245`.
5. Заменить bootstrap на `Caddyfile`, validate/reload только FamilyTime Caddy.
6. Проверить существующий Certbot timer: минимум дважды в сутки и persistence.
   Deploy hook копирует сертификат и перезагружает конфигурацию Caddy, не VPN.
   Не создавать второй timer поверх существующего.
   Для изолированной установки `/opt/familytime-certbot` подготовлены
   `familytime-certbot.service` и `.timer` (три проверки в сутки); они установлены
   на текущем VPS, где раньше Certbot отсутствовал.
7. Проверить `certbot renew --dry-run`, не копируя staging cert в production.
   Ежедневно проверять срок установленного сертификата; предупреждать владельца
   при остатке <48 часов. Внешнее оповещение согласовать в Stage 14.5: journal не заменяет его.

## Службы и лимиты

Подготовлены PocketBase/Caddy units и backup service/timer. Лимиты являются
стартовыми настройками, а не подтверждённым профилем VPS:
PocketBase MemoryHigh 180M / MemoryMax 240M / CPUQuota 50%; Caddy 64M / 96M / 30%.
Превышение лимита может остановить приложение. Это снижает риск общего OOM,
но не изолирует диск, сеть и ядро от VPN. Swap создавать только по отдельному решению.
Проверить `systemd-analyze verify`, health, RSS, cgroup peaks и restarts при совместной нагрузке.
До проверки путей, пользователей, ключей и HTTPS службы не включать.

Dashboard и административные API наружу не проксируются. Для администрирования
использовать SSH tunnel к 8090. Superuser создаётся вручную через CLI; его пароль
не включать в пакет/скрипты и общую shell history.

## Backup, обновление, rollback

Перед обновлением: `bash /opt/familytime/current/deploy/backup.sh`.
Скрипт блокирует параллельное обслуживание, останавливает только PocketBase,
архивирует `pb_data` с WAL/files, VAPID env и точный release, проверяет архив,
запускает PocketBase обратно и оставляет последние 7 копий. Ежедневно копировать
backup за пределы VPS в защищённое хранилище; он содержит секреты.

Под maintenance lock остановить PocketBase, сохранить старый target `current`,
атомарно переключить ссылку на новый release и запустить PocketBase.
`--automigrate=false` отключает генерацию, но НЕ применение миграций при запуске.
Проверить health, логин, создание/повторение записей и push, а не только HTTP 200.

После миграции нельзя просто вернуть старый бинарник. Восстановить точный архив
базы и release через `restore.sh ARCHIVE --confirm-restore`.
Restore проверяет checksum и распаковывает архив в отдельный каталог, затем
останавливает только PocketBase и сохраняет предыдущую базу рядом. Требуется
место под обе базы и распаковку. При ошибке после остановки оставить приложение
остановленным, разобраться и вручную вернуть старую базу/release. VPN не трогать.
Не подавать архивы из недоверенного источника. Старые push subscriptions после
restore могут потребовать повторного включения; локальный logout gate и provider
unsubscribe ограничивают старые доставки. Restore drill в отдельном каталоге
обязателен на Stage 14.5 ДО включения backup timer.

Для старых вкладок при обновлении сохранить immutable assets предыдущего release
в новом `web/` на период их жизни. После rollback проверить обновление PWA/offline shell.

## Приёмка Stage 14.5

- iPhone iOS 16.4+: Safari -> экран Домой -> запуск -> разрешение -> push при закрытом PWA.
- Desktop: разрешение браузера/ОС, доставка и открытие нужной записи.
- Logout/offline logout, смена аккаунта, отозванный доступ, запрет уведомлений в ОС.
- Parent creates -> child done -> parent approves -> inbox/feed/push.
- Оба VPN передают трафик, CPU/RAM/I/O приемлемы при совместной работе.
- Доверенный IP сертификат, renewal, backup и restore действительно проверены.

Локальные тесты не подтверждают APNs/FCM-доставку и доступность IP из мобильной сети.
