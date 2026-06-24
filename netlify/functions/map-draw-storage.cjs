const crypto = require('node:crypto');
const { GoogleAuth } = require('google-auth-library');

const DEFAULT_ENABLED_GUIDE_ID = 'JPN-USAA-TEM-001';
const DEFAULT_BUCKET_NAME = 'laxy-guide-dev.firebasestorage.app';
const FIREBASE_X509_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const STORAGE_SCOPE = 'https://www.googleapis.com/auth/devstorage.read_write';

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

function getEnabledGuides(rawValue) {
  const guides = String(rawValue || '')
    .split(/[,\n]/)
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  return new Set(guides.length > 0 ? guides : [DEFAULT_ENABLED_GUIDE_ID]);
}

function isGuideEnabled(guideId, rawValue) {
  if (!guideId) return false;
  return getEnabledGuides(rawValue).has(String(guideId).trim().toUpperCase());
}

function extractBearerToken(headers = {}) {
  const value = headers.authorization || headers.Authorization || '';
  const match = String(value).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function getGuideIdFromEvent(event = {}) {
  return String(event.queryStringParameters?.guideId || '').trim();
}

function getBucketName(env = process.env) {
  return env.FIREBASE_STORAGE_BUCKET || env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_BUCKET_NAME;
}

function getObjectPath(guideId) {
  return `maps/${String(guideId).trim()}-map-authoring.json`;
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

  if (!certificate || protectedHeader.alg !== 'RS256') {
    throw new Error('Invalid bearer token');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  const signature = Buffer.from(encodedSignature, 'base64url');
  if (!verifier.verify(certificate, signature)) {
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

async function getAccessToken(credentials) {
  const auth = new GoogleAuth({
    credentials: {
      client_email: credentials.clientEmail,
      private_key: credentials.privateKey
    },
    scopes: [STORAGE_SCOPE]
  });

  const client = await auth.getClient();
  const accessTokenResponse = await client.getAccessToken();
  const accessToken = typeof accessTokenResponse === 'string'
    ? accessTokenResponse
    : accessTokenResponse?.token;

  if (!accessToken) {
    throw new Error('Failed to obtain Google Cloud access token');
  }

  return accessToken;
}

function createRuntime(env = process.env) {
  const credentials = getServiceAccountCredentials(env);
  const bucketName = getBucketName(env);

  return {
    verifyIdToken: (idToken) => verifyFirebaseIdToken(idToken, credentials.projectId),
    saveObject: async (guideId, payload) => {
      const accessToken = await getAccessToken(credentials);
      const objectPath = getObjectPath(guideId);
      const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucketName)}/o?uploadType=media&name=${encodeURIComponent(objectPath)}`;
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

      return objectPath;
    },
    readObject: async (guideId) => {
      const accessToken = await getAccessToken(credentials);
      const objectPath = getObjectPath(guideId);
      const downloadUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(objectPath)}?alt=media`;
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Cache-Control': 'no-store'
        }
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Storage read failed (${response.status})${errorText ? `: ${errorText}` : ''}`);
      }

      return response.json();
    }
  };
}

module.exports = {
  DEFAULT_ENABLED_GUIDE_ID,
  createRuntime,
  extractBearerToken,
  getAllowedEmails,
  getEnabledGuides,
  getGuideIdFromEvent,
  getObjectPath,
  isGuideEnabled,
  json
};
