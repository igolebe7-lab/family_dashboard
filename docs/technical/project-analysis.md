# Анализ текущего состояния проекта

Дата анализа: 2026-06-08.

## Найденные файлы

- `TECHNICAL_SPEC.md` — подробное ТЗ продукта, архитектуры, модели данных, UI, PWA, PocketBase и deployment.
- `AGENTS.md` — рабочие правила для Codex-агентов в проекте.
- `image-1-mobile-today.png` — мобильный экран Today.
- `image-2-mobile-calendar-week.png` — мобильный экран Calendar Week.
- `image-3-desktop-week-dashboard.png` — desktop workspace.
- `docs/references/ui/*` — стабильные копии UI-референсов.

## Чего пока нет

- Нет `package.json`, workspace-конфига и package scripts.
- Нет SvelteKit-приложения.
- Нет PocketBase migrations/hooks.
- Нет deployment-конфигов Caddy/systemd/backup.
- Нет автоматизированных тестов.
- До текущей подготовки репозиторий не был git-репозиторием.

## Git

Локальный git-репозиторий инициализирован на ветке `main`.

Remote:

```txt
origin https://github.com/igolebe7-lab/family_dashboard.git
```

## UI-выводы по референсам

Mobile Today:

- первый экран должен сразу показывать приветствие, family avatar row, события дня, блок `Нужно внимание`, быстрые действия и bottom nav;
- карточки крупные, мягкие, с большим радиусом и пастельными category/member accents;
- уведомления и быстрые действия должны быть доступны с первого экрана.

Mobile Calendar:

- нужен segmented control `День / Неделя / Месяц`;
- week strip с цветными dots по членам семьи/категориям;
- вертикальная шкала времени, category filters, крупный FAB;
- событие должно показывать время, title, участника, иконку категории и avatar.

Desktop:

- основная форма: left sidebar + central week grid + right sidebar;
- right sidebar объединяет attention, quick actions и family feed;
- desktop должен оставаться семейным и воздушным, не превращаться в admin UI.

## Главные архитектурные ограничения

- Production без Node SSR runtime, если static PWA достаточно.
- Backend: один PocketBase процесс с SQLite.
- Все family-scoped коллекции обязаны иметь поле `family`.
- Calendar/Today должны загружать `item_occurrences` только по видимому диапазону.
- Realtime subscriptions должны жить только на активных экранах и очищаться при уходе.
- Нельзя добавлять тяжелые зависимости без отдельного решения владельца проекта.
