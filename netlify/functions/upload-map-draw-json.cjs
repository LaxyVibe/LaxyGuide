const { cert, getApp, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');

const ALLOWED_GUIDE_ID = 'JPN-USAA-TEM-001';
const BUCKET_NAME = 'laxy-guide-dev.firebasestorage.app';
const OBJECT_PATH = 'maps/JPN-USAA-TEM-001-map-draw.json';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

function normalizePrivateKey(rawKey) {
  return String(rawKey || '')
    .replace(/^"|"$/g, '')
    .replace(/\\n/g, '\n');
}

function getAllowedEmails(rawValue) {
  return new Set(
    String(rawValue || '')
      .split(/[,\n]/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

function extractBearerToken(headers = {}) {
  const value = headers.authorization || headers.Authorization || '';
  const match = String(value).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function getFirebaseAdminApp(env = process.env) {
  const projectId = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = normalizePrivateKey(env.GOOGLE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase admin environment variables are not configured');
  }

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey
    }),
    storageBucket: BUCKET_NAME
  });
}

function createRuntime(env = process.env) {
  const app = getFirebaseAdminApp(env);
  const auth = getAuth(app);
  const bucket = getStorage(app).bucket(BUCKET_NAME);

  return {
    verifyIdToken: (idToken) => auth.verifyIdToken(idToken),
    saveObject: async (payload) => {
      const file = bucket.file(OBJECT_PATH);
      await file.save(JSON.stringify(payload, null, 2), {
        resumable: false,
        contentType: 'application/json',
        metadata: {
          cacheControl: 'no-store'
        }
      });
      return OBJECT_PATH;
    }
  };
}

function createHandler(options = {}) {
  const env = options.env || process.env;
  const runtimeFactory = options.runtimeFactory || createRuntime;

  return async (event) => {
    if (event.httpMethod !== 'POST') {
      return json(405, { error: 'Method Not Allowed' });
    }

    const bearerToken = extractBearerToken(event.headers);
    if (!bearerToken) {
      return json(401, { error: 'Missing bearer token' });
    }

    const allowedEmails = getAllowedEmails(env.MAP_DRAW_ADMIN_EMAILS);
    if (allowedEmails.size === 0) {
      return json(500, { error: 'MAP_DRAW_ADMIN_EMAILS is not configured' });
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'Invalid JSON body' });
    }

    if (body.guideId !== ALLOWED_GUIDE_ID) {
      return json(400, { error: `Only ${ALLOWED_GUIDE_ID} uploads are supported` });
    }

    if (!body.payload || typeof body.payload !== 'object') {
      return json(400, { error: 'payload is required' });
    }

    if (body.payload.guideId && body.payload.guideId !== ALLOWED_GUIDE_ID) {
      return json(400, { error: 'payload.guideId must match the supported guide' });
    }

    try {
      const runtime = runtimeFactory(env);
      const decodedToken = await runtime.verifyIdToken(bearerToken);
      const email = String(decodedToken.email || '').trim().toLowerCase();

      if (!email || !allowedEmails.has(email)) {
        return json(403, { error: 'User is not allowed to upload map draw JSON' });
      }

      const path = await runtime.saveObject(body.payload);
      return json(200, { ok: true, path });
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      if (/token/i.test(message)) {
        return json(401, { error: 'Invalid bearer token' });
      }
      return json(500, { error: message || 'Failed to upload map draw JSON' });
    }
  };
}

exports.ALLOWED_GUIDE_ID = ALLOWED_GUIDE_ID;
exports.OBJECT_PATH = OBJECT_PATH;
exports.createHandler = createHandler;
exports.handler = createHandler();
