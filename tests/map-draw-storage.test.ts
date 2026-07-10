import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getEnabledGuides, isGuideEnabled } = require('../netlify/functions/map-draw-storage.cjs');

test('map draw storage enables both built-in authoring guides when env is unset', () => {
    const enabledGuides = getEnabledGuides('');
    assert.equal(enabledGuides.has('JPN-USAA-TEM-001'), true);
    assert.equal(enabledGuides.has('JPN-BEPU-MUS-001'), true);
    assert.equal(isGuideEnabled('JPN-BEPU-MUS-001', ''), true);
    assert.equal(isGuideEnabled('JPN-OITA-MUS-003', ''), false);
});
