import test from 'node:test';
import assert from 'node:assert/strict';
import type { MapPinsFile } from '../src/types/index.ts';
import {
    areAllPoiRegionsReady,
    buildNormalizedPoiRegions,
    normalizePoiPinsForEditor,
    resolvePinPolygonNormalized,
    updatePoiPolygonForEditor
} from '../src/utils/mapPoiRegions.ts';
import { projectNormalizedPointToSimpleMap } from '../src/utils/traversableRegions.ts';

const guideId = 'JPN-USAA-TEM-001';
const geometry = {
    mapPixelWidth: 4019,
    mapPixelHeight: 3625,
    mapTileMaxZoom: 5
};
const normalizedPolygon = [
    { x: 0.2, y: 0.25 },
    { x: 0.4, y: 0.25 },
    { x: 0.35, y: 0.45 }
];

test('normalizePoiPinsForEditor projects canonical normalized regions for the active map geometry', () => {
    const file: MapPinsFile = {
        version: 2,
        guideId,
        pins: [{
            id: '001',
            x: 0.3,
            y: 0.3,
            polygonNormalized: normalizedPolygon,
            polygon: normalizedPolygon.map((point) => projectNormalizedPointToSimpleMap(point, 2048, 2048, 5))
        }]
    };

    const normalized = normalizePoiPinsForEditor(file, geometry);
    assert.deepEqual(normalized.pins[0].polygonNormalized, normalizedPolygon);
    assert.deepEqual(
        normalized.pins[0].polygon,
        normalizedPolygon.map((point) => projectNormalizedPointToSimpleMap(
            point,
            geometry.mapPixelWidth,
            geometry.mapPixelHeight,
            geometry.mapTileMaxZoom
        ))
    );
});

test('updatePoiPolygonForEditor stores one normalized polygon for the selected POI', () => {
    const polygon = normalizedPolygon.map((point) => projectNormalizedPointToSimpleMap(
        point,
        geometry.mapPixelWidth,
        geometry.mapPixelHeight,
        geometry.mapTileMaxZoom
    ));
    const file: MapPinsFile = {
        version: 2,
        guideId,
        pins: [
            { id: '001', x: 0.3, y: 0.3 },
            { id: '002', x: 0.6, y: 0.6 }
        ]
    };

    const updated = updatePoiPolygonForEditor({
        file,
        guideId,
        pinId: '001',
        polygon,
        geometry
    });

    assert.deepEqual(updated.pins[0].polygon, polygon);
    assert.deepEqual(updated.pins[0].polygonNormalized, normalizedPolygon);
    assert.equal(updated.pins[1].polygonNormalized, undefined);
});

test('resolvePinPolygonNormalized migrates a valid legacy Leaflet polygon', () => {
    const polygon = normalizedPolygon.map((point) => projectNormalizedPointToSimpleMap(
        point,
        geometry.mapPixelWidth,
        geometry.mapPixelHeight,
        geometry.mapTileMaxZoom
    ));

    assert.deepEqual(
        resolvePinPolygonNormalized({ id: '001', x: 0.3, y: 0.3, polygon }, geometry),
        normalizedPolygon
    );
});

test('region interaction becomes ready only when every POI has a valid polygon', () => {
    const completePins = [
        { id: '001', x: 0.3, y: 0.3, polygonNormalized: normalizedPolygon },
        { id: '002', x: 0.6, y: 0.6, polygonNormalized: normalizedPolygon }
    ];

    assert.equal(areAllPoiRegionsReady(completePins, geometry), true);
    assert.equal(areAllPoiRegionsReady([...completePins, { id: '003', x: 0.8, y: 0.8 }], geometry), false);
    assert.equal(buildNormalizedPoiRegions(completePins, geometry).length, 2);
});

test('invalid and out-of-bounds polygons do not activate region interaction', () => {
    const invalidPins = [{
        id: '001',
        x: 0.3,
        y: 0.3,
        polygonNormalized: [
            { x: 0.2, y: 0.2 },
            { x: 0.4, y: 0.4 },
            { x: 1.2, y: 0.5 }
        ]
    }];

    assert.equal(resolvePinPolygonNormalized(invalidPins[0], geometry).length, 0);
    assert.equal(areAllPoiRegionsReady(invalidPins, geometry), false);

    assert.equal(resolvePinPolygonNormalized({
        id: '002',
        x: 0.5,
        y: 0.5,
        polygonNormalized: [
            { x: 0.1, y: 0.1 },
            { x: 0.2, y: 0.2 },
            { x: 0.3, y: 0.3 }
        ]
    }, geometry).length, 0);
});
