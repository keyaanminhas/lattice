import { test, expect } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:4173/';

const scenarios = [
  {
    name: 'organisation admin',
    email: 'org.asean-founders-network.org-2@lattice.demo',
    password: 'Lattice2026!org-2',
    expectedRole: 'Organisation Admin',
    shouldSeeSettings: true,
  },
  {
    name: 'startup',
    email: 'startup.eduleap.comp-3@lattice.demo',
    password: 'Lattice2026!comp-3',
    expectedRole: 'Startup',
    shouldSeeSettings: false,
  },
  {
    name: 'mentor',
    email: 'contrib.farid-iskandar.cont-20@lattice.demo',
    password: 'Lattice2026!cont-20',
    expectedRole: 'Mentor',
    shouldSeeSettings: false,
  },
  {
    name: 'partner',
    email: 'contrib.google-cloud-malaysia.cont-2@lattice.demo',
    password: 'Lattice2026!cont-2',
    expectedRole: 'Partner',
    shouldSeeSettings: false,
  },
  {
    name: 'investor',
    email: 'contrib.seedfund-my.cont-5@lattice.demo',
    password: 'Lattice2026!cont-5',
    expectedRole: 'Investor',
    shouldSeeSettings: false,
  },
  {
    name: 'service provider',
    email: 'contrib.legalpro-my.cont-4@lattice.demo',
    password: 'Lattice2026!cont-4',
    expectedRole: 'Service Provider',
    shouldSeeSettings: false,
  },
];

for (const scenario of scenarios) {
  test(`live login flow: ${scenario.name}`, async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByLabel('Email').fill(scenario.email);
    await page.getByLabel('Password').fill(scenario.password);
    await page.locator('form').getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByPlaceholder('Search startups, programmes, or contributors...')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.sidebar-user-info .role')).toHaveText(scenario.expectedRole, { timeout: 20000 });

    const settingsLink = page.locator('a.sidebar-nav-link', { hasText: 'Settings' });
    if (scenario.shouldSeeSettings) {
      await expect(settingsLink).toBeVisible();
    } else {
      await expect(settingsLink).toHaveCount(0);
    }
  });
}
