# AGENTS.md — правила работы Codex-агентов над FamilyTime

Этот файл описывает, как Codex должен работать с проектом семейного календаря, дел и поручений.

Перед началом любой разработки обязательно прочитать:

1. `TECHNICAL_SPEC.md`;
2. референсы UI:
   - `docs/references/ui/image-1-mobile-today.png` или локальный `image-1-mobile-today.png`;
   - `docs/references/ui/image-2-mobile-calendar-week.png` или локальный `image-2-mobile-calendar-week.png`;
   - `docs/references/ui/image-3-desktop-week-dashboard.png` или локальный `image-3-desktop-week-dashboard.png`;
3. текущую структуру репозитория;
4. существующие package scripts.

---

## 1. Основной контекст проекта

Проект — приватная семейная PWA для расписания, дел и поручений.

Целевая инфраструктура ограничена:

```txt
1 vCPU
1 ГБ RAM
15 ГБ NVMe
```

Поэтому запрещено без отдельного решения владельца проекта:

- добавлять тяжёлый backend;
- добавлять PostgreSQL/Redis/Kafka/очереди;
- добавлять Kubernetes;
- добавлять SSR Node runtime в production, если static PWA достаточно;
- тащить тяжёлые UI-библиотеки ради пары компонентов;
- импортировать целые icon packs;
- добавлять постоянный polling там, где достаточно realtime/SSE или range-загрузки.

Базовая архитектура:

```txt
SvelteKit static PWA + TypeScript + Tailwind + Lucide + GSAP
PocketBase + SQLite + pb_hooks
Caddy reverse proxy + static frontend
```

---

## 2. Язык и стиль коммуникации

- В комментариях к задачам и итоговых ответах использовать русский язык.
- Код, имена файлов, имена переменных и типы — на английском.
- UI-тексты приложения — на русском.
- Не писать длинные философские объяснения, когда пользователь просит реализацию.
- Если есть неопределённость, принять разумное решение по `TECHNICAL_SPEC.md` и явно зафиксировать его в коде/документации.

---

## 3. Обязательный рабочий цикл

Перед изменениями:

1. Найти релевантные файлы.
2. Понять текущую архитектуру.
3. Свериться с `TECHNICAL_SPEC.md`.
4. Составить короткий план.
5. Внести минимально достаточные изменения.
6. Запустить проверки, если команды доступны.
7. Обновить документацию, если изменилась архитектура.

После изменений:

- проверить mobile и desktop последствия;
- проверить доступность интерактивных элементов;
- проверить, не нарушена family isolation;
- проверить, не добавлены лишние тяжёлые зависимости;
- кратко описать, что изменено и какие проверки пройдены.

---

## 4. Использование plugin/tool: superpowers

Использовать `superpowers` как инструмент дисциплины разработки.

### Когда использовать

- перед крупной фичей;
- перед сложным рефакторингом;
- при баге, который не очевиден сразу;
- при изменениях архитектуры;
- когда нужно выбрать между несколькими подходами.

### Как использовать

- выбрать подходящий skill/workflow;
- сформулировать план;
- разбить работу на маленькие шаги;
- после реализации сделать self-review;
- не пропускать проверку гипотез при debugging.

### Запрещено

- использовать `superpowers` как замену чтению кода;
- менять архитектуру без сверки с ТЗ;
- делать большие изменения без промежуточной проверки.

---

## 5. Использование plugin/tool: serena

Использовать `serena` для навигации по коду, анализа символов и безопасных рефакторингов.

### Когда использовать

- нужно найти компонент, store, API wrapper или тип;
- нужно понять связи между файлами;
- нужно переименовать символ;
- нужно изменить функцию, которую используют несколько модулей;
- нужно найти все usage конкретного типа/компонента.

### Правила

- Сначала искать символы и структуру через `serena`, а не вручную открывать десятки файлов.
- Перед рефакторингом получить список references.
- Не делать слепые replace по всему проекту, если можно сделать symbol-aware refactor.
- После refactor запустить typecheck.

### Особое внимание

В этом проекте важны связи:

- `items` ↔ `item_occurrences`;
- `family_members` ↔ permissions;
- calendar components ↔ date utils;
- API wrappers ↔ PocketBase collection names;
- design tokens ↔ UI components.

---

## 6. Использование plugin/tool: omniseatch / omnisearch

Пользователь указал `omniseatch`. Если в среде Codex инструмент называется `omnisearch`, использовать его; если доступен именно `omniseatch`, использовать его. Далее в этом файле под этим названием имеется в виду semantic/global search по проекту и связанным материалам.

### Когда использовать

- быстрый поиск по всему репозиторию;
- поиск похожих компонентов;
- поиск устаревших UI-текстов;
- поиск TODO/FIXME;
- поиск мест, где нарушается дизайн-система;
- поиск всех упоминаний collection name, route name или enum value.

### Правила

- Для точного символа сначала `serena`, для широкого текстового поиска — `omniseatch/omnisearch`.
- Не полагаться на один найденный файл: проверить соседние usage.
- После поиска удалить/обновить устаревшие дубли.

---

