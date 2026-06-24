const {
  createRuntime,
  extractBearerToken,
  getAllowedEmails,
  getObjectPath,
  isGuideEnabled,
  json
} = require('./map-draw-storage.cjs');

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

    const guideId = String(body.guideId || '').trim();
    if (!guideId) {
      return json(400, { error: 'guideId is required' });
    }

    if (!isGuideEnabled(guideId, env.MAP_DRAW_ENABLED_GUIDES)) {
      return json(400, { error: `Guide ${guideId} is not enabled for map authoring` });
    }

    if (!body.payload || typeof body.payload !== 'object') {
      return json(400, { error: 'payload is required' });
    }

    if (body.payload.guideId && body.payload.guideId !== guideId) {
      return json(400, { error: 'payload.guideId must match guideId' });
    }

    try {
      const runtime = runtimeFactory(env);
      const decodedToken = await runtime.verifyIdToken(bearerToken);
      const email = String(decodedToken.email || '').trim().toLowerCase();

      if (!email || !allowedEmails.has(email)) {
        return json(403, { error: 'User is not allowed to upload map draw JSON' });
      }

      const path = await runtime.saveObject(guideId, body.payload);
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

exports.OBJECT_PATH = getObjectPath;
exports.createHandler = createHandler;
exports.handler = createHandler();
