import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createHandler, OBJECT_PATH } = require('../netlify/functions/upload-map-draw-json.cjs');

function createEvent(overrides: Partial<{
    httpMethod: string;
    headers: Record<string, string>;
    body: string;
}> = {}) {
    return {
        httpMethod: 'POST',
        headers: {
            authorization: 'Bearer valid-token'
        },
        body: JSON.stringify({
            guideId: 'JPN-USAA-TEM-001',
            payload: { version: 3, guideId: 'JPN-USAA-TEM-001' }
        }),
        ...overrides
    };
}

const env = {
    MAP_DRAW_ADMIN_EMAILS: 'admin@example.com'
};

test('upload handler returns 401 when bearer token is missing', async () => {
    const handler = createHandler({
        env,
        runtimeFactory: () => {
            throw new Error('runtime should not be created');
        }
    });

    const response = await handler(createEvent({ headers: {} }));
    assert.equal(response.statusCode, 401);
    assert.match(response.body, /Missing bearer token/);
});

test('upload handler returns 401 when token verification fails', async () => {
    const handler = createHandler({
        env,
        runtimeFactory: () => ({
            verifyIdToken: async () => {
                throw new Error('invalid token');
            },
            saveObject: async () => OBJECT_PATH
        })
    });

    const response = await handler(createEvent());
    assert.equal(response.statusCode, 401);
    assert.match(response.body, /Invalid bearer token/);
});

test('upload handler returns 403 for non-allowlisted users', async () => {
    const handler = createHandler({
        env,
        runtimeFactory: () => ({
            verifyIdToken: async () => ({ email: 'viewer@example.com' }),
            saveObject: async () => OBJECT_PATH
        })
    });

    const response = await handler(createEvent());
    assert.equal(response.statusCode, 403);
    assert.match(response.body, /not allowed/i);
});

test('upload handler returns 400 for unsupported guide ids', async () => {
    const handler = createHandler({
        env,
        runtimeFactory: () => ({
            verifyIdToken: async () => ({ email: 'admin@example.com' }),
            saveObject: async () => OBJECT_PATH
        })
    });

    const response = await handler(createEvent({
        body: JSON.stringify({
            guideId: 'JPN-OITA-MUS-003',
            payload: { version: 3, guideId: 'JPN-OITA-MUS-003' }
        })
    }));

    assert.equal(response.statusCode, 400);
    assert.match(response.body, /Only JPN-USAA-TEM-001 uploads are supported/);
});

test('upload handler writes the fixed Storage object for valid USAA uploads', async () => {
    let savedPayload: unknown = null;

    const handler = createHandler({
        env,
        runtimeFactory: () => ({
            verifyIdToken: async () => ({ email: 'admin@example.com' }),
            saveObject: async (payload: unknown) => {
                savedPayload = payload;
                return OBJECT_PATH;
            }
        })
    });

    const response = await handler(createEvent({
        body: JSON.stringify({
            guideId: 'JPN-USAA-TEM-001',
            payload: {
                version: 3,
                guideId: 'JPN-USAA-TEM-001',
                pins: []
            }
        })
    }));

    assert.equal(response.statusCode, 200);
    assert.deepEqual(savedPayload, {
        version: 3,
        guideId: 'JPN-USAA-TEM-001',
        pins: []
    });
    assert.match(response.body, new RegExp(OBJECT_PATH));
});
