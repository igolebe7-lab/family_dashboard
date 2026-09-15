# Stage 14.11: эксплуатация

## Main и очистка VPS

Защита воспроизводима из `main-protection.json`: PR, успешный `verify` GitHub Actions
(app ID 15368), актуальная база, разрешённые обсуждения. Force-push, удаление ветки
и обход администратором запрещены. Ноль обязательных ревьюеров: владелец работает один.

`familytime-prune.timer`: ежедневно около 05:10 по времени VPS. Root-owned утилита
удерживает locks CI и обслуживания. Сохраняются current, previous и три последних
каталога (объединение наборов, обычно три, максимум пять). При незавершённом recovery
очистка запрещена. Unknown paths, symlinks, failed-data и backup не удаляются.
`previous` обновляет приёмник после успеха. Assets внутри current отдельно не чистятся.

Dry run: `sudo python3 /usr/local/lib/familytime/prune_releases.py`.
Журнал: `journalctl -u familytime-prune.service`.
Остановка: `sudo systemctl disable --now familytime-prune.timer`.

## Копии на Mac

Каталог: `~/Library/Application Support/FamilyTimeBackup`, только для владельца.
`archives/` содержит до 14 `.tar.gz.age` и JSON-квитанции с SHA-256. Внутри backup:
база, вложения, точный релиз и backend.env/VAPID. Данные семьи не отправляются в GitHub.

VPS создаёт ежедневный backup около 04:20. Mac проверяет новый каждый час и при
запуске agent. SSH-поток одновременно шифруется age; SHA-256 исходного потока
сверяется до публикации файла и очистки старых копий. Plaintext tar не сохраняется.
Повторный запуск проверяет hash сохранённого ciphertext. Backup старше 48 часов
считается ошибкой; локальный lock запрещает пересечение запусков.

Отдельный forced SSH key `familytime-backup`: только `latest`/`get` готового архива
по строгому имени. Нет shell, записи или forwarding. Host key закреплён.
Sudo разрешает только root-owned exporter, который не исполняет команды клиента.

Launch agent: `~/Library/LaunchAgents/com.familytime.backup.plist`.
Состояние: `last-status.json`, логи: `agent.log`, `agent-error.log` в каталоге копий.
При первой ошибке запрашивается уведомление macOS; показ зависит от системных
настроек. Проверять `ok: true` и свежий `checked_at`, не только уведомления.

```sh
python3 "$HOME/Library/Application Support/FamilyTimeBackup/mac_backup.py" \
  "$HOME/Library/Application Support/FamilyTimeBackup/config.json"
launchctl print "gui/$(id -u)/com.familytime.backup"
```

Mac должен быть включён, пользователь должен войти и иметь сеть. Во сне/при
выключении копий нет; работа возобновляется после возвращения. Возможное отставание:
до суток плюс время выключения Mac. Контролировать свободный диск. Требуются
Homebrew Python 3.11+ и age; после удаления/обновления Python проверить agent.

`identity.age` нужен для расшифровки: хранить дополнительную защищённую копию ключа
отдельно от Mac. Потеря ключа делает архивы бесполезными. Ключ на этом Mac имеет
права 0600; шифрование не защищает от компрометации самого аккаунта. Рекомендуется
FileVault. Ключи/конфиги не коммитить.

## Внешний монитор

`FamilyTime External Monitor`: HTTP/API health, commit и /login каждые 15 минут
из GitHub, три попытки. Проверяется доверенность TLS, IP SAN и срок. Предупреждение:
осталось менее суток или 20% срока для ещё более коротких сертификатов.

При сбое создаётся одна публичная issue без семейных данных, назначенная владельцу.
Повторы не создают дубли, восстановление закрывает incident; job при сбое красный.
Email зависит от настроек GitHub. Ручной запуск: Actions → External Monitor → Run workflow.
Mac дополнительно проверяет доступность каждый час после проверки backup.

GitHub cron может задерживаться; после 60 дней без активности публичного репозитория
расписание отключается. Это не SLA-монитор: следить за свежестью runs; для строгого
24/7 контроля нужен отдельный сервис. Документация:
https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

## Проверка восстановления

```sh
python3 deploy/recovery_drill.py \
  "$HOME/Library/Application Support/FamilyTimeBackup/config.json"
```

Нужен Docker Desktop и pinned Linux amd64 image (digest в скрипте). Проверяется
hash ciphertext и аутентификация age, пути архива и отсутствие ссылок. Расшифровка
идёт в приватный временный каталог. Контейнер запускает точный backend из backup:
512 MiB/1 CPU, read-only root, без capabilities и сети. Production env/VAPID не
передаются в контейнер. После обычного завершения временные файлы и контейнер
удаляются; после kill -9 проверить остатки `familytime-recovery-*` в temp и Docker.

Проверяются SQLite integrity/foreign keys, основные коллекции, неизменность числа
пользователей/семей/участников/записей, API health, запрет анонимного чтения семьи.
Push/VPN не испытываются. Тест не доказывает восстановление VPS/Caddy/VPN целиком.
`restore.sh` не запускать на production ради испытания.

Фактический тест 2026-09-15: `familytime-20260915T202101Z.tar.gz.age`, SQLite/API/
изоляция прошли, временные файлы и контейнер удалены.
