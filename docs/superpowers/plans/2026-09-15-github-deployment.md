# GitHub Deployment Implementation Plan

**Goal:** автоматическая публикация проверенного интерфейса из main без доступа CI к VPN и root shell.
**Architecture:** GitHub-hosted runner; статический пакет; выделенный SSH-ключ с forced command;
root-owned приёмник проверяет архив и fingerprint backend, сохраняет backup и атомарно меняет current.
**Tech Stack:** GitHub Actions, Node/pnpm, Python standard library, OpenSSH, systemd.
**Spec:** TECHNICAL_SPEC.md, deploy/UPDATING.md.

## Ограничения

- Никакого runner, Node runtime или сборки на VPS.
- Никаких команд из загруженного архива с правами root.
- Только main; concurrency без прерывания активного deployment.
- Backend, миграции, секреты, Caddy и VPN не обновляются автоматически.
- Изменение backend fingerprint блокирует deployment до отдельной backend-публикации.

## Шаги

- [x] Commit и push текущего приложения в main до испытаний CI.
- [ ] Пакетирование web + commit + backend fingerprint; тесты валидации архива.
- [ ] Root-owned приёмник с ограничением размера, lock, backup, health и rollback.
- [ ] Workflow проверок/сборки/deploy; выделенный ключ и production environment.
- [ ] Push workflow, настоящий Actions run, проверка релиза и состояния VPN.
- [ ] Документация запуска, ограничений, отключения и восстановления.
