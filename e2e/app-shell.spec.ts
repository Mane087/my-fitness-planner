import { expect, test, type Page } from '@playwright/test';

async function widthOf(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((element) => element.getBoundingClientRect().width);
}

test.describe('App shell layouts', () => {
  test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('shows the 232 px sidebar with the week summary outside the calendar', async ({
      page,
    }) => {
      await page.goto('/library');

      expect(await widthOf(page, 'aside')).toBe(232);
      const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
      await expect(navigation.getByRole('link', { name: 'Biblioteca' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(page.getByTestId('sidebar-week-summary')).toBeVisible();
      await expect(page.getByText('Esta semana')).toBeVisible();
    });

    test('collapses to a 72 px icon rail on the calendar and keeps accessible names', async ({
      page,
    }) => {
      await page.goto('/calendar');

      expect(await widthOf(page, 'aside')).toBe(72);
      await expect(page.getByTestId('sidebar-week-summary')).toHaveCount(0);
      const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
      await expect(navigation.getByRole('link', { name: 'Calendario' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(navigation.getByRole('link', { name: 'Perfil y zonas' })).toBeVisible();
    });

    test('goes back to the sidebar when leaving the calendar', async ({ page }) => {
      await page.goto('/calendar');
      await page
        .getByRole('navigation', { name: 'Navegación principal' })
        .getByRole('link', { name: 'Perfil y zonas' })
        .click();

      await expect(page).toHaveURL(/\/profile$/);
      expect(await widthOf(page, 'aside')).toBe(232);
    });

    test('shows a visible focus ring on keyboard navigation', async ({ page }) => {
      await page.goto('/library');
      const link = page
        .getByRole('navigation', { name: 'Navegación principal' })
        .getByRole('link', { name: 'Calendario' });

      await link.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');

      await expect(link).toBeFocused();
      const boxShadow = await link.evaluate((element) => getComputedStyle(element).boxShadow);
      expect(boxShadow).not.toBe('none');
    });
  });

  test.describe('phone', () => {
    test.use({ viewport: { width: 320, height: 640 } });

    test('uses a bottom navigation without horizontal scroll', async ({ page }) => {
      for (const path of ['/library', '/profile', '/calendar']) {
        await page.goto(path);

        const box = await page.locator('aside').boundingBox();
        expect(box?.width).toBe(320);
        expect((box?.y ?? 0) + (box?.height ?? 0)).toBeCloseTo(640, 0);
        await expect(page.getByTestId('sidebar-week-summary')).toBeHidden();
        const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
        await expect(navigation.getByRole('link')).toHaveCount(3);

        const widths = await page.evaluate(() => ({
          content: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
        }));
        expect(widths.content).toBeLessThanOrEqual(widths.viewport);
      }
    });

    test('navigates with the bottom bar', async ({ page }) => {
      await page.goto('/library');
      await page
        .getByRole('navigation', { name: 'Navegación principal' })
        .getByRole('link', { name: 'Perfil y zonas' })
        .click();

      await expect(page).toHaveURL(/\/profile$/);
    });
  });
});
