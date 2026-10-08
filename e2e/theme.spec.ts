import { expect, test, type Page } from '@playwright/test';

const DATABASE_NAME = 'cycling_training_planner_db';

async function expectTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

async function readCanvasColor(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

async function saveThemeInSettings(page: Page, theme: string): Promise<void> {
  await page.evaluate(
    ({ databaseName, value }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(databaseName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          const transaction = database.transaction('app_settings', 'readwrite');
          const store = transaction.objectStore('app_settings');
          const read = store.getAll();
          read.onsuccess = () => {
            for (const settings of read.result) {
              store.put({ ...settings, theme: value });
            }
          };
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    { databaseName: DATABASE_NAME, value: theme },
  );
}

test.describe('Theme', () => {
  test('follows the system scheme by default', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expectTheme(page, 'dark');
    const darkCanvas = await readCanvasColor(page);

    await page.emulateMedia({ colorScheme: 'light' });
    await expectTheme(page, 'light');
    expect(await readCanvasColor(page)).not.toBe(darkCanvas);
  });

  test('keeps the saved preference over the system scheme after a reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expectTheme(page, 'light');

    await saveThemeInSettings(page, 'dark');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expectTheme(page, 'dark');
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('theme-preference')))
      .toBe('dark');
  });

  test('applies the stored explicit theme before the app starts', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(() => localStorage.setItem('theme-preference', 'dark'));
    await page.route('**/main.js', (route) => route.abort());

    await page.goto('/');

    await expectTheme(page, 'dark');
  });

  test('serves Inter from the app itself, without external font requests', async ({ page }) => {
    const externalRequests: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith('http://localhost:4200')) {
        externalRequests.push(request.url());
      }
    });
    const interResponse = page.waitForResponse((response) => /inter.*\.woff2/.test(response.url()));

    await page.goto('/');

    expect((await interResponse).status()).toBe(200);
    expect(externalRequests).toEqual([]);
  });
});
