import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildRuntimePinsFromAuthoringDocument,
    fetchMapAuthoringJson,
    isMapAuthoringEnabledGuide,
    normalizeMapAuthoringDocument
} from '../src/utils/mapDrawData.ts';
import {
    getMapAuthoringObjectPath,
    getMapAuthoringPublicUrl,
    getMapTileBundleObjectPath,
    getMapTileBundlePublicUrl
} from '../src/utils/mapStorage.ts';
import type { MapAuthoringDocument } from '../src/types/index.ts';

const originalFetch = globalThis.fetch;

test('normalizeMapAuthoringDocument preserves full pin and traversable fidelity', () => {
    const document = normalizeMapAuthoringDocument({
        guideId: 'JPN-USAA-TEM-001',
        updatedAt: '2026-06-24T00:00:00.000Z',
        calibration: {
            method: 'corner-bilinear',
            points: [
                { id: 'topLeft', x: 0, y: 0, lat: 35.0, lng: 139.0 },
                { id: 'topRight', x: 1, y: 0, lat: 35.0, lng: 140.0 },
                { id: 'bottomRight', x: 1, y: 1, lat: 34.0, lng: 140.0 },
                { id: 'bottomLeft', x: 0, y: 1, lat: 34.0, lng: 139.0 }
            ],
            transform: {
                topLeft: { lat: 35.0, lng: 139.0 },
                topRight: { lat: 35.0, lng: 140.0 },
                bottomRight: { lat: 34.0, lng: 140.0 },
                bottomLeft: { lat: 34.0, lng: 139.0 }
            }
        },
        pins: [
            {
                id: '001',
                label: 'Main Gate',
                x: 0.25,
                y: 0.75,
                latLngs: [{ lat: 35.12, lng: 139.11, seq: 1 }],
                polygon: [
                    { lat: 35.1, lng: 139.1 },
                    { lat: 35.2, lng: 139.2 },
                    { lat: 35.3, lng: 139.3 }
                ],
                createdAt: '2026-06-20T00:00:00.000Z'
            }
        ],
        traversableRegions: [
            {
                id: 'region-a',
                polygon: [
                    { lat: 35.1, lng: 139.1 },
                    { lat: 35.2, lng: 139.2 },
                    { lat: 35.3, lng: 139.3 }
                ],
                polygonNormalized: [
                    { x: 0.1, y: 0.1 },
                    { x: 0.2, y: 0.2 },
                    { x: 0.3, y: 0.3 }
                ],
                geoPolygon: [
                    { lat: 35.11, lng: 139.11 },
                    { lat: 35.22, lng: 139.22 },
                    { lat: 35.33, lng: 139.33 }
                ]
            }
        ]
    });

    assert.equal(document.guideId, 'JPN-USAA-TEM-001');
    assert.equal(document.pins[0].label, 'Main Gate');
    assert.equal(document.pins[0].latLngs?.length, 1);
    assert.equal(document.pins[0].createdAt, '2026-06-20T00:00:00.000Z');
    assert.equal(document.traversableRegions[0].polygonNormalized?.length, 3);
    assert.equal(document.traversableRegions[0].geoPolygon?.length, 3);
});

test('normalizeMapAuthoringDocument safely defaults missing optional fields', () => {
    const document = normalizeMapAuthoringDocument({
        guideId: 'JPN-USAA-TEM-001',
        pins: [{ id: '', x: 0.5, y: 0.5 }],
        traversableRegions: [{}]
    } as Partial<MapAuthoringDocument>);

    assert.equal(document.version, 1);
    assert.equal(document.guideId, 'JPN-USAA-TEM-001');
    assert.equal(document.pins.length, 1);
    assert.equal(document.pins[0].id, '001');
    assert.equal(document.traversableRegions.length, 1);
    assert.equal(document.traversableRegions[0].id, '001');
    assert.equal(document.calibration, null);
    assert.equal(typeof document.updatedAt, 'string');
});

test('buildRuntimePinsFromAuthoringDocument preserves geo projection', () => {
    const document = normalizeMapAuthoringDocument({
        guideId: 'JPN-USAA-TEM-001',
        calibration: {
            method: 'corner-bilinear',
            points: [
                { id: 'topLeft', x: 0, y: 0, lat: 35.0, lng: 139.0 },
                { id: 'topRight', x: 1, y: 0, lat: 35.0, lng: 140.0 },
                { id: 'bottomRight', x: 1, y: 1, lat: 34.0, lng: 140.0 },
                { id: 'bottomLeft', x: 0, y: 1, lat: 34.0, lng: 139.0 }
            ],
            transform: {
                topLeft: { lat: 35.0, lng: 139.0 },
                topRight: { lat: 35.0, lng: 140.0 },
                bottomRight: { lat: 34.0, lng: 140.0 },
                bottomLeft: { lat: 34.0, lng: 139.0 }
            }
        },
        pins: [{ id: '001', x: 0.25, y: 0.75 }],
        traversableRegions: []
    });

    const runtimePins = buildRuntimePinsFromAuthoringDocument(document);
    assert.equal(runtimePins.length, 1);
    assert.equal(runtimePins[0].geoPosition?.lat, 34.25);
    assert.equal(runtimePins[0].geoPosition?.lng, 139.25);
});

test('isMapAuthoringEnabledGuide includes both USAA and BEPU', () => {
    assert.equal(isMapAuthoringEnabledGuide('JPN-USAA-TEM-001'), true);
    assert.equal(isMapAuthoringEnabledGuide('jpn-bepu-mus-001'), true);
    assert.equal(isMapAuthoringEnabledGuide('JPN-OITA-MUS-003'), false);
});

test('getMapAuthoringPublicUrl points at the public Firebase Storage object', () => {
    assert.equal(getMapAuthoringObjectPath('JPN-USAA-TEM-001'), 'maps/JPN-USAA-TEM-001-map-authoring.json');
    assert.equal(
        getMapAuthoringPublicUrl('JPN-USAA-TEM-001'),
        'https://storage.googleapis.com/laxy-guide-dev.firebasestorage.app/maps/JPN-USAA-TEM-001-map-authoring.json'
    );
    assert.equal(getMapTileBundleObjectPath('JPN-USAA-TEM-001'), 'maps/JPN-USAA-TEM-001-map-tiles.zip');
    assert.equal(
        getMapTileBundlePublicUrl('JPN-USAA-TEM-001'),
        'https://storage.googleapis.com/laxy-guide-dev.firebasestorage.app/maps/JPN-USAA-TEM-001-map-tiles.zip?v=layered-v2'
    );
});

test('fetchMapAuthoringJson reads the public Firebase Storage object directly', async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        calls.push(url);

        return new Response(JSON.stringify({
            version: 1,
            guideId: 'JPN-USAA-TEM-001',
            updatedAt: '2026-06-25T10:10:00.000Z',
            calibration: null,
            pins: [],
            traversableRegions: []
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }) as typeof fetch;

    try {
        const document = await fetchMapAuthoringJson('JPN-USAA-TEM-001');
        assert.ok(document);
        assert.equal(document.guideId, 'JPN-USAA-TEM-001');
        assert.deepEqual(calls, [
            'https://storage.googleapis.com/laxy-guide-dev.firebasestorage.app/maps/JPN-USAA-TEM-001-map-authoring.json'
        ]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
