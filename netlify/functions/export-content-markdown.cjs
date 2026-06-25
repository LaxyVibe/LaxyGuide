const {
  buildPublicObjectUrl,
  createStorageAdminRuntime,
  extractBearerToken,
  getAllowedEmails,
  json
} = require('./map-draw-storage.cjs');
const matter = require('gray-matter');

const DEFAULT_CONTENT_BRANCH = 'v2';
const DEFAULT_GITHUB_REPO = 'LaxyVibe/LaxyGuide';
const MANIFEST_OBJECT_PATH = 'content-manifest.json';
const CONTENT_DIRECTORIES = [
  {
    key: 'guides',
    sourcePath: 'src/content/guides',
    destinationPrefix: 'guides'
  },
  {
    key: 'pois',
    sourcePath: 'src/content/pois',
    destinationPrefix: 'pois'
  }
];

function getContentExportBranch(env = process.env) {
  return String(env.CONTENT_EXPORT_GITHUB_BRANCH || DEFAULT_CONTENT_BRANCH).trim() || DEFAULT_CONTENT_BRANCH;
}

function getContentExportRepo(env = process.env) {
  const rawRepo = String(env.CONTENT_EXPORT_GITHUB_REPO || DEFAULT_GITHUB_REPO).trim();
  const [owner, name] = rawRepo.split('/');

  if (!owner || !name) {
    throw new Error('CONTENT_EXPORT_GITHUB_REPO must be in owner/name format');
  }

  return {
    owner,
    name,
    repo: `${owner}/${name}`
  };
}

function getGitHubToken(env = process.env) {
  const token = String(env.GITHUB_CONTENT_READ_TOKEN || '').trim();
  if (!token) {
    throw new Error('GITHUB_CONTENT_READ_TOKEN is not configured');
  }

  return token;
}

function getContentExportAllowedEmails(env = process.env) {
  return getAllowedEmails(env.CONTENT_EXPORT_ADMIN_EMAILS || env.MAP_DRAW_ADMIN_EMAILS || '');
}

function getContentExportSharedSecret(env = process.env) {
  return String(env.CONTENT_EXPORT_SHARED_SECRET || '').trim();
}

function extractSharedSecret(event = {}) {
  const headers = event.headers || {};
  return String(
    headers['x-content-export-secret']
    || headers['X-Content-Export-Secret']
    || headers['x-export-secret']
    || headers['X-Export-Secret']
    || event.queryStringParameters?.secret
    || ''
  ).trim();
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return require('node:crypto').timingSafeEqual(leftBuffer, rightBuffer);
}

