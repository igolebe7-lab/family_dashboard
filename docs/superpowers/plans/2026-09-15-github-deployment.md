# GitHub Deployment Implementation Plan

**Goal:** полная публикация frontend/backend из main без доступа CI к VPN и root shell.
**Architecture:** GitHub-hosted runner; единый пакет; выделенный SSH-ключ с forced command;
root-owned приёмник проверяет архив и миграции на копии SQLite, сохраняет backup и меняет current.
**Tech Stack:** GitHub Actions, Node/pnpm, Python standard library, OpenSSH, systemd.
**Spec:** TECHNICAL_SPEC.md, deploy/UPDATING.md.

## Ограничения

- Никакого runner, Node runtime или сборки на VPS.
- Никаких команд из загруженного архива с правами root.
- Только main; concurrency без прерывания активного deployment.
- Backend и hooks обновляются автоматически; любые изменения миграций требуют подтверждения GitHub environment.
- Секреты, Caddy, инструменты deployment и VPN не меняются загруженным пакетом.

## Шаги

- [x] Commit и push текущего приложения в main до испытаний CI.
- [x] Пакетирование web + backend + commit; тесты валидации архива.
- [x] Root-owned приёмник с ограничением размера, lock, backup, health и rollback кода/базы.
- [x] Workflow проверок/сборки/deploy; выделенный ключ и production environments.
- [ ] Push workflow, настоящий Actions run, проверка релиза и состояния VPN.
- [x] Документация запуска, ограничений, отключения и восстановления: deploy/GITHUB.md.
