# FamilyTime / Семейный Пульс

Приватная семейная PWA для календаря, дел, поручений, детских профилей, семейной ленты и in-app уведомлений.

## Текущий статус

Проект находится на стадии технического планирования. В репозитории уже есть:

- `TECHNICAL_SPEC.md` — основное ТЗ;
- `AGENTS.md` — правила работы Codex-агентов;
- `docs/references/ui/` — UI-референсы;
- `docs/technical/project-analysis.md` — анализ текущего состояния;
- `docs/technical/architecture.md` — целевая архитектура;
- `docs/superpowers/plans/2026-06-08-familytime-development-plan.md` — подробный план разработки по стадиям.

## Целевой стек

- SvelteKit static SPA/PWA, TypeScript, Tailwind CSS;
- `@lucide/svelte` для иконок;
- GSAP только для точечных анимаций;
- PocketBase + SQLite + `pb_hooks`;
- Caddy для HTTPS, static frontend и reverse proxy к PocketBase.

## Ожидаемые команды после scaffold

```bash
pnpm install
pnpm dev
pnpm check
pnpm lint
pnpm test
pnpm build
```

Frontend PocketBase URL is configured with:

```bash
PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
```

If the variable is not set, the local development default is `http://127.0.0.1:8090`.

Локальный PocketBase после установки бинарника:

```bash
cd pocketbase
./pocketbase serve --http=127.0.0.1:8090
```

Бинарник PocketBase не должен коммититься в репозиторий.
