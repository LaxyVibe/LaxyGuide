import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    createHandler,
    DEFAULT_CONTENT_BRANCH,
    MANIFEST_OBJECT_PATH
} = require('../netlify/functions/export-content-markdown.cjs');

const MARKDOWN_BY_PATH: Record<string, string> = {
    'src/content/guides/guide-a.md': `---
en-US:
  title: Guide A English
  code: GUIDE-A
  guideUnderlayImage: https://example.com/guide-a-en.jpg
ja-JP:
  title: Guide A Japanese
  code: GUIDE-A
  guideUnderlayImage: https://example.com/guide-a-ja.jpg
---`,
    'src/content/guides/guide-b.md': `---
en-US:
  title: Guide B English
  code: GUIDE-B
  guideUnderlayImage: https://example.com/guide-b-en.jpg
---`,
    'src/content/pois/poi-a.md': `---
en-US:
  guide: GUIDE-A
  number: '001'
  title: POI A English
ja-JP:
  guide: GUIDE-A
  number: '001'
  title: POI A Japanese
---`,
    'src/content/pois/poi-fail.md': `---
en-US:
  guide: GUIDE-X
  number: '777'
  title: Broken POI
---`
};

function createEvent(overrides: Partial<{
    httpMethod: string;
    headers: Record<string, string>;
}> = {}) {
    return {
        httpMethod: 'POST',
        headers: {
            authorization: 'Bearer valid-token'
        },
        ...overrides
    };
}

test('content export handler returns 405 for non-POST requests', async () => {
    const handler = createHandler({
        env: {
            CONTENT_EXPORT_ADMIN_EMAILS: 'publisher@example.com'
        },
        runtimeFactory: () => {
            throw new Error('runtime should not be created');
        }
    });

    const response = await handler(createEvent({ httpMethod: 'GET' }));
    assert.equal(response.statusCode, 405);
    assert.match(response.body, /Method Not Allowed/);
});

test('content export handler returns 401 when bearer token is missing', async () => {
    const handler = createHandler({
        env: {
            CONTENT_EXPORT_ADMIN_EMAILS: 'publisher@example.com'
        },
        runtimeFactory: () => {
            throw new Error('runtime should not be created');
        }
    });

    const response = await handler(createEvent({ headers: {} }));
    assert.equal(response.statusCode, 401);
    assert.match(response.body, /Missing bearer token/);
});

test('content export handler returns 401 when shared secret mode is enabled but missing', async () => {
    const handler = createHandler({
        env: {
            CONTENT_EXPORT_SHARED_SECRET: 'super-secret'
        },
        runtimeFactory: () => {
            throw new Error('runtime should not be created');
        }
    });

    const response = await handler(createEvent({ headers: {} }));
    assert.equal(response.statusCode, 401);
    assert.match(response.body, /Invalid shared secret/);
});

test('content export handler returns 403 for non-allowlisted users', async () => {
    const handler = createHandler({
        env: {
            CONTENT_EXPORT_ADMIN_EMAILS: 'publisher@example.com'
        },
        runtimeFactory: () => ({
            bucketName: 'laxy-guide-dev.firebasestorage.app',
            verifyIdToken: async () => ({ email: 'viewer@example.com' })
        })
    });

    const response = await handler(createEvent());
    assert.equal(response.statusCode, 403);
    assert.match(response.body, /not allowed/i);
});

test('content export handler allows shared-secret auth without Firebase verification', async () => {
    let verifyCalled = false;

    const handler = createHandler({
        env: {
            CONTENT_EXPORT_SHARED_SECRET: 'super-secret'
        },
        runtimeFactory: () => ({
            bucketName: 'laxy-guide-dev.firebasestorage.app',
            verifyIdToken: async () => {
                verifyCalled = true;
                throw new Error('should not verify firebase token in shared secret mode');
            },
            getBranchHead: async (branch: string) => ({ branch, commitSha: 'commit-secret' }),
            listDirectory: async () => [],
            getObjectMetadata: async () => null,
            downloadTextFile: async () => '',
            uploadTextObject: async () => ({ objectPath: 'unused' }),
            uploadJsonObject: async () => ({ objectPath: MANIFEST_OBJECT_PATH })
        })
    });

    const response = await handler(createEvent({
        headers: {
            'x-content-export-secret': 'super-secret'
        }
    }));
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(body.authMode, 'shared-secret');
    assert.equal(verifyCalled, false);
});

