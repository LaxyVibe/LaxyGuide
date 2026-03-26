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
  const crypto = require('crypto');
  return crypto.createHash('sha1').update(input).digest('hex');
}

function signParams(params, apiSecret) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return sha1Hex(`${payload}${apiSecret}`);
}

function parsePublicIdAndFormat(rawUrl, cloudName) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname !== 'res.cloudinary.com') return null;

    const basePrefix = `/${cloudName}/raw/upload/`;
    if (!parsed.pathname.startsWith(basePrefix)) return null;

    let tail = parsed.pathname.slice(basePrefix.length);
    if (tail.startsWith('fl_attachment/')) {
      tail = tail.slice('fl_attachment/'.length);
    }

    // Remove Cloudinary version segment when present.
    tail = tail.replace(/^v\d+\//, '');
    if (!tail) return null;

    const parts = tail.split('/').filter(Boolean);
    if (parts.length === 0) return null;

    const last = parts[parts.length - 1];
    const dot = last.lastIndexOf('.');
    let format = 'zip';
    if (dot > 0 && dot < last.length - 1) {
      format = last.slice(dot + 1);
      parts[parts.length - 1] = last.slice(0, dot);
    }

    return {
      publicId: parts.join('/'),
      format
    };
  } catch {
    return null;
  }
}

function buildSignedDownloadUrl(cloudName, apiKey, apiSecret, publicId, format) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    format,
    public_id: publicId,
    timestamp
  };
  const signature = signParams(params, apiSecret);
  const query = new URLSearchParams({
    ...params,
    api_key: apiKey,
    signature
  });
  return `https://api.cloudinary.com/v1_1/${cloudName}/raw/download?${query.toString()}`;
}

function tryBuildCandidateUrls(rawUrl, cloudName) {
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
  return unique.filter((u) => {
    try {
      const parsed = new URL(u);
      if (parsed.hostname !== 'res.cloudinary.com') return false;
      return parsed.pathname.startsWith(`/${cloudName}/raw/upload/`);
    } catch {
      return false;
    }
  });
}

async function fetchCandidate(url) {
  return fetch(url, { method: 'GET', cache: 'no-store' });
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

    const candidateUrls = tryBuildCandidateUrls(rawUrl, cloudName);
    if (candidateUrls.length === 0) {
      return json(400, { error: 'Invalid Cloudinary bundle URL' });
    }

    const parsed = parsePublicIdAndFormat(rawUrl, cloudName);
    if (!parsed) {
      return json(400, { error: 'Could not parse bundle public_id from URL' });
    }

    const signedDownloadUrl = buildSignedDownloadUrl(
      cloudName,
      apiKey,
      apiSecret,
      parsed.publicId,
      parsed.format
    );

    const attempts = [];

    const signedResp = await fetchCandidate(signedDownloadUrl);
    attempts.push({ url: 'signed:raw/download', status: signedResp.status });
    if (signedResp.ok) {
      const ab = await signedResp.arrayBuffer();
      const contentType = signedResp.headers.get('content-type') || 'application/octet-stream';

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

    // Fallback: keep legacy direct-url attempts for older/public assets.
    for (const candidate of candidateUrls) {
      const resp = await fetchCandidate(candidate);
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