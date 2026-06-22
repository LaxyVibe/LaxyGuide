const crypto = require('node:crypto');
const { GoogleAuth } = require('google-auth-library');

const ALLOWED_GUIDE_ID = 'JPN-USAA-TEM-001';
const BUCKET_NAME = 'laxy-guide-dev.firebasestorage.app';
const OBJECT_PATH = 'maps/JPN-USAA-TEM-001-map-draw.json';
const FIREBASE_X509_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const STORAGE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/devstorage.read_write';

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

function getServiceAccountCredentials(env = process.env) {
  const projectId = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = normalizePrivateKey(env.GOOGLE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase admin environment variables are not configured');
  }

  return {
    projectId,
    clientEmail,
    privateKey
  };
}

async function verifyFirebaseIdToken(idToken, projectId) {
  const certsResponse = await fetch(FIREBASE_X509_URL, { method: 'GET', cache: 'no-store' });

  if (!certsResponse.ok) {
    throw new Error(`Failed to fetch Firebase signing certs (${certsResponse.status})`);
  }

  const certs = await certsResponse.json();
  const segments = String(idToken || '').split('.');
  if (segments.length !== 3) {
    throw new Error('Invalid bearer token');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const protectedHeader = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  const certificate = certs?.[protectedHeader.kid];

  if (!certificate) {
    throw new Error('Invalid bearer token');
  }

  if (protectedHeader.alg !== 'RS256') {
    throw new Error('Invalid bearer token');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  const signature = Buffer.from(encodedSignature, 'base64url');
  const isValidSignature = verifier.verify(certificate, signature);
  if (!isValidSignature) {
    throw new Error('Invalid bearer token');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) {
    throw new Error('Invalid bearer token');
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Invalid bearer token');
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('Invalid bearer token');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
    throw new Error('Invalid bearer token');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSeconds + 300) {
    throw new Error('Invalid bearer token');
  }

  return payload;
}

function createRuntime(env = process.env) {
  const credentials = getServiceAccountCredentials(env);

  return {
    verifyIdToken: (idToken) => verifyFirebaseIdToken(idToken, credentials.projectId),
    saveObject: async (payload) => {
      const auth = new GoogleAuth({
        credentials: {
          client_email: credentials.clientEmail,
          private_key: credentials.privateKey
        },
        scopes: [STORAGE_UPLOAD_SCOPE]
      });

      const client = await auth.getClient();
      const accessTokenResponse = await client.getAccessToken();
      const accessToken = typeof accessTokenResponse === 'string'
        ? accessTokenResponse
        : accessTokenResponse?.token;

      if (!accessToken) {
        throw new Error('Failed to obtain Google Cloud access token');
      }

      const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(BUCKET_NAME)}/o?uploadType=media&name=${encodeURIComponent(OBJECT_PATH)}`;
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        },
        body: JSON.stringify(payload, null, 2)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Storage upload failed (${response.status})${errorText ? `: ${errorText}` : ''}`);
      }

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
