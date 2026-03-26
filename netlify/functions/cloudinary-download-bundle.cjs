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

    const candidateUrls = tryBuildCandidateUrls(rawUrl, cloudName);
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