test('content export handler exports markdown, skips unchanged files, and writes a manifest', async () => {
    const listCalls: Array<{ directoryPath: string; branch: string }> = [];
    const downloadCalls: Array<{ filePath: string; branch: string }> = [];
    const uploadedTextObjects: Array<{
        objectPath: string;
        text: string;
        options: Record<string, unknown>;
    }> = [];
    const uploadedJsonObjects: Array<{
        objectPath: string;
        payload: Record<string, unknown>;
        options: Record<string, unknown>;
    }> = [];

    const handler = createHandler({
        env: {
            CONTENT_EXPORT_ADMIN_EMAILS: 'publisher@example.com'
        },
        runtimeFactory: () => ({
            bucketName: 'laxy-guide-dev.firebasestorage.app',
            verifyIdToken: async () => ({ email: 'publisher@example.com' }),
            getBranchHead: async (branch: string) => {
                assert.equal(branch, DEFAULT_CONTENT_BRANCH);
                return { branch, commitSha: 'commit-123' };
            },
            listDirectory: async (directoryPath: string, branch: string) => {
                listCalls.push({ directoryPath, branch });

                if (directoryPath.endsWith('/guides')) {
                    return [
                        { name: 'guide-a.md', path: 'src/content/guides/guide-a.md', sha: 'guide-a-sha', type: 'file' },
                        { name: 'guide-b.md', path: 'src/content/guides/guide-b.md', sha: 'guide-b-sha', type: 'file' },
                        { name: 'README.txt', path: 'src/content/guides/README.txt', sha: 'ignore-me', type: 'file' }
                    ];
                }

                return [
                    { name: 'poi-a.md', path: 'src/content/pois/poi-a.md', sha: 'poi-a-sha', type: 'file' },
                    { name: 'folder', path: 'src/content/pois/folder', sha: 'ignore-dir', type: 'dir' }
                ];
            },
            getObjectMetadata: async (objectPath: string) => {
                if (objectPath === 'guides/guide-b.md') {
                    return {
                        metadata: {
                            githubBlobSha: 'guide-b-sha'
                        }
                    };
                }

                return null;
            },
            downloadTextFile: async (filePath: string, branch: string) => {
                downloadCalls.push({ filePath, branch });
                return MARKDOWN_BY_PATH[filePath];
            },
            uploadTextObject: async (objectPath: string, text: string, options: Record<string, unknown>) => {
                uploadedTextObjects.push({ objectPath, text, options });
                return { objectPath };
            },
            uploadJsonObject: async (objectPath: string, payload: Record<string, unknown>, options: Record<string, unknown>) => {
                uploadedJsonObjects.push({ objectPath, payload, options });
                return { objectPath };
            }
        })
    });

    const response = await handler(createEvent());
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(listCalls, [
        { directoryPath: 'src/content/guides', branch: DEFAULT_CONTENT_BRANCH },
        { directoryPath: 'src/content/pois', branch: DEFAULT_CONTENT_BRANCH }
    ]);
    assert.deepEqual(downloadCalls, [
        { filePath: 'src/content/guides/guide-a.md', branch: DEFAULT_CONTENT_BRANCH },
        { filePath: 'src/content/guides/guide-b.md', branch: DEFAULT_CONTENT_BRANCH },
        { filePath: 'src/content/pois/poi-a.md', branch: DEFAULT_CONTENT_BRANCH }
    ]);

    assert.deepEqual(uploadedTextObjects.map((entry) => entry.objectPath), [
        'guides/guide-a.md',
        'pois/poi-a.md'
    ]);
    assert.equal(uploadedTextObjects[0].text, MARKDOWN_BY_PATH['src/content/guides/guide-a.md']);
    assert.equal(uploadedTextObjects[1].text, MARKDOWN_BY_PATH['src/content/pois/poi-a.md']);
    assert.equal(uploadedTextObjects[0].options.contentType, 'text/markdown; charset=utf-8');
    assert.equal(uploadedTextObjects[0].options.cacheControl, 'no-cache');

    assert.equal(uploadedJsonObjects.length, 1);
    assert.equal(uploadedJsonObjects[0].objectPath, MANIFEST_OBJECT_PATH);
    assert.equal(body.ok, true);
    assert.equal(body.authMode, 'firebase');
    assert.equal(body.branch, DEFAULT_CONTENT_BRANCH);
    assert.equal(body.commitSha, 'commit-123');
    assert.equal(body.guides.uploadedCount, 1);
    assert.equal(body.guides.skippedCount, 1);
    assert.equal(body.guides.failedCount, 0);
    assert.equal(body.pois.uploadedCount, 1);
    assert.equal(body.manifest.success, true);

    assert.deepEqual(uploadedJsonObjects[0].payload.guides, [
        {
            guideId: 'GUIDE-A',
            fileName: 'guide-a.md',
            objectPath: 'guides/guide-a.md',
            publicUrl: 'https://storage.googleapis.com/laxy-guide-dev.firebasestorage.app/guides/guide-a.md',
            sha: 'guide-a-sha',
            languages: ['en-US', 'ja-JP'],
            summaries: {
                'en-US': {
                    title: 'Guide A English',
                    guideUnderlayImage: 'https://example.com/guide-a-en.jpg'
                },
                'ja-JP': {
                    title: 'Guide A Japanese',
                    guideUnderlayImage: 'https://example.com/guide-a-ja.jpg'
                }
            }
        },
        {
            guideId: 'GUIDE-B',
            fileName: 'guide-b.md',
            objectPath: 'guides/guide-b.md',
            publicUrl: 'https://storage.googleapis.com/laxy-guide-dev.firebasestorage.app/guides/guide-b.md',
            sha: 'guide-b-sha',
            languages: ['en-US'],
            summaries: {
                'en-US': {
                    title: 'Guide B English',
                    guideUnderlayImage: 'https://example.com/guide-b-en.jpg'
                }
            }
        }
    ]);
    assert.deepEqual(uploadedJsonObjects[0].payload.pois, [
        {
            guideId: 'GUIDE-A',
            number: '001',
            fileName: 'poi-a.md',
            objectPath: 'pois/poi-a.md',
            publicUrl: 'https://storage.googleapis.com/laxy-guide-dev.firebasestorage.app/pois/poi-a.md',
            sha: 'poi-a-sha',
            languages: ['en-US', 'ja-JP']
        }
    ]);
});

