const {
  createRuntime,
  getGuideIdFromEvent,
  isGuideEnabled,
  json
} = require('./map-draw-storage.cjs');

function createHandler(options = {}) {
  const env = options.env || process.env;
  const runtimeFactory = options.runtimeFactory || createRuntime;

  return async (event) => {
    if (event.httpMethod !== 'GET') {
      return json(405, { error: 'Method Not Allowed' });
    }

    const guideId = getGuideIdFromEvent(event);
    if (!guideId) {
      return json(400, { error: 'guideId is required' });
    }

    if (!isGuideEnabled(guideId, env.MAP_DRAW_ENABLED_GUIDES)) {
      return json(400, { error: `Guide ${guideId} is not enabled for map authoring` });
    }

    try {
      const runtime = runtimeFactory(env);
      const payload = await runtime.readObject(guideId);
      if (!payload) {
        return json(404, { error: `Map authoring JSON not found for ${guideId}` });
      }

      return json(200, payload);
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      return json(500, { error: message || 'Failed to read map draw JSON' });
    }
  };
}

exports.createHandler = createHandler;
exports.handler = createHandler();
