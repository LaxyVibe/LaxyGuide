import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const MAIN_TSX_PATH = resolve(process.cwd(), 'src/main.tsx');

function extractGaMeasurementId(source) {
  const initializeCall = source.match(/ReactGA\.initialize\(\s*['\"]([^'\"]+)['\"]\s*\)/);
  return initializeCall ? initializeCall[1] : null;
}

test('GA measurement ID is configured and not a placeholder', async () => {
  const source = await readFile(MAIN_TSX_PATH, 'utf8');
  const measurementId = extractGaMeasurementId(source);

  assert.ok(measurementId, 'ReactGA.initialize(...) must exist in src/main.tsx');
  assert.match(measurementId, /^G-[A-Z0-9]{8,}$/, 'GA measurement ID must match GA4 format');

  const blockedValues = new Set([
    'G-XXXXXXXXXX',
    'G-XXXXX',
    'GA_MEASUREMENT_ID_NOT_SET'
  ]);
  assert.ok(!blockedValues.has(measurementId), `GA measurement ID must not be a placeholder: ${measurementId}`);
});
