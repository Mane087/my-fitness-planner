import { expect, test, type Page } from '@playwright/test';

async function configureProfile(page: Page): Promise<void> {
  await page.goto('/profile');
  await page.getByLabel('Usuario').fill('Atleta zonas');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Perfil guardado correctamente.')).toBeVisible();
}

test.describe('Zone sets per sport and metric', () => {
  test('configures FTP and threshold pace and offers the zones in the step editor', async ({
    page,
  }) => {
    await configureProfile(page);

    const power = page.getByRole('region', { name: 'Ciclismo · Potencia' });
    await power.getByLabel('FTP (W)').fill('250');
    await power.getByRole('button', { name: 'Crear zonas' }).click();
    await expect(power.getByRole('status')).toHaveText('Zonas creadas.');
    await expect(power.getByLabel('Desde zona 4 (W)')).toHaveValue('225');

    await power.getByLabel('FTP (W)').fill('260');
    await power.getByRole('button', { name: 'Recalcular desde la referencia' }).click();
    const dialog = page.getByRole('dialog', {
      name: '¿Recalcular las zonas de Ciclismo · Potencia?',
    });
    await dialog.getByRole('button', { name: 'Recalcular zonas' }).click();
    await expect(power.getByRole('status')).toHaveText('Zonas recalculadas.');
    await expect(power.getByLabel('Desde zona 4 (W)')).toHaveValue('234');

    const pace = page.getByRole('region', { name: 'Running · Ritmo' });
    await pace.getByLabel('Ritmo umbral (min/km)').fill('4:30');
    await pace.getByRole('button', { name: 'Crear zonas' }).click();
    await expect(pace.getByRole('status')).toHaveText('Zonas creadas.');
    await expect(pace.getByLabel('Desde zona 4 (min/km)')).toHaveValue('4:46');
    await expect(pace.getByLabel('Hasta zona 4 (min/km)')).toHaveValue('4:27');

    await page.goto('/calendar/new?date=2026-10-07');
    await page.getByLabel('Métrica de intensidad *').selectOption({ label: 'Potencia' });
    await page.getByRole('button', { name: 'Agregar intervalo' }).click();
    const step = page.getByRole('group', { name: 'Paso 1 · Intervalo', exact: true });
    await expect(step.getByLabel('Zona').locator('option')).toContainText([
      'Sin zona',
      'Z1 Recuperación activa (0-143 W)',
      'Z2 Resistencia (143-195 W)',
      'Z3 Tempo (195-234 W)',
      'Z4 Umbral (234-273 W)',
    ]);

    await page.getByTitle('Deporte').click();
    await page.getByRole('listitem').filter({ hasText: 'Running' }).click();
    await page.getByLabel('Métrica de intensidad *').selectOption({ label: 'Ritmo' });
    await expect(step.getByLabel('Zona').locator('option')).toContainText([
      'Sin zona',
      'Z1 Trote suave (5:48-7:12 /km)',
      'Z2 Resistencia (5:08-5:48 /km)',
      'Z3 Tempo (4:46-5:08 /km)',
      'Z4 Umbral (4:27-4:46 /km)',
      'Z5 Intervalos (3:36-4:27 /km)',
    ]);
  });
});
