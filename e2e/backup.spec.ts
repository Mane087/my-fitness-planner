import { expect, test, type Page } from '@playwright/test';

async function saveProfileName(page: Page, name: string): Promise<void> {
  const nameInput = page.getByLabel('Usuario');
  await nameInput.fill(name);
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Perfil guardado correctamente.')).toBeVisible();
}

test.describe('Backup', () => {
  test('restores the exported data after it changed', async ({ page }, testInfo) => {
    await page.goto('/profile');
    await saveProfileName(page, 'Ana respaldo');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar respaldo' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^my-fitness-planner-backup-\d{4}-\d{2}-\d{2}\.json$/,
    );
    const backupPath = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(backupPath);

    await saveProfileName(page, 'Nombre cambiado');

    await page.getByTestId('backup-file-input').setInputFiles(backupPath);
    const dialog = page.getByRole('dialog', { name: '¿Reemplazar todos tus datos?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Importar y reemplazar' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Respaldo importado' })).toBeVisible();
    await expect(page.getByLabel('Usuario')).toHaveValue('Ana respaldo');
  });

  test('rejects a file that is not a backup and keeps the data', async ({ page }) => {
    await page.goto('/profile');
    await saveProfileName(page, 'Datos intactos');

    await page.getByTestId('backup-file-input').setInputFiles({
      name: 'otro.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ hello: 'world' })),
    });
    await page.getByRole('button', { name: 'Importar y reemplazar' }).click();

    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'El archivo no es un respaldo de MyFitnessPlanner.' }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Usuario')).toHaveValue('Datos intactos');
  });
});
