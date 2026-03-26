const crypto = require('crypto');

const BASE_FOLDER = 'capture-bundles';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

function sanitizePathSegment(raw) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function signParams(params, apiSecret) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto
    .createHash('sha1')
    .update(`${payload}${apiSecret}`)
    .digest('hex');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dui2mxeuh';
    const apiKey = process.env.CLOUDINARY_API_KEY || '314786376781459';
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return json(500, { error: 'Cloudinary environment variables are not configured' });
    }

    const body = JSON.parse(event.body || '{}');
    const guideId = sanitizePathSegment(body.guideId);
    const saveName = sanitizePathSegment(body.saveName);

    if (!guideId || !saveName) {
      return json(400, { error: 'guideId and saveName are required' });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const isoNow = new Date().toISOString().replace(/[:.]/g, '-');
    // Use extensionless public_id for raw delivery. Some Cloudinary setups
    // restrict direct ZIP delivery by URL and can return 401 for *.zip paths.
    const publicId = `${BASE_FOLDER}/${guideId}/${saveName}/${isoNow}/bundle`;

    const paramsToSign = {
      public_id: publicId,
      timestamp
    };

    const signature = signParams(paramsToSign, apiSecret);

    return json(200, {
      cloudName,
      apiKey,
      timestamp,
      signature,
      publicId,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`
    });
  } catch (error) {
    return json(500, { error: error.message || 'Failed to prepare signed upload' });
  }
};
