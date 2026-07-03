import test from 'node:test';
import assert from 'node:assert/strict';
import type { TraversableRegionsFile } from '../src/types/index.ts';
import { projectNormalizedPointToSimpleMap } from '../src/utils/traversableRegions.ts';
import {
    normalizeTraversableRegionsForEditor,
    updateTraversableRegionPolygonForEditor
} from '../src/utils/mapDrawTraversableRegions.ts';

const guideId = 'JPN-USAA-TEM-001';
const activeGeometry = {
    mapPixelWidth: 4096,
    mapPixelHeight: 2048,
    mapTileMaxZoom: 5
};

const legacyGeometry = {
    mapPixelWidth: 2048,
    mapPixelHeight: 2048,
    mapTileMaxZoom: 5
};

const normalizedPolygon = [
    { x: 0.25, y: 0.2 },
    { x: 0.6, y: 0.2 },
    { x: 0.6, y: 0.55 }
];

test('normalizeTraversableRegionsForEditor prefers saved normalized polygons over stale raw polygons', () => {
    const file: TraversableRegionsFile = {
        version: 1,
        guideId,
        regions: [
            {
                id: '001',
                polygon: normalizedPolygon.map((point) => projectNormalizedPointToSimpleMap(
                    point,
                    legacyGeometry.mapPixelWidth,
                    legacyGeometry.mapPixelHeight,
                    legacyGeometry.mapTileMaxZoom
                )),
                polygonNormalized: normalizedPolygon
            }
        ]
    };

    const normalized = normalizeTraversableRegionsForEditor(file, activeGeometry);
    assert.deepEqual(normalized.regions[0].polygonNormalized, normalizedPolygon);
    assert.deepEqual(
        normalized.regions[0].polygon,
        normalizedPolygon.map((point) => projectNormalizedPointToSimpleMap(
            point,
            activeGeometry.mapPixelWidth,
            activeGeometry.mapPixelHeight,
            activeGeometry.mapTileMaxZoom
        ))
    );
});

test('updateTraversableRegionPolygonForEditor normalizes drawn polygons with the active tile geometry', () => {
    const polygon = normalizedPolygon.map((point) => projectNormalizedPointToSimpleMap(
        point,
        activeGeometry.mapPixelWidth,
        activeGeometry.mapPixelHeight,
        activeGeometry.mapTileMaxZoom
    ));

    const updated = updateTraversableRegionPolygonForEditor({
        file: {
            version: 1,
            guideId,
            regions: [
                {
                    id: '001',
                    polygon: [],
                    polygonNormalized: [],
                    geoPolygon: []
                }
            ]
        },
        guideId,
        regionId: '001',
        polygon,
        geometry: activeGeometry
    });

    assert.deepEqual(updated.regions[0].polygon, polygon);
    assert.deepEqual(updated.regions[0].polygonNormalized, normalizedPolygon);
    assert.equal(updated.regions[0].geoPolygon, undefined);
});
