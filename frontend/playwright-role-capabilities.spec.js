import { test, expect } from '@playwright/test';
import { roleFixtures } from './tests/roleFixtures';

const baseUrl = 'http://127.0.0.1:4173/';

test('role-capabilities: startup sees feature visibility panel and guide matrix', async ({ page }) => {
  const startup = roleFixtures.startup;
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(startup.email);
  await page.getByLabel('Password').fill(startup.password);
  await page.locator('form').getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('What You Can Do')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.feature-capability-card')).toHaveCount(6);

  await page.getByRole('link', { name: 'Feature Guide' }).click();
  await expect(page.getByRole('heading', { name: 'Feature Guide' })).toBeVisible();
  await expect(page.getByText('Current Role', { exact: true })).toBeVisible();
});

test('role-capabilities: organisation admin sees governance routes', async ({ page }) => {
  const admin = roleFixtures.organisation_admin;
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(admin.email);
  await page.getByLabel('Password').fill(admin.password);
  await page.locator('form').getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('link', { name: 'Recommendations' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Outcomes' })).toBeVisible();
});
