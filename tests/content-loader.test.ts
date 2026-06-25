import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getGuideAvailableLanguages,
    loadAllGuides,
    loadGuideData,
    resetContentLoaderCachesForTests
} from '../src/utils/contentLoader.ts';

const originalFetch = globalThis.fetch;

const manifestUrl = 'https://storage.googleapis.com/laxy-guide-dev.firebasestorage.app/content-manifest.json';
const guideMarkdownUrl = 'https://storage.googleapis.com/laxy-guide-dev.firebasestorage.app/guides/GUIDE-A.md';
const poiOneUrl = 'https://storage.googleapis.com/laxy-guide-dev.firebasestorage.app/pois/GUIDE-A-001.md';
const poiTwoUrl = 'https://storage.googleapis.com/laxy-guide-dev.firebasestorage.app/pois/GUIDE-A-010.md';
const unrelatedPoiUrl = 'https://storage.googleapis.com/laxy-guide-dev.firebasestorage.app/pois/GUIDE-B-001.md';

const manifestPayload = {
    repo: 'LaxyVibe/LaxyGuide',
    branch: 'v2',
    commitSha: 'commit-123',
    bucketName: 'laxy-guide-dev.firebasestorage.app',
    exportedAt: '2026-06-25T00:00:00.000Z',
    guides: [
        {
            guideId: 'GUIDE-A',
            fileName: 'GUIDE-A.md',
            objectPath: 'guides/GUIDE-A.md',
            publicUrl: guideMarkdownUrl,
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
        }
    ],
    pois: [
        {
            guideId: 'GUIDE-A',
            number: '001',
            fileName: 'GUIDE-A-001.md',
            objectPath: 'pois/GUIDE-A-001.md',
            publicUrl: poiOneUrl,
            sha: 'poi-1-sha',
            languages: ['en-US', 'ja-JP']
        },
        {
            guideId: 'GUIDE-A',
            number: '010',
            fileName: 'GUIDE-A-010.md',
            objectPath: 'pois/GUIDE-A-010.md',
            publicUrl: poiTwoUrl,
            sha: 'poi-10-sha',
            languages: ['en-US']
        },
        {
            guideId: 'GUIDE-B',
            number: '001',
            fileName: 'GUIDE-B-001.md',
            objectPath: 'pois/GUIDE-B-001.md',
            publicUrl: unrelatedPoiUrl,
            sha: 'poi-b-sha',
            languages: ['en-US']
        }
    ]
};

const responsesByUrl: Record<string, string> = {
    [manifestUrl]: JSON.stringify(manifestPayload),
    [guideMarkdownUrl]: `---
en-US:
  title: Guide A English
  code: GUIDE-A
  guideUnderlayImage: https://example.com/guide-a-en.jpg
  mapImage: https://example.com/map-a.jpg
  mapTileUrlTemplate: https://example.com/tiles/{z}/{x}/{y}.png
  mapTileBundleUrl: https://example.com/tiles.zip
  mapTileMaxZoom: 5
  mapPixelWidth: 1024
  mapPixelHeight: 768
  mapPinsUrl: https://example.com/pins-a.json
ja-JP:
  title: Guide A Japanese
  code: GUIDE-A
  guideUnderlayImage: https://example.com/guide-a-ja.jpg
  mapImage: https://example.com/map-a-ja.jpg
  geoCalibration:
    method: corner-bilinear
    points:
      - id: top-left
        x: 0
        y: 0
        lat: 35
        lng: 139
    transform:
      topLeft:
        lat: 35
        lng: 139
      topRight:
        lat: 35
        lng: 140
      bottomRight:
        lat: 34
        lng: 140
      bottomLeft:
        lat: 34
        lng: 139
---`,
    [poiOneUrl]: `---
en-US:
  guide: GUIDE-A
  number: '001'
  title: POI One English
  hero: https://example.com/poi-1.jpg
  audio: https://example.com/poi-1.mp3
  displayAudio: true
  metadata:
    - label: Period
      value: Modern
  content: English content
ja-JP:
  guide: GUIDE-A
  number: '001'
  title: POI One Japanese
  hero: https://example.com/poi-1.jpg
  displayAudio: false
  metadata:
    - label: 時代
      value: 現代
  content: Japanese content
---`,
    [poiTwoUrl]: `---
en-US:
  guide: GUIDE-A
  number: '010'
  title: POI Ten English
  hero: https://example.com/poi-10.jpg
  ttml: https://example.com/poi-10.ttml
  displayAudio: true
  content: Tenth poi
---`,
    [unrelatedPoiUrl]: `---
en-US:
  guide: GUIDE-B
  number: '001'
  title: Unrelated
---`
};

function createFetchMock(callCounts: Map<string, number>, overrides: Partial<Record<string, { status?: number; body?: string }>> = {}) {
    return async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        callCounts.set(url, (callCounts.get(url) || 0) + 1);

        const override = overrides[url];
        if (override) {
            return new Response(override.body || '', {
                status: override.status || 200,
                headers: {
                    'Content-Type': url === manifestUrl ? 'application/json' : 'text/markdown; charset=utf-8'
                }
            });
        }

        if (!(url in responsesByUrl)) {
            return new Response('Not Found', { status: 404 });
        }

        return new Response(responsesByUrl[url], {
            status: 200,
            headers: {
                'Content-Type': url === manifestUrl ? 'application/json' : 'text/markdown; charset=utf-8'
            }
        });
    };
}

