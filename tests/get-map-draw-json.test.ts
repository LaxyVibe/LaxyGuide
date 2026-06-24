import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createHandler } = require('../netlify/functions/get-map-draw-json.cjs');

function createEvent(overrides: Partial<{
    httpMethod: string;
    queryStringParameters: Record<string, string>;
}> = {}) {
    return {
        httpMethod: 'GET',
        queryStringParameters: {
            guideId: 'JPN-USAA-TEM-001'
        },
        ...overrides
    };
}

const env = {
    MAP_DRAW_ENABLED_GUIDES: 'JPN-USAA-TEM-001'
};

test('get handler returns 400 when guideId is missing', async () => {
    const handler = createHandler({
        env,
        runtimeFactory: () => {
            throw new Error('runtime should not be created');
        }
    });

    const response = await handler(createEvent({ queryStringParameters: {} }));
    assert.equal(response.statusCode, 400);
    assert.match(response.body, /guideId is required/);
});

test('get handler returns 400 for unsupported guide ids', async () => {
    const handler = createHandler({
        env,
        runtimeFactory: () => {
            throw new Error('runtime should not be created');
        }
    });

    const response = await handler(createEvent({
        queryStringParameters: { guideId: 'JPN-OITA-MUS-003' }
    }));
    assert.equal(response.statusCode, 400);
    assert.match(response.body, /not enabled for map authoring/);
});

test('get handler returns 404 when object is missing', async () => {
    const handler = createHandler({
        env,
        runtimeFactory: () => ({
            readObject: async () => null
        })
    });

    const response = await handler(createEvent());
    assert.equal(response.statusCode, 404);
    assert.match(response.body, /not found/);
});

test('get handler returns stored authoring JSON for enabled guides', async () => {
    const handler = createHandler({
        env,
        runtimeFactory: () => ({
            readObject: async (guideId: string) => ({
                version: 1,
                guideId,
                updatedAt: '2026-06-24T00:00:00.000Z',
                calibration: null,
                pins: [],
                traversableRegions: []
            })
        })
    });

    const response = await handler(createEvent());
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
        version: 1,
        guideId: 'JPN-USAA-TEM-001',
        updatedAt: '2026-06-24T00:00:00.000Z',
        calibration: null,
        pins: [],
        traversableRegions: []
    });
});
