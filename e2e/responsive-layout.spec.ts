import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
}

test.describe('Phone layout', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('pages fit the phone width and the month grid scrolls inside its box', async ({ page }) => {
    await page.goto('/profile');
    await page.getByLabel('Usuario').fill('Atleta móvil');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Perfil guardado correctamente.')).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.goto('/calendar?date=2026-09-29');
    await expect(page.getByTestId('weekly-summary')).toBeVisible();
    await expectNoHorizontalScroll(page);
    const grid = page.getByTestId('calendar-grid-scroll');
    const gridWidths = await grid.evaluate((box) => ({
      content: box.scrollWidth,
      visible: box.clientWidth,
    }));
    expect(gridWidths.content).toBeGreaterThan(gridWidths.visible);

    await page.goto('/calendar/new?date=2026-09-29');
    await expect(page.getByRole('button', { name: 'Agregar intervalo' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