## 7. Использование plugin/tool: context7

Использовать `context7` для свежей документации библиотек и API.

### Обязательно использовать context7 перед тем, как

- настраивать SvelteKit adapter/static/SPA fallback;
- использовать новые Svelte/SvelteKit APIs;
- писать PocketBase hooks, migrations или realtime subscriptions;
- настраивать Tailwind, если версия проекта уже новая;
- подключать `@lucide/svelte`;
- добавлять GSAP patterns;
- настраивать PWA manifest/service worker;
- менять Caddyfile или deployment-конфиг.

### Основные библиотеки для context7

- SvelteKit;
- Svelte;
- Tailwind CSS;
- PocketBase;
- Lucide Svelte;
- GSAP;
- Vite;
- Caddy;
- Workbox или выбранный PWA plugin, если будет добавлен.

### Правила

- Не придумывать API по памяти, если есть сомнения.
- Не использовать устаревшие примеры из блогов, если официальная документация говорит иначе.
- При конфликте источников приоритет: official docs > package README > community article.

---

## 8. Использование plugin/tool: frontend skills

Использовать `frontend skills` для UI, доступности, адаптивности и качества интерфейса.

### Когда использовать

- создание нового экрана;
- реализация responsive layout;
- настройка дизайн-токенов;
- работа с формами;
- доступность modal/sheet/menu;
- визуальное соответствие референсам;
- улучшение microcopy.

### UI-правила проекта

- Сначала mobile, затем desktop adaptation.
- Все главные действия доступны на телефоне большим tap target.
- На desktop использовать left sidebar + central content + right sidebar там, где это соответствует референсу.
- Не полагаться только на цвет: использовать текст, иконку, аватар.
- Все формы должны иметь loading/error/success state.
- Empty states должны быть дружелюбными.
- Focus states обязательны.
- `prefers-reduced-motion` учитывать.

### Визуальная проверка

Перед завершением UI-задачи сравнить с референсами:

- `image-1-mobile-today.png` — главный мобильный Today;
- `image-2-mobile-calendar-week.png` — мобильный календарь;
- `image-3-desktop-week-dashboard.png` — desktop workspace.

Результат должен быть не pixel-perfect, но должен ощущаться как тот же продукт.

---

## 9. Использование plugin/tool: playwright

Использовать `playwright` для браузерной проверки локального приложения, особенно после UI-задач, изменений роутинга, PWA shell, форм, realtime-потоков и deployment smoke test.

### Когда использовать

- проверить, что локальный dev server открывается и основные routes не падают;
- сделать smoke test Today, Calendar, Composer, Notifications, Child mode;
- проверить mobile и desktop viewport после UI-изменений;
- проверить прямой заход/refresh на SPA routes после static build fallback;
- проверить клики, keyboard navigation, focus states, modal/sheet close behavior;
- снять screenshots для сравнения с UI-референсами;
- проверить console errors и важные network requests.

### Правила

- Перед Playwright-проверкой запустить приложение штатной командой проекта, обычно `pnpm dev`.
- Если доступен Browser plugin / in-app browser, использовать его для интерактивной проверки локального UI.
- Для автоматизированных e2e после настройки использовать `npx playwright test` или project script, если он добавлен.
- Проверять минимум два viewport:
  - mobile: около `390x844`;
  - desktop: около `1440x900`.
- Скриншоты хранить только если они нужны для отчёта, regression или debugging; не коммитить случайные временные screenshots.
- Не использовать Playwright как замену unit/type проверкам: `pnpm check`, `pnpm test`, `pnpm build` остаются обязательными, если доступны.
- Если тест зависит от локального PocketBase, явно указать seed/test user assumptions.

### Минимальный UI smoke checklist

```txt
/app/today opens
/app/calendar opens
bottom nav works on mobile
desktop sidebar works on desktop
composer opens and closes
notification bell is focusable
no console errors on initial load
direct route refresh does not 404 after static fallback is configured
```

---

## 10. Использование plugin/tool: gsap skills

Использовать `gsap skills` только для анимаций, где GSAP действительно нужен.

### Разрешённые сценарии

- opening/closing composer sheet;
- calendar zoom transition;
- staggered appearance of Today cards;
- drag/drop feedback;
- child success animation;
- FAB microinteraction.

### Запрещённые сценарии

- простые hover transitions, которые делаются CSS;
- бесконечные декоративные анимации;
- анимация, блокирующая ввод;
- анимация как источник truth для состояния;
- импорт GSAP глобально в каждый компонент.

### Технические правила

- Prefer dynamic import for GSAP-heavy components.
- Use Svelte lifecycle cleanup.
- Kill timelines on destroy.
- Respect `prefers-reduced-motion`.
- Keep durations short:
  - microinteraction: `120–250ms`;
  - sheet/modal: `180–320ms`;
  - celebratory child animation: максимум около `900ms`.

### Пример паттерна

