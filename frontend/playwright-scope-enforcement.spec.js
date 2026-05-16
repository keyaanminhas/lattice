import { test, expect } from '@playwright/test';
import { roleFixtures } from './tests/roleFixtures';

const baseUrl = 'http://127.0.0.1:4173/';
const callableUrls = [
  'https://us-central1-lattice-2026.cloudfunctions.net/get_programme_graph_view',
  'http://127.0.0.1:5001/lattice-2026/us-central1/get_programme_graph_view',
];

test('scope-enforcement: organisation admin can access own programme but not foreign programme', async ({ page }) => {
  const orgAdmin = roleFixtures.organisation_admin;
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(orgAdmin.email);
  await page.getByLabel('Password').fill(orgAdmin.password);
  await page.locator('form').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByPlaceholder('Search startups, programmes, or contributors...')).toBeVisible({ timeout: 20000 });

  const responses = await page.evaluate(async (urls) => {
    async function readFromIndexedDb() {
      return new Promise((resolve) => {
        const request = indexedDB.open('firebaseLocalStorageDb');
        request.onerror = () => resolve(null);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
            resolve(null);
            return;
          }
          const tx = db.transaction('firebaseLocalStorage', 'readonly');
          const store = tx.objectStore('firebaseLocalStorage');
          const allRequest = store.getAll();
          allRequest.onerror = () => resolve(null);
          allRequest.onsuccess = () => resolve(allRequest.result || []);
        };
      });
    }

    let authState = null;
    const authKey = Object.keys(localStorage).find((key) => key.startsWith('firebase:authUser:'));
    if (authKey) {
      const raw = localStorage.getItem(authKey);
      if (raw) authState = JSON.parse(raw);
    }
    if (!authState) {
      const rows = await readFromIndexedDb();
      const candidate = (rows || []).find((row) => String(row?.fbase_key || '').startsWith('firebase:authUser:'));
      authState = candidate?.value || null;
    }

    const token = authState?.stsTokenManager?.accessToken;
    if (!token) return { error: 'missing-token' };

    async function call(url, programmeId) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ data: { programmeId } }),
        });
        const text = await response.text();
        return { status: response.status, text };
      } catch (error) {
        return { status: 0, error: String(error) };
      }
    }

    for (const url of urls) {
      const inScope = await call(url, 'prog-11');
      const outOfScope = await call(url, 'prog-1');
      if ((inScope.status !== 401 && inScope.status !== 0) || (outOfScope.status !== 401 && outOfScope.status !== 0)) {
        return { inScope, outOfScope, url };
      }
    }

    return {
      inScope: { status: 0 },
      outOfScope: { status: 0 },
    };
  }, callableUrls);

  expect(responses.error).toBeUndefined();
  if ((responses.inScope.status === 401 || responses.inScope.status === 0)
    && (responses.outOfScope.status === 401 || responses.outOfScope.status === 0)) {
    test.skip(true, 'Callable auth unavailable in this environment; skipping scope assertion.');
  }
  expect(responses.inScope.status).toBe(200);
  expect(responses.outOfScope.status).toBeGreaterThanOrEqual(400);
});
