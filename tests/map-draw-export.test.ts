import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMapDrawExportPayload } from '../src/utils/mapDrawExport.ts';
import type { GeoCalibration, MapPin, TraversableRegion } from '../src/types/index.ts';

function assertGeoPointAlmostEqual(
    actual: { lat: number; lng: number },
    expected: { lat: number; lng: number }
) {
    assert.ok(Math.abs(actual.lat - expected.lat) < 1e-9, `lat mismatch: ${actual.lat} vs ${expected.lat}`);
    assert.ok(Math.abs(actual.lng - expected.lng) < 1e-9, `lng mismatch: ${actual.lng} vs ${expected.lng}`);
}

test('buildMapDrawExportPayload preserves the draw export schema', () => {
    const calibration: GeoCalibration = {
        method: 'corner-bilinear',
        points: [],
        transform: {
            topLeft: { lat: 35.0, lng: 139.0 },
            topRight: { lat: 35.0, lng: 140.0 },
            bottomRight: { lat: 34.0, lng: 140.0 },
            bottomLeft: { lat: 34.0, lng: 139.0 }
        },
        createdAt: '2026-06-22T00:00:00.000Z'
    };

    const traversableRegions: TraversableRegion[] = [
        {
            id: 'region-a',
            polygon: [],
            polygonNormalized: [
                { x: 0.1, y: 0.2 },
                { x: 0.3, y: 0.2 },
                { x: 0.3, y: 0.4 }
            ]
        },
        {
            id: 'region-b',
            polygon: [],
            geoPolygon: [
                { lat: 35.2, lng: 139.2 },
                { lat: 35.3, lng: 139.3 },
                { lat: 35.4, lng: 139.4 }
            ]
        },
        {
            id: 'region-c',
            polygon: []
        }
    ];

    const pins: MapPin[] = [
        {
            id: '001',
            x: 0.25,
            y: 0.75,
            polygon: [
                { lat: 35.01, lng: 139.01 },
                { lat: 35.02, lng: 139.02 },
                { lat: 35.03, lng: 139.03 }
            ]
        },
        {
            id: '002',
            x: 0.5,
            y: 0.5
        }
    ];

    const payload = buildMapDrawExportPayload({
        guideId: 'JPN-USAA-TEM-001',
        calibration,
        traversableRegions,
        pins
    });

    assert.equal(payload.version, 3);
    assert.equal(payload.guideId, 'JPN-USAA-TEM-001');
    assert.deepEqual(payload.mapTileCorners, calibration.transform);
    assert.equal(payload.traversableRegions.length, 2);
    assert.equal(payload.traversableRegions[0].id, 'region-a');
    assert.equal(payload.traversableRegions[0].polygon.length, 3);
    assertGeoPointAlmostEqual(payload.traversableRegions[0].polygon[0], { lat: 34.8, lng: 139.1 });
    assertGeoPointAlmostEqual(payload.traversableRegions[0].polygon[1], { lat: 34.8, lng: 139.3 });
    assertGeoPointAlmostEqual(payload.traversableRegions[0].polygon[2], { lat: 34.6, lng: 139.3 });
    assert.deepEqual(payload.traversableRegions[1], {
        id: 'region-b',
        polygon: [
            { lat: 35.2, lng: 139.2 },
            { lat: 35.3, lng: 139.3 },
            { lat: 35.4, lng: 139.4 }
        ]
    });
    assert.equal(payload.pins.length, 2);
    assert.equal(payload.pins[0].id, '001');
    assert.equal(payload.pins[0].pinDisplayPosition.x, 0.25);
    assert.equal(payload.pins[0].pinDisplayPosition.y, 0.75);
    assertGeoPointAlmostEqual(payload.pins[0].pinDisplayPosition.geoPosition!, { lat: 34.25, lng: 139.25 });
    assert.deepEqual(payload.pins[0].region.polygon, [
        { lat: 35.01, lng: 139.01 },
        { lat: 35.02, lng: 139.02 },
        { lat: 35.03, lng: 139.03 }
    ]);
    assert.equal(payload.pins[1].id, '002');
    assert.equal(payload.pins[1].pinDisplayPosition.x, 0.5);
    assert.equal(payload.pins[1].pinDisplayPosition.y, 0.5);
    assertGeoPointAlmostEqual(payload.pins[1].pinDisplayPosition.geoPosition!, { lat: 34.5, lng: 139.5 });
    assert.deepEqual(payload.pins[1].region.polygon, []);
});
