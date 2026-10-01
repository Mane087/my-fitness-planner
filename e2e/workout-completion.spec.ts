import { expect, test, type Page } from '@playwright/test';

// A date in the past, so completing it does not ask for confirmation.
const WORKOUT_DATE = '2025-03-04';

async function createWorkout(page: Page, title: string): Promise<void> {
  await page.goto('/profile');
  await page.getByLabel('Usuario').fill('Atleta registro');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Perfil guardado correctamente.')).toBeVisible();

  await page.goto(`/calendar/new?date=${WORKOUT_DATE}`);
  await page.locator('#workout-title').fill(title);
  await page.getByRole('button', { name: 'Agregar intervalo' }).click();
  const step = page.getByRole('group', { name: 'Paso 1 · Intervalo', exact: true });
  await step.getByLabel('Nombre *').fill('Fondo');
  await step.getByLabel('Minutos').fill('60');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page).toHaveURL(/\/calendar\?.*saved=created/);
}

test.describe('Workout completion', () => {
  test('completes a workout, shows the actual totals and reopens it', async ({ page }) => {
    await createWorkout(page, 'Rodada de fondo');
    const summary = page.getByTestId('weekly-summary');
    const total = summary.getByTestId('summary-total');
    await expect(summary).toContainText('3 mar al 9 mar');
    await expect(total).toContainText('0 de 1');
    await expect(total).toContainText('1 h');

    await page.getByRole('button', { name: /Rodada de fondo/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Rodada de fondo' });
    await expect(dialog.getByTestId('workout-status')).toHaveText('Planeado');
    await dialog.getByRole('button', { name: 'Completar' }).click();
    await expect(dialog.getByLabel('Duración real (min)')).toHaveValue('60');
    await dialog.getByLabel('Duración real (min)').fill('50');
    await dialog.getByLabel('Distancia real (km)').fill('25');
    await dialog.getByLabel('RPE (1-10)').fill('7');
    await dialog.getByRole('radio', { name: '4' }).check({ force: true });
    await dialog.getByLabel('Notas').fill('Viento en contra');
    await dialog.getByRole('button', { name: 'Guardar registro' }).click();

    await expect(dialog.getByTestId('workout-status')).toHaveText('Completado');
    await expect(dialog.getByTestId('workout-actual')).toHaveText('50 min · 25 km');
    await expect(dialog).toContainText('Viento en contra');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    const card = page.getByRole('button', { name: 'Rodada de fondo, Completado' });
    await expect(card).toContainText('Tiempo: 50 min de 1 h');
    // The workout has no planned distance, so the card shows only the actual one.
    await expect(card).toContainText('Distancia: 25 km');
    await expect(total).toContainText('1 de 1');
    await expect(total).toContainText('50 min');
    await expect(total).toContainText('83 %');
    await expect(summary.getByTestId('summary-cycling')).toContainText('83 %');

    await card.click();
    await dialog.getByRole('button', { name: 'Reabrir' }).click();
    await expect(dialog.getByTestId('workout-status')).toHaveText('Planeado');
    await expect(total).toContainText('0 de 1');
  });

  test('skips a workout and counts it as planned but not done', async ({ page }) => {
    await createWorkout(page, 'Rodaje omitido');

    await page.getByRole('button', { name: /Rodaje omitido/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Rodaje omitido' });
    await dialog.getByRole('button', { name: 'Omitir' }).click();
    await expect(dialog.getByTestId('workout-status')).toHaveText('Omitido');
    // A click outside the dialog closes it.
    await page.getByTestId('modal-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(dialog).toBeHidden();

    await expect(page.getByRole('button', { name: 'Rodaje omitido, Omitido' })).toBeVisible();
    await expect(page.getByTestId('summary-total')).toContainText('0 %');
  });
});
