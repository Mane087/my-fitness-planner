import { expect, test, type Page } from '@playwright/test';

async function configureProfile(page: Page): Promise<void> {
  await page.goto('/profile');
  await page.getByLabel('Usuario').fill('Atleta biblioteca');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Perfil guardado correctamente.')).toBeVisible();
}

async function fillSingleInterval(page: Page, title: string, minutes: string): Promise<void> {
  await page.locator('#workout-title').fill(title);
  await page.getByRole('button', { name: 'Agregar intervalo' }).click();
  const step = page.getByRole('group', { name: 'Paso 1 · Intervalo', exact: true });
  await step.getByLabel('Nombre *').fill('Bloque principal');
  await step.getByLabel('Minutos').fill(minutes);
}

test.describe('Template library', () => {
  test.beforeEach(async ({ page }) => {
    await configureProfile(page);
  });

  test('creates a template, schedules it and opens it from the calendar', async ({ page }) => {
    await page.goto('/library');
    await expect(page.getByRole('heading', { name: 'Todavía no tienes plantillas' })).toBeVisible();
    await page.getByRole('link', { name: 'Crear la primera plantilla' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Crear plantilla' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar como plantilla' })).toHaveCount(0);
    await fillSingleInterval(page, 'Umbral 3x10', '45');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();

    await expect(page).toHaveURL(/\/library\?saved=created/);
    await expect(page.getByRole('status')).toHaveText('Plantilla guardada correctamente.');
    const card = page.getByRole('article', { name: 'Umbral 3x10' });
    await expect(card).toContainText('45 min');

    await card.getByRole('button', { name: 'Programar Umbral 3x10' }).click();
    const dialog = page.getByRole('dialog', { name: 'Programar "Umbral 3x10"' });
    await dialog.getByLabel('Fecha').fill('2025-04-08');
    await dialog.getByRole('button', { name: 'Programar', exact: true }).click();

    await expect(page).toHaveURL(/\/calendar\?date=2025-04-08&saved=scheduled/);
    await expect(page.getByRole('status').first()).toHaveText(
      'Plantilla programada correctamente.',
    );
    await page.getByRole('button', { name: 'Umbral 3x10, Planeado' }).click();
    await page
      .getByRole('dialog', { name: 'Umbral 3x10' })
      .getByRole('button', { name: 'Editar' })
      .click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Editar entrenamiento' }),
    ).toBeVisible();
    await expect(page.locator('#workout-title')).toHaveValue('Umbral 3x10');
  });

  test('saves a workout as a template, filters it and archives it', async ({ page }) => {
    await page.goto('/calendar/new?date=2025-04-09');
    await fillSingleInterval(page, 'Rodada de base', '90');
    await page.getByRole('button', { name: 'Guardar como plantilla' }).click();
    await expect(page.getByRole('status')).toContainText(
      'Se guardó la plantilla "Rodada de base".',
    );
    // Saving as a template does not save the workout.
    await expect(page).toHaveURL(/\/calendar\/new/);

    await page.goto('/library');
    const card = page.getByRole('article', { name: 'Rodada de base' });
    await expect(card).toContainText('1 h 30 min');

    await page.getByLabel('Deporte').selectOption({ label: 'Running' });
    await expect(page.getByText('No hay plantillas con estos filtros.')).toBeVisible();
    await page.getByLabel('Deporte').selectOption({ label: 'Todos' });
    await expect(card).toBeVisible();

    await card.getByRole('button', { name: 'Archivar Rodada de base' }).click();
    await expect(page.getByRole('status')).toContainText('Se archivó "Rodada de base".');
    await expect(card).toHaveCount(0);

    await page.getByLabel('Mostrar archivadas').check();
    await expect(card).toContainText('Archivada');
    await expect(card.getByRole('button', { name: 'Programar Rodada de base' })).toHaveCount(0);
    await card.getByRole('button', { name: 'Restaurar Rodada de base' }).click();
    await expect(card.getByRole('button', { name: 'Programar Rodada de base' })).toBeVisible();
  });
});
