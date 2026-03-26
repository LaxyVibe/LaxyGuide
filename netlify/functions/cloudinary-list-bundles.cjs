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

function parseBundle(resource) {
  const publicId = String(resource.public_id || '');
  const parts = publicId.split('/');
  // Expected format:
  // capture-bundles/<guideId>/<saveName>/<isoTimestamp>/bundle.zip
  if (parts.length < 5) return null;

  const saveName = parts[2] || '';
  const createdAt = parts[3] || '';

  return {
    publicId,
    secureUrl: resource.secure_url,
    bytes: resource.bytes,
    createdAt,
    saveName,
    format: resource.format || 'zip'
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method Not Allowed' });
  }

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dui2mxeuh';
    const apiKey = process.env.CLOUDINARY_API_KEY || '314786376781459';
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return json(500, { error: 'Cloudinary environment variables are not configured' });
    }

    const guideId = sanitizePathSegment(event.queryStringParameters?.guideId);
    if (!guideId) {
      return json(400, { error: 'guideId is required' });
    }

    const prefix = `${BASE_FOLDER}/${guideId}/`;
    const query = new URLSearchParams({
      type: 'upload',
      prefix,
      max_results: '100'
    });

    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/raw?${query.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`
      }
    });

    if (!resp.ok) {
      const text = await resp.text();
      return json(resp.status, { error: `Cloudinary list failed: ${text}` });
    }

    const data = await resp.json();
    const resources = Array.isArray(data.resources) ? data.resources : [];

    const bundles = resources
      .filter((r) => typeof r?.public_id === 'string' && r.public_id.endsWith('/bundle.zip'))
      .map(parseBundle)
      .filter(Boolean)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    return json(200, { bundles });
  } catch (error) {
    return json(500, { error: error.message || 'Failed to list bundles' });
  }
};
