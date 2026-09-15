# Обновление без чата

Основной процесс теперь — [полный GitHub Actions CI/CD](GITHUB.md).
Ниже сохранён ручной UI-only способ как дополнительный инструмент.

Для текущего VPS: `147.45.136.245`. Доступен ручной сценарий через терминал.
Сборка выполняется на компьютере; сервер получает готовые файлы. Пароль SSH
вводится по запросу, не хранится в скриптах. Предпочтителен отдельный SSH-ключ.

## 1. Проверить и собрать на компьютере

Из корня репозитория, с Node/pnpm и Go из `deploy/README.md`:

```bash
pnpm check
pnpm lint
pnpm test
pnpm backend:test
pnpm release:package
```

Последняя команда напечатает путь `dist/familytime-YYYYMMDDTHHMMSS.tar.gz`.
Используйте фактическое имя вместо примера ниже. Не собирайте приложение на VPS.

Для UI-only обновления используйте точный backend из сохранённого текущего релиза:

```bash
FAMILYTIME_BACKEND_RELEASE=dist/ИМЯ_ТЕКУЩЕГО_РЕЛИЗА pnpm release:package
```

Так обновление Go или отличие build metadata не заменит рабочий backend.
Hooks/миграции сверяются при сборке, а весь backend повторно сверяется на сервере.
Этот режим не публикует изменения Go-кода: при изменениях backend используйте полный процесс.

## 2. Загрузить пакет

```bash
ssh root@147.45.136.245 'mkdir -p /root/familytime-upload'
scp dist/familytime-YYYYMMDDTHHMMSS.tar.gz deploy/update-ui.sh root@147.45.136.245:/root/familytime-upload/
```

## 3. Применить обновление интерфейса

```bash
ssh root@147.45.136.245
bash /root/familytime-upload/update-ui.sh /root/familytime-upload/familytime-YYYYMMDDTHHMMSS.tar.gz
```

Скрипт проверяет checksum и полное совпадение backend, hooks и миграций с текущим
релизом. При несовпадении останавливается: это намеренная защита, не обходите её.
Пакеты должны быть доверенными, из этого репозитория: checksum не является подписью.

Затем сохраняются старые immutable assets, выполняется свежий backup и атомарно
переключается `current`. Backup кратко останавливает только PocketBase. Сами UI-файлы
не требуют перезапуска Caddy или VPN. После переключения проверяются health и HTTPS;
при ошибке этих проверок ссылка автоматически возвращается назад.

При прерванной попытке проверьте `readlink -f /opt/familytime/current` и журнал.
Повторная публикация одноимённого каталога запрещена: соберите новый пакет.
Не удаляйте каталоги релизов, пока не установлено, какой из них используется.

## 4. Проверить после публикации

```bash
readlink -f /opt/familytime/current
systemctl is-active familytime-pocketbase familytime-caddy wg-quick@wg0
docker inspect --format '{{.State.StartedAt}} restarts={{.RestartCount}}' amnezia-awg2
curl --fail https://147.45.136.245/api/health
journalctl -u familytime-pocketbase --since '10 minutes ago' --no-pager
```

Проверьте вход, Сегодня, модалку, переключение профилей и уведомления в браузере.
HTTP 200 не заменяет пользовательскую проверку. В установленной PWA подтвердите
предложение обновления; не очищайте данные сайта и не пересоздавайте push-подписку.

## Откат UI-only релиза

Скрипт выводит `Previous`. Только для релиза с неизменным backend/схемой можно
вернуть эту ссылку под тем же maintenance lock, без восстановления базы:

```bash
flock /run/lock/familytime-maintenance.lock bash
ln -s /opt/familytime/releases/ИМЯ_ПРЕДЫДУЩЕГО_РЕЛИЗА /opt/familytime/rollback-next
mv -Tf /opt/familytime/rollback-next /opt/familytime/current
exit
```

Убедитесь, что `rollback-next` отсутствует до начала. После отката повторите проверки.
Новые вкладки старой сборки могут потребовать перезагрузки.

## Когда меняется backend или база

`update-ui.sh` такой релиз не применяет. Нужны отдельная проверка миграций,
восстановление backup в изоляции и остановка PocketBase на время переключения.
После миграции простой откат ссылки небезопасен: используется `restore.sh` с
точным архивом базы и релиза. Подробности в [README](README.md).

В дальнейшем эти шаги можно запускать из CI с ручным подтверждением deployment.
Сейчас CI-публикация не настроена. Автоматический deploy каждого push не включён.
Firewall, маршруты, Docker-сети, системные обновления и VPN не входят в процесс.
