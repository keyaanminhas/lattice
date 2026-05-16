import { test, expect } from '@playwright/test';
import { roleFixtures } from './tests/roleFixtures';

const baseUrl = 'http://127.0.0.1:4173/';

for (const [roleKey, fixture] of Object.entries(roleFixtures)) {
  test(`auth-and-routing: ${roleKey} lands in role-specific workspace`, async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByLabel('Email').fill(fixture.email);
    await page.getByLabel('Password').fill(fixture.password);
    await page.locator('form').getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByPlaceholder('Search startups, programmes, or contributors...')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.sidebar-user-info .role')).toHaveText(fixture.roleLabel, { timeout: 20000 });
    await expect(page.getByRole('link', { name: 'Feature Guide' })).toBeVisible();
  });
}

