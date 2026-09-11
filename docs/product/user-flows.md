# Product User Flows

## Семья и профили

1. Первый взрослый регистрируется через `/register`: создаются auth user, семья и owner member.
2. В «Семье» добавляются профили. Добавление ребёнка не переключает родителя на новый профиль.
3. Детский профиль получает ответственного взрослого через `managed_by`.
4. Для второго взрослого создаётся профиль и приглашение. При регистрации по приглашению не создаётся лишняя семья.
5. Имя профиля, цвет и день рождения можно изменить. Данные аккаунта и пароль редактируются отдельно в «Профиле».
6. Родитель открывает детский режим из «Семьи» или выбирает доступного ребёнка на `/child`. Это представление управляемого профиля, а не отдельная авторизация.

## Поиск и запись

- Поиск в шапке desktop и быстрый доступ на mobile ведут на `/app/search`.
- Поиск учитывает активную семью и серверные права участника; фильтры: события, дела, поручения.
- Результат открывает `/app/items/[id]`: участники, дата, место, видимость и описание.
- Автор или владелец с серверными правами может изменить название, описание и место.
- Результаты загружаются страницами; старые ответы после смены контекста игнорируются.

## Создание и черновики

- Событие или задача создаются из Today, а дело или поручение также из своего списка.
- Задача для другого участника становится поручением. Родитель вправе отметить поручение ребёнка выполненным.
- Если подтверждение не требуется, `done` означает завершение. Если требуется, запись ждёт проверки.
- Закрытие формы и Escape сохраняют черновик в текущей вкладке отдельно для семьи и участника.
- «Удалить черновик» удаляет его явно; успешное создание очищает черновик.
- При сохранении форма не закрывается и повторный submit заблокирован. Ошибка обновления списка после успешного create не вызывает повторное создание.

## Assignment flow

```txt
parent creates assignment for child
child sees assignment
child marks done
parent receives notification
parent approves
assignment becomes approved
activity feed receives records
```

Manual acceptance:

- Parent can create assignment only with assignee.
- Child sees simplified labels: `Надо сделать`, `Я сделал`, `Ждёт проверки`, `Готово`.
- If approval is required, child completion creates parent notification.
- Approval changes occurrence status and writes activity feed record.

## Event flow

```txt
member creates event with participants
participants see event in Today and Calendar
activity feed records creation
notification is created for participants
```

Manual acceptance:

- `end_at < start_at` is rejected on client and server.
- Empty participants default to creator.
- Calendar loads event through `item_occurrences` range query.

## Special date flow

```txt
adult opens Calendar year overview
adult creates a special date or external birthday
date is saved as a yearly or one-time day annotation
Calendar shows the marker in every matching year
Today shows it as all-day information for the selected day/week/month
adult can edit or delete the annotation later
```

Manual acceptance:

- External birthday can be created with name and date only.
- Relation/status, contact/phone and note are optional.
- Yearly special dates are stored once and appear in future years.
- Special dates do not appear as tasks, assignments or timed events.
- Public holidays are read-only and come from cached provider sync.

## Recurring schedule flow

- Взрослый создаёт событие для графика работы, секции или занятия.
- Выбирает повтор: ежедневно, по будням, выбранные дни недели или ежемесячно,
  интервал и при необходимости последний день. Время вводится в часовом поясе семьи.
- В Today и Calendar появляются отдельные даты; у событий нет выполнения и approval.
- В подробностях записи можно перенести отдельную дату и время. Остальные даты
  серии и её правило остаются неизменными; повторная загрузка не создаёт дубликат.
- Архив скрывает серию из расписания, сохраняя историю. Поиск с флажком «Архив»
  позволяет открыть запись и вернуть её. Для смены всего правила пока создаётся
  новая серия вместо архивированной.
- Повторяющиеся дела и поручения, в отличие от событий, имеют отдельный статус
  каждого экземпляра. Родитель может выполнить поручение за ребёнка; подтверждение
  остаётся отдельным действием, если оно требуется.

## Visibility acceptance

```txt
private item is not visible to unrelated family member
adults item is not visible to child
family item is visible to active family members
assignees item is visible to assignee and creator
```

Manual acceptance:

- Family isolation is enforced by PocketBase rules and hooks.
- Client filters are convenience only, not security boundary.
