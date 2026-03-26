function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

const { v2: cloudinary } = require('cloudinary');

function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

function sanitizeBundleFormat(raw) {
  const value = String(raw || '').trim().toLowerCase();
  return value.replace(/[^a-z0-9]/g, '') || '';
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

function buildPublicIdCandidates(publicId, format) {
  const candidates = [];

  const push = (label, id, fmt) => {
    if (!id) return;
    const key = `${id}::${fmt || ''}`;
    if (candidates.some((c) => c.key === key)) return;
    candidates.push({ key, label, publicId: id, format: fmt || undefined });
  };

  const normalizedFormat = sanitizeBundleFormat(format);
  const cleanId = String(publicId || '').trim();

  push('id:exact', cleanId, normalizedFormat || undefined);
  push('id:exact-no-format', cleanId, undefined);

  const extMatch = cleanId.match(/\.([a-zA-Z0-9]+)$/);
  if (extMatch) {
    const ext = sanitizeBundleFormat(extMatch[1]);
    const withoutExt = cleanId.slice(0, -(extMatch[0].length));
    push('id:strip-ext', withoutExt, ext || normalizedFormat || undefined);
    push('id:strip-ext-no-format', withoutExt, undefined);
  } else if (normalizedFormat) {
    push('id:add-ext', `${cleanId}.${normalizedFormat}`, undefined);
  }

  return candidates;
}

function buildSignedDownloadUrl(publicId, format, type) {
  return cloudinary.utils.private_download_url(publicId, format || 'zip', {
    resource_type: 'raw',
    type,
    attachment: true
  });
}

async function resolveResourceByAdminApi(publicIdCandidates) {
  const deliveryTypes = ['upload', 'private', 'authenticated'];
  for (const candidate of publicIdCandidates) {
    for (const type of deliveryTypes) {
      try {
        const resource = await cloudinary.api.resource(candidate.publicId, {
          resource_type: 'raw',
          type
        });
        return {
          publicId: String(resource?.public_id || candidate.publicId),
          format: candidate.format || sanitizeBundleFormat(resource?.format) || 'zip',
          type: String(resource?.type || type)
        };
      } catch (err) {
        const code = Number(err?.http_code || err?.error?.http_code || 0);
        if (code !== 404) {
          // For transient/admin errors, continue with other permutations.
        }
      }
    }
  }
  return null;
}

function buildSignedDownloadAttempts(meta, publicIdCandidates) {
  const types = ['upload', 'private', 'authenticated'];
  const out = [];
  const seen = new Set();

  const push = (label, publicId, format, type) => {
    const key = `${publicId}::${format || ''}::${type}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label, url: buildSignedDownloadUrl(publicId, format, type) });
  };

  if (meta) {
    push('signed:admin-resolved', meta.publicId, meta.format, meta.type);
  }

  for (const candidate of publicIdCandidates) {
    for (const type of types) {
      push(`signed:${candidate.label}:${type}`, candidate.publicId, candidate.format || 'zip', type);
      push(`signed:${candidate.label}:${type}:no-format`, candidate.publicId, undefined, type);
    }
  }

  return out;
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

async function readDownloadBytes(resp, fetchFn, depth = 0) {
  if (!resp.ok) return null;

  const contentType = String(resp.headers.get('content-type') || '').toLowerCase();

  // Cloudinary download endpoints can respond with JSON metadata containing a URL.
  if (contentType.includes('application/json')) {
    if (depth >= 2) return null;
    const payload = await resp.json().catch(() => null);
    const redirectUrl =
      String(payload?.url || payload?.secure_url || payload?.download_url || '').trim();
    if (!redirectUrl) return null;
    const next = await fetchFn(redirectUrl);
    return readDownloadBytes(next, fetchFn, depth + 1);
  }

  const ab = await resp.arrayBuffer();
  if (!ab || ab.byteLength === 0) return null;
  return {
    bytes: ab,
    contentType: contentType || 'application/octet-stream'
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

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret
    });

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

    const inputPublicId = String(event.queryStringParameters?.publicId || '').trim();
    const inputFormat = String(event.queryStringParameters?.format || '').trim();

    const effectivePublicId = inputPublicId || parsed.publicId;
    const effectiveFormat = inputFormat || parsed.format;

    const publicIdCandidates = buildPublicIdCandidates(effectivePublicId, effectiveFormat);

    const adminResolved = await resolveResourceByAdminApi(publicIdCandidates);
    const signedCandidates = buildSignedDownloadAttempts(adminResolved, publicIdCandidates);

    const attempts = [];

    for (const candidate of signedCandidates) {
      const signedResp = await fetchCandidate(candidate.url);
      attempts.push({ url: candidate.label, status: signedResp.status });
      const downloaded = await readDownloadBytes(signedResp, fetchCandidate);
      if (!downloaded) continue;

      return {
        statusCode: 200,
        isBase64Encoded: true,
        headers: {
          'Content-Type': downloaded.contentType,
          'Content-Disposition': 'attachment; filename="bundle.zip"',
          'Cache-Control': 'no-store'
        },
        body: toBase64(downloaded.bytes)
      };
    }

    // Fallback: keep legacy direct-url attempts for older/public assets.
    for (const candidate of candidateUrls) {
      const resp = await fetchCandidate(candidate);
      attempts.push({ url: candidate, status: resp.status });
      const downloaded = await readDownloadBytes(resp, fetchCandidate);
      if (!downloaded) continue;

      return {
        statusCode: 200,
        isBase64Encoded: true,
        headers: {
          'Content-Type': downloaded.contentType,
          'Content-Disposition': 'attachment; filename="bundle.zip"',
          'Cache-Control': 'no-store'
        },
        body: toBase64(downloaded.bytes)
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