import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveResetViewTarget } from '../src/utils/mapResetView.ts';

test('resolveResetViewTarget prefers the current location when present', () => {
    const target = resolveResetViewTarget({
        currentLocationPoint: { x: 0.2, y: 0.8 },
        fallbackPoint: { x: 0.5, y: 0.5 },
        resetLevel: 3
    });

    assert.deepEqual(target, {
        point: { x: 0.2, y: 0.8 },
        level: 3
    });
});

test('resolveResetViewTarget falls back to the default center when no current location exists', () => {
    const target = resolveResetViewTarget({
        currentLocationPoint: null,
        fallbackPoint: { x: 0.5, y: 0.5 },
        resetLevel: 1
    });

    assert.deepEqual(target, {
        point: { x: 0.5, y: 0.5 },
        level: 1
    });
});