```ts
import { onDestroy, onMount } from 'svelte';

let cleanup: (() => void) | undefined;

onMount(async () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const { gsap } = await import('gsap');
  const ctx = gsap.context(() => {
    gsap.from('.today-card', {
      y: 10,
      opacity: 0,
      duration: 0.22,
      stagger: 0.04,
      ease: 'power2.out'
    });
  });

  cleanup = () => ctx.revert();
});

onDestroy(() => cleanup?.());
```

---

## 11. Coding standards

### TypeScript

- Использовать строгую типизацию.
- Не использовать `any`, если можно описать тип.
- Domain types держать в `src/lib/types/domain.ts`.
- Collection names и enum values держать в constants.

### Svelte

- Компоненты должны быть маленькими и композиционными.
- UI components не должны напрямую содержать сложную бизнес-логику PocketBase.
- API-запросы — через `src/lib/api/*`.
- Date/permissions logic — через utils.

### CSS/Tailwind

- Использовать дизайн-токены.
- Не плодить случайные hex-цвета в компонентах.
- Если нужен новый цвет — добавить token.
- Не дублировать большие классовые конструкции, если нужен reusable component.

### PocketBase

- Все family-scoped коллекции должны иметь `family`.
- Все create/update/delete проверять серверно.
- Не доверять client-side role.
- Все hooks должны быть простыми, тестируемыми и с понятными helper-функциями.
- Не делать тяжёлые операции в realtime paths.

---

## 12. Команды проекта

Если scripts уже настроены, использовать их. Если нет — добавить стандартные.

Ожидаемые команды:

```bash
pnpm install
pnpm dev
pnpm check
pnpm lint
pnpm test
pnpm build
```

Для PocketBase локально:

```bash
cd pocketbase
./pocketbase serve --http=127.0.0.1:8090
```

Если бинарника PocketBase нет в репозитории, не коммитить случайный бинарник без решения владельца проекта. Лучше документировать установку.

---

## 13. Правила добавления зависимостей

Перед добавлением зависимости ответить:

1. Можно ли сделать без неё?
2. Насколько она тяжёлая?
3. Нужна ли она на всех экранах или можно lazy-load?
4. Есть ли Svelte-friendly вариант?
5. Не дублирует ли она уже установленную библиотеку?

Разрешённые базовые зависимости:

- SvelteKit;
- Tailwind;
- `@lucide/svelte`;
- `pocketbase`;
- `zod`;
- `gsap`, но использовать точечно;
- date utility library;
- recurrence utility, если нужна.

Не добавлять без отдельного согласования:

- крупные component suites;
- charting libraries;
- state management frameworks уровня Redux;
- heavy drag/drop libraries, если можно реализовать легче;
- moment.js;
- lodash целиком.

---

## 14. Дизайн-реализация: что важно не потерять

При любой UI-задаче помнить:

- семейные аватары — ключевая часть интерфейса;
- цвет члена семьи должен проходить через карточки, точки, halo, badges;
- категории должны иметь icon + color + label;
- карточки мягкие, крупные, с большим radius;
- фон тёплый, не чисто холодный белый;
- mobile bottom nav должен быть как в изображениях;
- desktop sidebar должен быть воздушным, не admin-like;
- `Нужно внимание` должно звучать мягко, без агрессии;
- детский режим должен быть проще взрослого.

---

## 15. Проверка бизнес-логики

Перед завершением backend/API задачи проверить сценарии:

### Assignment flow

```txt
parent creates assignment for child
child sees assignment
child marks done
parent receives notification
parent approves
assignment becomes approved
activity feed receives records
```

### Event flow

```txt
member creates event with participants
participants see event in Today and Calendar
activity feed records creation
notification is created for participants
```

### Visibility flow

```txt
private item is not visible to unrelated family member
adults item is not visible to child
family item is visible to active family members
assignees item is visible to assignee and creator
```

---

## 16. Ошибки, которых нельзя допускать

- Показывать данные другой семьи.
- Давать ребёнку доступ к adult/private событиям.
- Создавать поручение без assignee.
- Создавать событие с `end_at < start_at`.
- Отправлять уведомление пользователю, который не имеет права видеть item.
- Загружать все occurrences за все годы на экран календаря.
- Держать realtime subscriptions после ухода со страницы.
- Использовать случайные цвета, не совпадающие с design tokens.
- Делать UI только под desktop.
- Делать UI слишком корпоративным.

---

## 17. Документация и изменения

Если меняется архитектура, обновить:

- `TECHNICAL_SPEC.md`, если решение меняет требования;
- `README.md`, если меняется запуск;
- `docs/technical/data-model.md`, если меняется модель данных;
- `docs/product/user-flows.md`, если меняется UX flow.

Не оставлять важные решения только в коде.

---

## 18. Минимальный формат отчёта после задачи

В финальном сообщении указывать:

```txt
Сделано:
- ...

Проверки:
- pnpm check — passed / not run, причина
- pnpm test — passed / not run, причина
- pnpm build — passed / not run, причина

Заметки:
- ...
```

Если проверка не запускалась, честно указать причину.

---

## 19. Главный принцип

Всегда выбирать решение, которое лучше всего служит семье-пользователю:

```txt
быстро понять день → легко создать → спокойно выполнить → мягко подтвердить → ничего не потерять
```
