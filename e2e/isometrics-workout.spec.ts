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

test.describe('Isometrics workout', () => {
  test.beforeEach(async ({ page }) => {
    await configureProfile(page);
  });

  test('plans a per-side hold and a circuit and shows the time under tension', async ({ page }) => {
    await page.goto('/calendar/new?date=2026-10-07');
    await page.locator('#workout-title').fill('Core isométrico');
    await page.getByTitle('Deporte').click();
    await page.getByRole('listitem').filter({ hasText: 'Isometría' }).click();
    await expect(page.getByLabel('Métrica de intensidad *')).toHaveValue('rpe');
    await page.getByLabel('Categoría *').selectOption({ label: 'Fuerza' });

    await page.getByRole('button', { name: 'Agregar ejercicio' }).click();
    const sidePlank = stepGroup(page, 'Paso 1 · Ejercicio');
    await sidePlank.getByLabel('Ejercicio *').fill('Plancha lateral');
    await sidePlank.getByLabel('Series *').fill('3');
    await sidePlank.getByRole('radio', { name: 'Tiempo de sostén' }).click();
    await sidePlank.getByLabel('Tiempo de sostén (s) *').fill('30');
    await sidePlank.getByRole('radio', { name: 'Por lado' }).click();
    // 3 sets × 30 s × 2 sides = 3 min under tension
    await expect(sidePlank.getByTestId('exercise-hold-time')).toContainText('3 min');
    await sidePlank.getByLabel('Descanso (s)').fill('20');

    // 3 × (30 s × 2 sides + 20 s) = 4 min
    await expect(page.getByTestId('workout-totals')).toHaveText('4 min');

    await page.getByRole('button', { name: 'Agregar repetición' }).click();
    const circuit = stepGroup(page, 'Paso 2 · Repetición');
    await circuit.getByRole('button', { name: '+ Ejercicio en la repetición' }).click();
    await circuit.getByRole('button', { name: 'Eliminar paso 2.1' }).click();
    const plank = stepGroup(circuit, 'Paso 2.1 · Ejercicio');
    await plank.getByLabel('Ejercicio *').fill('Plancha frontal');
    await plank.getByLabel('Series *').fill('1');
    await plank.getByRole('radio', { name: 'Tiempo de sostén' }).click();
    await plank.getByLabel('Tiempo de sostén (s) *').fill('40');
    await expect(plank.getByTestId('exercise-hold-time')).toContainText('40 s');
    await plank.getByLabel('Descanso (s)').fill('10');
    await circuit.getByRole('spinbutton', { name: /^Repetir/ }).fill('2');

    // + 2 × (40 s + 10 s) = 100 s; 80 s more under tension
    await expect(page.getByTestId('workout-totals')).toHaveText('6 min');
    await expect(page.getByRole('region', { name: 'Resumen del entrenamiento' })).toContainText(
      '0:04:20',
    );

    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page).toHaveURL(/\/calendar\?.*saved=created/);
    await page.getByRole('radio', { name: 'Semana' }).click();
    await expect(page.getByText('2 ejercicios · 4 min 20 s bajo tensión')).toBeVisible();

    await page.getByRole('button', { name: /Core isométrico/ }).click();
    await page
      .getByRole('dialog', { name: 'Core isométrico' })
      .getByRole('button', { name: 'Editar' })
      .click();

    const reopened = stepGroup(page, 'Paso 1 · Ejercicio');
    await expect(reopened.getByLabel('Tiempo de sostén (s) *')).toHaveValue('30');
    await expect(reopened.getByRole('radio', { name: 'Por lado' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(
      stepGroup(stepGroup(page, 'Paso 2 · Repetición'), 'Paso 2.1 · Ejercicio').getByLabel(
        'Tiempo de sostén (s) *',
      ),
    ).toHaveValue('40');
  });
});
