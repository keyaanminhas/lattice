import { test, expect } from '@playwright/test';

test('local app signs into live Firebase with a provisioned organisation account', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });

  await page.getByLabel('Email').fill('org.cradle-fund.org-1@lattice.demo');
  await page.getByLabel('Password').fill('Lattice2026!org-1');
  await page.locator('form').getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Cradle Fund')).toBeVisible({ timeout: 20000 });
  await expect(page.getByPlaceholder('Search startups, programmes, or contributors...')).toBeVisible({ timeout: 20000 });

  await page.screenshot({ path: 'playwright-live-login-success.png', fullPage: true });
});
