import { expect, test, type Locator, type Page } from '@playwright/test';

async function configureProfile(page: Page): Promise<void> {
  await page.goto('/profile');
  await page.getByLabel('Usuario').fill('Atleta e2e');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Perfil guardado correctamente.')).toBeVisible();
}

function stepGroup(page: Page | Locator, name: string): Locator {
  return page.getByRole('group', { name, exact: true });
}

async function openSavedWorkout(page: Page, title: string): Promise<void> {
  await expect(page).toHaveURL(/\/calendar\?.*saved=created/);
  await page.getByRole('button', { name: new RegExp(title) }).click();
  await page.getByRole('dialog', { name: title }).getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Editar entrenamiento' })).toBeVisible();
}

test.describe('Structured step editor', () => {
  test.beforeEach(async ({ page }) => {
    await configureProfile(page);
  });

  test('creates a cycling workout with a repeat group and reopens it', async ({ page }) => {
    await page.goto('/calendar/new?date=2026-10-05');
    await page.locator('#workout-title').fill('Intervalos de umbral');

    await page.getByRole('button', { name: 'Agregar intervalo' }).click();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Paso 1: El nombre del paso es requerido.' }),
    ).toBeVisible();

    const warmUp = stepGroup(page, 'Paso 1 · Intervalo');
    await warmUp.getByLabel('Nombre *').fill('Calentamiento');
    await warmUp.getByLabel('Fase').selectOption({ label: 'Calentamiento' });
    await warmUp.getByLabel('Minutos').fill('15');
    await warmUp.getByLabel('Zona').selectOption({ index: 1 });

    await page.getByRole('button', { name: 'Agregar repetición' }).click();
    const group = stepGroup(page, 'Paso 2 · Repetición');
    await group.getByRole('spinbutton', { name: /^Repetir/ }).fill('4');

    const work = stepGroup(group, 'Paso 2.1 · Intervalo');
    await work.getByLabel('Nombre *').fill('Trabajo');
    await work.getByLabel('Minutos').fill('5');
    await work.getByLabel('Zona').selectOption({ index: 4 });

    await group.getByRole('button', { name: '+ Intervalo en la repetición' }).click();
    const recovery = stepGroup(group, 'Paso 2.2 · Intervalo');
    await recovery.getByLabel('Nombre *').fill('Recuperación');
    await recovery.getByLabel('Fase').selectOption({ label: 'Recuperación' });
    await recovery.getByLabel('Minutos').fill('2');

    // 15 min + 4 × (5 min + 2 min)
    await expect(page.getByTestId('workout-totals')).toHaveText('43 min');
    await expect(page.getByTestId('steps-summary')).toContainText('3 pasos · 43 min');

    await page.getByRole('button', { name: 'Guardar' }).click();
    await openSavedWorkout(page, 'Intervalos de umbral');

    await expect(page.locator('#workout-title')).toHaveValue('Intervalos de umbral');
    await expect(page.getByTestId('workout-totals')).toHaveText('43 min');
    const reopenedGroup = stepGroup(page, 'Paso 2 · Repetición');
    await expect(reopenedGroup.getByRole('spinbutton', { name: /^Repetir/ })).toHaveValue('4');
    await expect(
      stepGroup(reopenedGroup, 'Paso 2.2 · Intervalo').getByLabel('Nombre *'),
    ).toHaveValue('Recuperación');
    await expect(stepGroup(page, 'Paso 1 · Intervalo').getByLabel('Minutos')).toHaveValue('15');
  });

  test('creates a plyometrics workout with exercises and an estimate', async ({ page }) => {
    await page.goto('/calendar/new?date=2026-10-06');
    await page.locator('#workout-title').fill('Saltos pliométricos');
    await page.getByTitle('Deporte').click();
    await page.getByRole('listitem').filter({ hasText: 'Pliometría' }).click();
    await expect(page.getByLabel('Métrica de intensidad *')).toHaveValue('rpe');

    await page.getByRole('button', { name: 'Agregar ejercicio' }).click();
    const boxJumps = stepGroup(page, 'Paso 1 · Ejercicio');
    await boxJumps.getByLabel('Ejercicio *').fill('Saltos al cajón');
    await boxJumps.getByLabel('Series *').fill('4');
    await boxJumps.getByLabel('Repeticiones *').fill('6');
    await boxJumps.getByLabel('Descanso (s)').fill('90');
    await boxJumps.getByLabel('RPE (1-10)').fill('8');

    await page.getByRole('button', { name: 'Agregar repetición' }).click();
    const group = stepGroup(page, 'Paso 2 · Repetición');
    await group.getByRole('button', { name: '+ Ejercicio en la repetición' }).click();
    await group.getByRole('button', { name: 'Eliminar paso 2.1' }).click();
    const squatJumps = stepGroup(group, 'Paso 2.1 · Ejercicio');
    await squatJumps.getByLabel('Ejercicio *').fill('Sentadilla con salto');
    await group.getByRole('spinbutton', { name: /^Repetir/ }).fill('3');

    await page.getByLabel('Duración estimada (min)').fill('30');
    await expect(page.getByTestId('workout-totals')).toHaveText('30 min (estimado)');

    await page.getByRole('button', { name: 'Guardar' }).click();
    await openSavedWorkout(page, 'Saltos pliométricos');

    await expect(page.getByLabel('Duración estimada (min)')).toHaveValue('30');
    await expect(stepGroup(page, 'Paso 1 · Ejercicio').getByLabel('Ejercicio *')).toHaveValue(
      'Saltos al cajón',
    );
    await expect(stepGroup(page, 'Paso 1 · Ejercicio').getByLabel('RPE (1-10)')).toHaveValue('8');
    const reopenedGroup = stepGroup(page, 'Paso 2 · Repetición');
    await expect(reopenedGroup.getByRole('spinbutton', { name: /^Repetir/ })).toHaveValue('3');
    await expect(
      stepGroup(reopenedGroup, 'Paso 2.1 · Ejercicio').getByLabel('Ejercicio *'),
    ).toHaveValue('Sentadilla con salto');
  });
});
