import { test, expect } from '@playwright/test';
import { roleFixtures } from './tests/roleFixtures';

const baseUrl = 'http://127.0.0.1:4173/';

test('permission-deny: startup cannot access settings route', async ({ page }) => {
  const startup = roleFixtures.startup;
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(startup.email);
  await page.getByLabel('Password').fill(startup.password);
  await page.locator('form').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('link', { name: 'Settings' })).toHaveCount(0);
});

test('permission-deny: contributor cannot access matches route', async ({ page }) => {
  const mentor = roleFixtures.mentor;
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(mentor.email);
  await page.getByLabel('Password').fill(mentor.password);
  await page.locator('form').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('link', { name: 'Recommendations' })).toHaveCount(0);
});