function encodeGitHubPath(contentPath) {
  return String(contentPath || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function getGitHubApiHeaders(env = process.env, accept = 'application/vnd.github+json') {
  return {
    Authorization: `Bearer ${getGitHubToken(env)}`,
    Accept: accept,
    'User-Agent': 'laxyguide-content-export',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

async function parseGitHubError(response) {
  const fallback = `GitHub request failed (${response.status})`;

  try {
    const payload = await response.json();
    return payload?.message ? `${fallback}: ${payload.message}` : fallback;
  } catch {
    const text = await response.text().catch(() => '');
    return text ? `${fallback}: ${text}` : fallback;
  }
}

function filterMarkdownEntries(entries) {
  return entries
    .filter((entry) => {
      const hasMarkdownName = typeof entry?.name === 'string' && entry.name.endsWith('.md');
      const hasSupportedType = entry?.type === undefined || entry?.type === 'file';
      return hasMarkdownName && hasSupportedType;
    })
    .map((entry) => ({
      name: entry.name,
      path: entry.path,
      sha: entry.sha,
      size: entry.size
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function isFrontmatterRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getLocalizedBlocks(frontmatter) {
  return Object.entries(frontmatter || {})
    .filter(([, value]) => isFrontmatterRecord(value))
    .map(([language, value]) => ({
      language,
      value
    }));
}

function extractGuideManifestMetadata(markdown, entry, bucketName, objectPath) {
  const parsed = matter(markdown);
  const blocks = getLocalizedBlocks(parsed.data);
  const summaries = {};
  const languages = [];
  let guideId = '';

  for (const block of blocks) {
    const code = typeof block.value.code === 'string' ? block.value.code.trim() : '';
    const title = typeof block.value.title === 'string' ? block.value.title.trim() : '';
    const guideUnderlayImage = typeof block.value.guideUnderlayImage === 'string'
      ? block.value.guideUnderlayImage.trim()
      : '';

    if (!guideId && code) {
      guideId = code;
    }

    if (title) {
      languages.push(block.language);
      summaries[block.language] = {
        title,
        guideUnderlayImage
      };
    }
  }

  if (!guideId) {
    throw new Error(`Guide metadata is missing code in ${entry.path}`);
  }

  if (languages.length === 0) {
    throw new Error(`Guide metadata is missing localized titles in ${entry.path}`);
  }

  return {
    guideId,
    fileName: entry.name,
    objectPath,
    publicUrl: buildPublicObjectUrl(bucketName, objectPath),
    sha: entry.sha,
    languages,
    summaries
  };
}

function extractPoiManifestMetadata(markdown, entry, bucketName, objectPath) {
  const parsed = matter(markdown);
  const blocks = getLocalizedBlocks(parsed.data);
  const languages = [];
  let guideId = '';
  let number = '';

  for (const block of blocks) {
    const blockGuideId = typeof block.value.guide === 'string' ? block.value.guide.trim() : '';
    const blockNumber = typeof block.value.number === 'string' ? block.value.number.trim() : '';
    const title = typeof block.value.title === 'string' ? block.value.title.trim() : '';

    if (!guideId && blockGuideId) {
      guideId = blockGuideId;
    }

    if (!number && blockNumber) {
      number = blockNumber;
    }

    if (title) {
      languages.push(block.language);
    }
  }

  if (!guideId) {
    throw new Error(`POI metadata is missing guide in ${entry.path}`);
  }

  if (!number) {
    throw new Error(`POI metadata is missing number in ${entry.path}`);
  }

  if (languages.length === 0) {
    throw new Error(`POI metadata is missing localized titles in ${entry.path}`);
  }

  return {
    guideId,
    number,
    fileName: entry.name,
    objectPath,
    publicUrl: buildPublicObjectUrl(bucketName, objectPath),
    sha: entry.sha,
    languages
  };
}

function extractManifestMetadata(directoryKey, markdown, entry, bucketName, objectPath) {
  if (directoryKey === 'guides') {
    return extractGuideManifestMetadata(markdown, entry, bucketName, objectPath);
  }

  return extractPoiManifestMetadata(markdown, entry, bucketName, objectPath);
}

function getExistingBlobSha(metadata) {
  return metadata?.metadata?.githubBlobSha || metadata?.metadata?.githubblobsha || '';
}

function createCollectionSummary(entries) {
  return {
    total: entries.length,
    uploadedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    uploaded: [],
    skipped: [],
    failed: []
  };
}

function addCollectionResult(summary, bucket, objectPath, entry, status, extra = {}) {
  const target = {
    fileName: entry.name,
    sourcePath: entry.path,
    objectPath,
    publicUrl: buildPublicObjectUrl(bucket, objectPath),
    sha: entry.sha,
    ...extra
  };

  if (status === 'uploaded') {
    summary.uploaded.push(target);
    summary.uploadedCount += 1;
    return;
  }

  if (status === 'skipped') {
    summary.skipped.push(target);
    summary.skippedCount += 1;
    return;
  }

  summary.failed.push(target);
  summary.failedCount += 1;
}

function createContentExportRuntime(env = process.env) {
  const storageRuntime = createStorageAdminRuntime(env);
  const { owner, name } = getContentExportRepo(env);

  async function githubJson(url) {
    const response = await fetch(url, {
      method: 'GET',
      headers: getGitHubApiHeaders(env)
    });

    if (!response.ok) {
      throw new Error(await parseGitHubError(response));
    }

    return response.json();
  }

  async function githubText(url) {
    const response = await fetch(url, {
      method: 'GET',
      headers: getGitHubApiHeaders(env, 'application/vnd.github.raw')
    });

    if (!response.ok) {
      throw new Error(await parseGitHubError(response));
    }

    return response.text();
  }

  return {
    bucketName: storageRuntime.bucketName,
    verifyIdToken: storageRuntime.verifyIdToken,
    getBranchHead: async (branch) => {
      const payload = await githubJson(`https://api.github.com/repos/${owner}/${name}/commits/${encodeURIComponent(branch)}`);
      return {
        branch,
        commitSha: payload.sha
      };
    },
    listDirectory: async (directoryPath, branch) => {
      const payload = await githubJson(
        `https://api.github.com/repos/${owner}/${name}/contents/${encodeGitHubPath(directoryPath)}?ref=${encodeURIComponent(branch)}`
      );

      if (!Array.isArray(payload)) {
        throw new Error(`Expected a directory listing for ${directoryPath}`);
      }

      return filterMarkdownEntries(payload);
    },
    downloadTextFile: async (filePath, branch) => {
      return githubText(
        `https://api.github.com/repos/${owner}/${name}/contents/${encodeGitHubPath(filePath)}?ref=${encodeURIComponent(branch)}`
      );
    },
    getObjectMetadata: storageRuntime.getObjectMetadata,
    uploadTextObject: async (objectPath, text, options = {}) => {
      return storageRuntime.uploadObject(objectPath, text, {
        ...options,
        contentType: options.contentType || 'text/plain; charset=utf-8'
      });
    },
    uploadJsonObject: storageRuntime.uploadJsonObject
  };
}

function createHandler(options = {}) {
  const env = options.env || process.env;
  const runtimeFactory = options.runtimeFactory || createContentExportRuntime;

  return async (event = {}) => {
    if (event.httpMethod !== 'POST') {
      return json(405, { error: 'Method Not Allowed' });
    }

    try {
      const sharedSecret = getContentExportSharedSecret(env);
      const presentedSecret = extractSharedSecret(event);
      let authMode = 'firebase';
      let runtime = null;

      if (sharedSecret) {
        if (!presentedSecret || !timingSafeEqual(sharedSecret, presentedSecret)) {
          return json(401, { error: 'Invalid shared secret' });
        }
        authMode = 'shared-secret';
      } else {
        const bearerToken = extractBearerToken(event.headers);
        if (!bearerToken) {
          return json(401, { error: 'Missing bearer token' });
        }

        const allowedEmails = getContentExportAllowedEmails(env);
        if (allowedEmails.size === 0) {
          return json(500, { error: 'CONTENT_EXPORT_ADMIN_EMAILS or MAP_DRAW_ADMIN_EMAILS must be configured' });
        }

        runtime = runtimeFactory(env);
        const decodedToken = await runtime.verifyIdToken(bearerToken);
        const email = String(decodedToken.email || '').trim().toLowerCase();

        if (!email || !allowedEmails.has(email)) {
          return json(403, { error: 'User is not allowed to publish content to Firebase Storage' });
        }
      }

      runtime = runtime || runtimeFactory(env);
      const branch = getContentExportBranch(env);
      const branchHead = await runtime.getBranchHead(branch);
      const exportedAt = new Date().toISOString();
      const bucketName = runtime.bucketName;

      const summary = {
        ok: true,
        authMode,
        branch,
        commitSha: branchHead.commitSha,
        bucketName,
        exportedAt,
        manifest: {
          objectPath: MANIFEST_OBJECT_PATH,
          publicUrl: buildPublicObjectUrl(bucketName, MANIFEST_OBJECT_PATH),
          success: false
        }
      };

      const manifest = {
        repo: getContentExportRepo(env).repo,
        branch,
        commitSha: branchHead.commitSha,
        bucketName,
        exportedAt,
        guides: [],
        pois: []
      };

      for (const directory of CONTENT_DIRECTORIES) {
        const entries = filterMarkdownEntries(await runtime.listDirectory(directory.sourcePath, branch));
        const collectionSummary = createCollectionSummary(entries);

        for (const entry of entries) {
          const objectPath = `${directory.destinationPrefix}/${entry.name}`;

          try {
            const markdown = await runtime.downloadTextFile(entry.path, branch);
            const manifestEntry = extractManifestMetadata(directory.key, markdown, entry, bucketName, objectPath);
            const existingMetadata = await runtime.getObjectMetadata(objectPath);
            const existingBlobSha = getExistingBlobSha(existingMetadata);

            if (existingBlobSha && existingBlobSha === entry.sha) {
              addCollectionResult(collectionSummary, bucketName, objectPath, entry, 'skipped', {
                reason: 'unchanged'
              });
              manifest[directory.key].push(manifestEntry);
              continue;
            }

            await runtime.uploadTextObject(objectPath, markdown, {
              contentType: 'text/markdown; charset=utf-8',
              cacheControl: 'no-cache',
              metadata: {
                githubBlobSha: entry.sha,
                githubPath: entry.path,
                githubBranch: branch,
                githubCommitSha: branchHead.commitSha,
                exportedAt
              }
            });

            addCollectionResult(collectionSummary, bucketName, objectPath, entry, 'uploaded');
            manifest[directory.key].push(manifestEntry);
          } catch (error) {
            const message = error && error.message ? error.message : String(error);
            addCollectionResult(collectionSummary, bucketName, objectPath, entry, 'failed', {
              error: message || 'Failed to export markdown file'
            });
          }
        }

        summary[directory.key] = collectionSummary;
      }

      try {
        await runtime.uploadJsonObject(MANIFEST_OBJECT_PATH, manifest, {
          cacheControl: 'no-cache',
          metadata: {
            githubBranch: branch,
            githubCommitSha: branchHead.commitSha,
            exportedAt
          }
        });
        summary.manifest.success = true;
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        summary.manifest.error = message || 'Failed to export manifest';
      }

      const totalFailures = CONTENT_DIRECTORIES.reduce((count, directory) => {
        return count + summary[directory.key].failedCount;
      }, summary.manifest.success ? 0 : 1);

      summary.ok = totalFailures === 0;
      return json(totalFailures === 0 ? 200 : 207, summary);
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      if (/token/i.test(message)) {
        return json(401, { error: 'Invalid bearer token' });
      }
      return json(500, { error: message || 'Failed to export content markdown' });
    }
  };
}

exports.CONTENT_DIRECTORIES = CONTENT_DIRECTORIES;
exports.DEFAULT_CONTENT_BRANCH = DEFAULT_CONTENT_BRANCH;
exports.MANIFEST_OBJECT_PATH = MANIFEST_OBJECT_PATH;
exports.createContentExportRuntime = createContentExportRuntime;
exports.createHandler = createHandler;
exports.extractSharedSecret = extractSharedSecret;
exports.getContentExportSharedSecret = getContentExportSharedSecret;
exports.handler = createHandler();
