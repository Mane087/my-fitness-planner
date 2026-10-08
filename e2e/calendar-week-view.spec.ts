import { expect, test, type Page } from '@playwright/test';

// A Tuesday in the past, so completing it does not ask for confirmation. Its week is 3–9 March.
const WORKOUT_DATE = '2025-03-04';

async function createWorkout(page: Page, title: string): Promise<void> {
  await page.goto('/profile');
  await page.getByLabel('Usuario').fill('Atleta semana');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Perfil guardado correctamente.')).toBeVisible();

  await page.goto(`/calendar/new?date=${WORKOUT_DATE}`);
  await page.locator('#workout-title').fill(title);
  await page.getByRole('button', { name: 'Agregar intervalo' }).click();
  const step = page.getByRole('group', { name: 'Paso 1 · Intervalo', exact: true });
  await step.getByLabel('Nombre *').fill('Fondo');
  await step.getByLabel('Minutos').fill('60');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page).toHaveURL(/\/calendar\?.*saved=created/);
}

async function openWeekView(page: Page): Promise<void> {
  await page.getByRole('radio', { name: 'Semana', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Semana', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('heading', { name: 'Semana 10', exact: true })).toBeVisible();
}

const day = (page: Page, date: string) => page.getByTestId(`week-day-${date}`);

test.describe('Calendar week view', () => {
  test('moves a workout by dragging it and copies it from the detail', async ({ page }) => {
    await createWorkout(page, 'Rodada de semana');
    await openWeekView(page);
    const planned = { name: 'Rodada de semana, Planeado' };
    await expect(day(page, WORKOUT_DATE)).toContainText(/Planeado\s*1 h/);

    await day(page, WORKOUT_DATE).getByRole('button', planned).dragTo(day(page, '2025-03-06'));
    await expect(page.getByRole('status')).toHaveText('Se movió "Rodada de semana" al 6 mar.');
    await expect(day(page, WORKOUT_DATE).getByRole('button', planned)).toHaveCount(0);
    await expect(day(page, '2025-03-06').getByRole('button', planned)).toBeVisible();

    await day(page, '2025-03-06').getByRole('button', planned).click();
    const dialog = page.getByRole('dialog', { name: 'Rodada de semana' });
    await dialog.getByRole('button', { name: 'Copiar a…' }).click();
    await dialog.getByLabel('Copiar al día').fill('2025-03-08');
    await dialog.getByRole('button', { name: 'Copiar', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Se copió "Rodada de semana" al 8 mar.');
    await expect(day(page, '2025-03-06').getByRole('button', planned)).toBeVisible();
    await expect(day(page, '2025-03-08').getByRole('button', planned)).toBeVisible();
    await expect(page.getByTestId('summary-total')).toContainText('0 de 2');

    // The chosen view is stored, and the month view shows the same workouts.
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Semana', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(day(page, '2025-03-08').getByRole('button', planned)).toBeVisible();
    await page.getByRole('radio', { name: 'Mes', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Marzo/ })).toBeVisible();
    await expect(page.getByRole('button', planned)).toHaveCount(2);
  });

  test('shows the profile of each workout and the week summary', async ({ page }) => {
    await createWorkout(page, 'Rodada con perfil');
    await openWeekView(page);

    const card = day(page, WORKOUT_DATE).getByRole('button', {
      name: 'Rodada con perfil, Planeado',
    });
    await expect(card.locator('app-workout-profile rect')).toHaveCount(1);
    await expect(card).toContainText('1:00');
    await expect(page.getByTestId('week-summary-duration')).toContainText('0:00');
    await expect(page.getByTestId('week-summary-duration')).toContainText('/ 1:00 h');
    await expect(page.getByTestId('week-summary-completed')).toContainText('/ 1');
    await expect(day(page, '2025-03-05')).toContainText('Descanso');
  });

  test('shows the drop zone while dragging a workout over another day', async ({ page }) => {
    await createWorkout(page, 'Rodada arrastrada');
    await openWeekView(page);

    const source = day(page, WORKOUT_DATE).getByRole('button', {
      name: 'Rodada arrastrada, Planeado',
    });
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await source.dispatchEvent('dragstart', { dataTransfer });
    await day(page, '2025-03-06').dispatchEvent('dragover', { dataTransfer });

    await expect(day(page, '2025-03-06')).toContainText('Soltar para mover');
    await expect(day(page, '2025-03-06')).toContainText('Mantén Alt para copiar');
  });

  test('asks before moving a completed workout', async ({ page }) => {
    await createWorkout(page, 'Series completadas');
    await openWeekView(page);

    await day(page, WORKOUT_DATE)
      .getByRole('button', { name: /Series completadas/ })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Series completadas' });
    await dialog.getByRole('button', { name: 'Completar' }).click();
    await dialog.getByRole('button', { name: 'Guardar registro' }).click();
    await expect(dialog.getByTestId('workout-status')).toHaveText('Completado');
    await page.keyboard.press('Escape');

    const completed = { name: 'Series completadas, Completado' };
    const confirmation = page.getByRole('dialog', { name: '¿Mover un entrenamiento completado?' });
    await day(page, WORKOUT_DATE).getByRole('button', completed).dragTo(day(page, '2025-03-05'));
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Cancelar' }).click();
    await expect(confirmation).toBeHidden();
    await expect(day(page, WORKOUT_DATE).getByRole('button', completed)).toBeVisible();

    await day(page, WORKOUT_DATE).getByRole('button', completed).dragTo(day(page, '2025-03-05'));
    await confirmation.getByRole('button', { name: 'Mover', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Se movió "Series completadas" al 5 mar.');
    await expect(day(page, '2025-03-05').getByRole('button', completed)).toBeVisible();
    await expect(day(page, WORKOUT_DATE).getByRole('button', completed)).toHaveCount(0);
  });
});
