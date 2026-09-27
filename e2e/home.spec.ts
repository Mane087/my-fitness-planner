import { expect, test } from '@playwright/test';

test.describe('Home page', () => {
  test('shows the hero heading in Spanish', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Planifica tus entrenamientos' }),
    ).toBeVisible();
  });

  test('sends a first-time user to the profile setup', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Ir al calendario' }).click();

    await expect(page).toHaveURL(/\/profile$/);
  });
});

test.describe('App shell', () => {
  test('navigates between the main sections', async ({ page }) => {
    await page.goto('/');
    const navigation = page.getByRole('navigation', { name: 'Navegación principal' });

    await navigation.getByRole('link', { name: 'Biblioteca' }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Biblioteca de entrenamientos' }),
    ).toBeVisible();

    await navigation.getByRole('link', { name: 'Calendario' }).click();
    await expect(page).toHaveURL(/\/calendar$/);
    await expect(navigation.getByRole('link', { name: 'Calendario' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
