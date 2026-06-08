import { describe, expect, it } from 'vitest';

import { createShellViewModel } from './app-shell';

describe('createShellViewModel', () => {
  it('shows a calm unavailable-backend message while PocketBase is not connected', () => {
    const model = createShellViewModel({ apiAvailable: false });

    expect(model.status).toBe('offline-shell');
    expect(model.title).toBe('Семейный Пульс');
    expect(model.message).toBe('Каркас приложения готов. Данные семьи появятся после подключения PocketBase.');
    expect(model.primaryRoute).toBe('/app/today');
  });

  it('keeps the primary MVP navigation ordered for mobile bottom navigation', () => {
    const model = createShellViewModel({ apiAvailable: true });

    expect(model.navigation.map((item) => item.label)).toEqual([
      'Сегодня',
      'Календарь',
      'Поручения',
      'Семья'
    ]);
  });
});
