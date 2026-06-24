import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRuntimePinsFromAuthoringDocument, normalizeMapAuthoringDocument } from '../src/utils/mapDrawData.ts';
import type { MapAuthoringDocument } from '../src/types/index.ts';

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
