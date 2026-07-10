const crypto = require('node:crypto');
const { GoogleAuth } = require('google-auth-library');

const DEFAULT_ENABLED_GUIDE_IDS = ['JPN-USAA-TEM-001', 'JPN-BEPU-MUS-001'];
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

  return new Set(guides.length > 0 ? guides : DEFAULT_ENABLED_GUIDE_IDS);
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

function encodeStorageObjectPath(objectPath) {
  return String(objectPath || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function buildPublicObjectUrl(bucketName, objectPath) {
  return `https://storage.googleapis.com/${encodeURIComponent(bucketName)}/${encodeStorageObjectPath(objectPath)}`;
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

function createMultipartUploadBody({ objectPath, mediaBuffer, mediaType, cacheControl, metadata }) {
  const boundary = `laxyguide-${crypto.randomUUID()}`;
  const objectMetadata = {
    name: objectPath,
    contentType: mediaType
  };

  if (cacheControl) {
    objectMetadata.cacheControl = cacheControl;
  }

  if (metadata && Object.keys(metadata).length > 0) {
    objectMetadata.metadata = metadata;
  }

  const preamble = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(objectMetadata),
    `--${boundary}`,
    `Content-Type: ${mediaType}`,
    '',
    ''
  ].join('\r\n');

  const epilogue = `\r\n--${boundary}--`;

  return {
    body: Buffer.concat([
      Buffer.from(preamble, 'utf8'),
      mediaBuffer,
      Buffer.from(epilogue, 'utf8')
    ]),
    boundary
  };
}

async function uploadObject({ accessToken, bucketName, objectPath, mediaBuffer, contentType, cacheControl, metadata }) {
  const { body, boundary } = createMultipartUploadBody({
    objectPath,
    mediaBuffer,
    mediaType: contentType,
    cacheControl,
    metadata
  });

  const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucketName)}/o?uploadType=multipart`;
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Cache-Control': 'no-store'
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Storage upload failed (${response.status})${errorText ? `: ${errorText}` : ''}`);
  }

  return response.json();
}

async function getObjectMetadata({ accessToken, bucketName, objectPath }) {
  const metadataUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucketName)}/o/${encodeStorageObjectPath(objectPath)}`;
  const response = await fetch(metadataUrl, {
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
    throw new Error(`Storage metadata read failed (${response.status})${errorText ? `: ${errorText}` : ''}`);
  }

  return response.json();
}

async function readJsonObject({ accessToken, bucketName, objectPath }) {
  const downloadUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucketName)}/o/${encodeStorageObjectPath(objectPath)}?alt=media`;
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

function createStorageAdminRuntime(env = process.env) {
  const credentials = getServiceAccountCredentials(env);
  const bucketName = getBucketName(env);

  const runtime = {
    bucketName,
    verifyIdToken: (idToken) => verifyFirebaseIdToken(idToken, credentials.projectId),
    uploadObject: async (objectPath, content, options = {}) => {
      const accessToken = await getAccessToken(credentials);
      const mediaBuffer = Buffer.isBuffer(content)
        ? content
        : Buffer.from(typeof content === 'string' ? content : JSON.stringify(content), 'utf8');

      const metadata = await uploadObject({
        accessToken,
        bucketName,
        objectPath,
        mediaBuffer,
        contentType: options.contentType || 'application/octet-stream',
        cacheControl: options.cacheControl,
        metadata: options.metadata
      });

      return {
        metadata,
        objectPath,
        publicUrl: buildPublicObjectUrl(bucketName, objectPath)
      };
    },
    uploadJsonObject: async (objectPath, payload, options = {}) => {
      return runtime.uploadObject(objectPath, JSON.stringify(payload, null, 2), {
        ...options,
        contentType: options.contentType || 'application/json; charset=utf-8'
      });
    },
    getObjectMetadata: async (objectPath) => {
      const accessToken = await getAccessToken(credentials);
      return getObjectMetadata({
        accessToken,
        bucketName,
        objectPath
      });
    },
    readJsonObject: async (objectPath) => {
      const accessToken = await getAccessToken(credentials);
      return readJsonObject({
        accessToken,
        bucketName,
        objectPath
      });
    }
  };

  return runtime;
}

function createRuntime(env = process.env) {
  const storageRuntime = createStorageAdminRuntime(env);
  const uploadObjectWrapper = storageRuntime;

  return {
    verifyIdToken: storageRuntime.verifyIdToken,
    saveObject: async (guideId, payload) => {
      const objectPath = getObjectPath(guideId);
      await uploadObjectWrapper.uploadJsonObject(objectPath, payload, {
        cacheControl: 'no-store'
      });
      return objectPath;
    },
    readObject: async (guideId) => {
      return storageRuntime.readJsonObject(getObjectPath(guideId));
    }
  };
}

module.exports = {
  DEFAULT_BUCKET_NAME,
  DEFAULT_ENABLED_GUIDE_IDS,
  buildPublicObjectUrl,
  createRuntime,
  createStorageAdminRuntime,
  extractBearerToken,
  getAllowedEmails,
  getBucketName,
  getEnabledGuides,
  getGuideIdFromEvent,
  getObjectPath,
  isGuideEnabled,
  json
};