test('content export handler reports partial failures clearly', async () => {
    let manifestPayload: Record<string, unknown> | null = null;

    const handler = createHandler({
        env: {
            MAP_DRAW_ADMIN_EMAILS: 'publisher@example.com'
        },
        runtimeFactory: () => ({
            bucketName: 'laxy-guide-dev.firebasestorage.app',
            verifyIdToken: async () => ({ email: 'publisher@example.com' }),
            getBranchHead: async (branch: string) => ({ branch, commitSha: 'commit-456' }),
            listDirectory: async (directoryPath: string) => {
                if (directoryPath.endsWith('/guides')) {
                    return [];
                }

                return [
                    { name: 'poi-fail.md', path: 'src/content/pois/poi-fail.md', sha: 'poi-fail-sha', type: 'file' }
                ];
            },
            getObjectMetadata: async () => null,
            downloadTextFile: async () => MARKDOWN_BY_PATH['src/content/pois/poi-fail.md'],
            uploadTextObject: async () => {
                throw new Error('Storage upload failed (500): broken');
            },
            uploadJsonObject: async (objectPath: string, payload: Record<string, unknown>) => {
                manifestPayload = payload;
                return { objectPath, payload };
            }
        })
    });

    const response = await handler(createEvent());
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 207);
    assert.equal(body.ok, false);
    assert.equal(body.pois.failedCount, 1);
    assert.match(body.pois.failed[0].error, /Storage upload failed/);
    assert.equal(body.manifest.success, true);
    assert.deepEqual(manifestPayload?.guides, []);
    assert.deepEqual(manifestPayload?.pois, []);
});
