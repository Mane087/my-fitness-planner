import { expect, test } from '@playwright/test';

test.describe('Home page', () => {
  test('shows the hero heading', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Plan Your Cycling Training' }),
    ).toBeVisible();
  });

  test('redirects to profile setup when there is no active profile', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Go to Training Calendar' }).click();

    await expect(page).toHaveURL(/\/profile$/);
  });
});
