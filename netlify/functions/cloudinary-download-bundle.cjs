function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

function sha1Hex(input) {
  return require('crypto').createHash('sha1').update(input).digest('hex');
}

function signParams(params, apiSecret) {
  const payload = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return sha1Hex(`${payload}${apiSecret}`);
}

function extractPublicIdFromDeliveryUrl(rawUrl, cloudName) {
  const parsed = new URL(rawUrl);
  if (parsed.hostname !== 'res.cloudinary.com') return null;

  const prefix = `/${cloudName}/raw/upload/`;
  if (!parsed.pathname.startsWith(prefix)) return null;

  let tail = parsed.pathname.slice(prefix.length);
  // Remove optional version segment: v<digits>/...
  tail = tail.replace(/^v\d+\//, '');
  if (!tail) return null;

  return tail;
}

function buildSignedDownloadUrls(rawUrl, cloudName, apiKey, apiSecret) {
  let publicId = null;
  try {
    publicId = extractPublicIdFromDeliveryUrl(rawUrl, cloudName);
  } catch {
    publicId = null;
  }
  if (!publicId) return [];

  const now = Math.floor(Date.now() / 1000);
  const base = `https://api.cloudinary.com/v1_1/${cloudName}/raw/download`;

  const variants = [];

  // Variant 1: public_id exactly as delivered path tail (legacy may include .zip)
  variants.push({ public_id: publicId, timestamp: now, attachment: true });

  // Variant 2: if .zip suffix exists, split into public_id + format
  if (publicId.endsWith('.zip')) {
    variants.push({
      public_id: publicId.slice(0, -4),
      format: 'zip',
      timestamp: now,
      attachment: true
    });
  }

  return variants.map((params) => {
    const signature = signParams(params, apiSecret);
    const query = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ),
      api_key: apiKey,
      signature
    });
    return `${base}?${query.toString()}`;
  });
}

function tryBuildCandidateUrls(rawUrl, cloudName, apiKey, apiSecret) {
  const list = [];
  list.push(rawUrl);

  if (rawUrl.includes('/raw/upload/')) {
    list.push(rawUrl.replace('/raw/upload/', '/raw/upload/fl_attachment/'));
  }

  if (rawUrl.endsWith('/bundle.zip')) {
    const noZip = rawUrl.slice(0, -4);
    list.push(noZip);
    if (noZip.includes('/raw/upload/')) {
      list.push(noZip.replace('/raw/upload/', '/raw/upload/fl_attachment/'));
    }
  }

  // Ensure unique and constrained to the expected cloud hostname/path.
  const unique = Array.from(new Set(list));
  const filtered = unique.filter((u) => {
    try {
      const parsed = new URL(u);
      if (parsed.hostname !== 'res.cloudinary.com') return false;
      return parsed.pathname.startsWith(`/${cloudName}/raw/upload/`);
    } catch {
      return false;
    }
  });

  // Add signed Cloudinary download API URLs as authenticated fallbacks.
  const signed = buildSignedDownloadUrls(rawUrl, cloudName, apiKey, apiSecret);
  return [...filtered, ...signed];
}

async function fetchWithOptionalAuth(url, basicAuth) {
  const unauth = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (unauth.ok) return unauth;

  // Some Cloudinary delivery policies require auth; try again with Basic auth.
  const auth = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Basic ${basicAuth}`
    }
  });
  return auth;
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

    const rawUrl = String(event.queryStringParameters?.url || '').trim();
    if (!rawUrl) {
      return json(400, { error: 'url is required' });
    }

    const candidateUrls = tryBuildCandidateUrls(rawUrl, cloudName, apiKey, apiSecret);
    if (candidateUrls.length === 0) {
      return json(400, { error: 'Invalid Cloudinary bundle URL' });
    }

    const basicAuth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const attempts = [];

    for (const candidate of candidateUrls) {
      const resp = await fetchWithOptionalAuth(candidate, basicAuth);
      attempts.push({ url: candidate, status: resp.status });
      if (!resp.ok) continue;

      const ab = await resp.arrayBuffer();
      const contentType = resp.headers.get('content-type') || 'application/octet-stream';

      return {
        statusCode: 200,
        isBase64Encoded: true,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': 'attachment; filename="bundle.zip"',
          'Cache-Control': 'no-store'
        },
        body: toBase64(ab)
      };
    }

    return json(502, {
      error: 'Failed to download bundle from Cloudinary',
      attempts
    });
  } catch (error) {
    return json(500, { error: error.message || 'Failed to proxy bundle download' });
  }
};