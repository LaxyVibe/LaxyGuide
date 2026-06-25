import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    createHandler,
    getFirebaseWebConfig
} = require('../netlify/functions/firebase-web-config.cjs');

test('firebase web config handler returns 405 for non-GET requests', async () => {
    const handler = createHandler();
    const response = await handler({ httpMethod: 'POST' });

    assert.equal(response.statusCode, 405);
    assert.match(response.body, /Method Not Allowed/);
});

test('firebase web config prefers explicit environment overrides', async () => {
    const config = getFirebaseWebConfig({
        VITE_FIREBASE_API_KEY: 'override-key',
        VITE_FIREBASE_AUTH_DOMAIN: 'override.firebaseapp.com',
        FIREBASE_PROJECT_ID: 'override-project',
        FIREBASE_STORAGE_BUCKET: 'override.firebasestorage.app',
        VITE_FIREBASE_MESSAGING_SENDER_ID: '123456',
        VITE_FIREBASE_APP_ID: 'app-id'
    });

    assert.deepEqual(config, {
        apiKey: 'override-key',
        authDomain: 'override.firebaseapp.com',
        projectId: 'override-project',
        storageBucket: 'override.firebasestorage.app',
        messagingSenderId: '123456',
        appId: 'app-id'
    });
});