function withFetchMock(
    callCounts: Map<string, number>,
    callback: () => Promise<void>,
    overrides: Partial<Record<string, { status?: number; body?: string }>> = {}
) {
    globalThis.fetch = createFetchMock(callCounts, overrides) as typeof fetch;
    resetContentLoaderCachesForTests();

    return callback().finally(() => {
        globalThis.fetch = originalFetch;
        resetContentLoaderCachesForTests();
    });
}

test('loadAllGuides builds listing data from the remote manifest', async () => {
    const calls = new Map<string, number>();

    await withFetchMock(calls, async () => {
        const guides = await loadAllGuides('ja-JP');
        assert.deepEqual(guides, [
            {
                id: 'GUIDE-A',
                title: 'Guide A Japanese',
                image: 'https://example.com/guide-a-ja.jpg'
            }
        ]);
        assert.equal(calls.get(manifestUrl), 1);
        assert.equal(calls.get(guideMarkdownUrl), undefined);
    });
});

test('getGuideAvailableLanguages reads languages from the remote manifest', async () => {
    const calls = new Map<string, number>();

    await withFetchMock(calls, async () => {
        const languages = await getGuideAvailableLanguages('guide-a');
        assert.deepEqual(languages, ['en-US', 'ja-JP']);
        assert.equal(calls.get(manifestUrl), 1);
    });
});

test('loadGuideData fetches only the selected guide markdown and its POIs with language fallback', async () => {
    const calls = new Map<string, number>();

    await withFetchMock(calls, async () => {
        const guide = await loadGuideData('guide-a', 'ja-JP');
        assert.ok(guide);
        assert.equal(guide.guideTitle, 'Guide A Japanese');
        assert.equal(guide.guideUnderlayImage, 'https://example.com/guide-a-ja.jpg');
        assert.equal(guide.mapImage, 'https://example.com/map-a-ja.jpg');
        assert.equal(guide.mapTileUrlTemplate, 'https://example.com/tiles/{z}/{x}/{y}.png');
        assert.equal(guide.mapTileBundleUrl, 'https://example.com/tiles.zip');
        assert.equal(guide.mapTileMaxZoom, 5);
        assert.equal(guide.mapPixelWidth, 1024);
        assert.equal(guide.mapPixelHeight, 768);
        assert.equal(guide.mapPinsUrl, 'https://example.com/pins-a.json');
        assert.equal(guide.pois.length, 2);
        assert.deepEqual(guide.pois.map((poi) => poi.number), ['001', '010']);
        assert.equal(guide.pois[0].title, 'POI One Japanese');
        assert.equal(guide.pois[0].content, 'Japanese content');
        assert.equal(guide.pois[0].withAudio, false);
        assert.equal(guide.pois[1].title, 'POI Ten English');
        assert.equal(guide.pois[1].withAudio, true);

        assert.equal(calls.get(manifestUrl), 1);
        assert.equal(calls.get(guideMarkdownUrl), 1);
        assert.equal(calls.get(poiOneUrl), 1);
        assert.equal(calls.get(poiTwoUrl), 1);
        assert.equal(calls.get(unrelatedPoiUrl), undefined);
    });
});

test('loadGuideData returns null when the guide is missing from the manifest', async () => {
    const calls = new Map<string, number>();

    await withFetchMock(calls, async () => {
        const guide = await loadGuideData('missing-guide', 'en-US');
        assert.equal(guide, null);
        assert.equal(calls.get(manifestUrl), 1);
    });
});

test('content loader caches manifest and markdown requests across repeated calls', async () => {
    const calls = new Map<string, number>();

    await withFetchMock(calls, async () => {
        await loadGuideData('GUIDE-A', 'en-US');
        await loadGuideData('guide-a', 'ja-JP');
        await getGuideAvailableLanguages('GUIDE-A');
        await loadAllGuides('en-US');

        assert.equal(calls.get(manifestUrl), 1);
        assert.equal(calls.get(guideMarkdownUrl), 1);
        assert.equal(calls.get(poiOneUrl), 1);
        assert.equal(calls.get(poiTwoUrl), 1);
    });
});

test('content loader surfaces manifest fetch failures clearly', async () => {
    const calls = new Map<string, number>();

    await withFetchMock(calls, async () => {
        await assert.rejects(() => loadAllGuides('en-US'), /Content manifest request failed \(500\)/);
    }, {
        [manifestUrl]: {
            status: 500,
            body: 'Server error'
        }
    });
});

test('content loader surfaces markdown fetch failures clearly', async () => {
    const calls = new Map<string, number>();

    await withFetchMock(calls, async () => {
        await assert.rejects(() => loadGuideData('GUIDE-A', 'en-US'), /POI markdown \(GUIDE-A\/010\) request failed \(404\)/);
    }, {
        [poiTwoUrl]: {
            status: 404,
            body: 'Not found'
        }
    });
});
