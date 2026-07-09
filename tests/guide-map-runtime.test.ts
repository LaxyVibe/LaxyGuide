import test from 'node:test';
import assert from 'node:assert/strict';
import type { GuideData, TraversableRegion } from '../src/types/index.ts';
import type { ResolvedMapTileBundle } from '../src/utils/mapTileBundle.ts';
import { buildGuideMapRuntimeTraversableRegionSet } from '../src/utils/guideMapRuntime.ts';

const traversableRegion: TraversableRegion = {
    id: '001',
    polygon: [
        { lat: -96.74459202273093, lng: 117.75 },
        { lat: -98.6198935828017, lng: 78 },
        { lat: -89.86848630247145, lng: 73.75 }
    ],
    polygonNormalized: [
        { x: 0.9457831325301205, y: 0.8540212261316937 },
        { x: 0.6265060240963856, y: 0.870575612317146 },
        { x: 0.5923694779116466, y: 0.7933218101183687 }
    ],
    geoPolygon: [
        { lat: 33.527810405728985, lng: 131.37250260967815 },
        { lat: 33.52792437899939, lng: 131.3754461913312 },
        { lat: 33.527387138716065, lng: 131.3757614228395 }
    ]
};

test('buildGuideMapRuntimeTraversableRegionSet falls back to tile bundle geometry when guide data omits dimensions', () => {
    const guideData: GuideData = {
        guideTitle: 'Test Guide',
        guideUnderlayImage: '',
        mapTileBundleUrl: 'https://example.com/bundle.zip',
        pois: []
    };

    const mapTileBundle: ResolvedMapTileBundle = {
        manifest: {
            schemaVersion: 1,
            guideId: 'JPN-USAA-TEM-001',
            mapPixelWidth: 3984,
            mapPixelHeight: 3625,
            mapTileMaxZoom: 5,
            tilePathTemplate: 'tiles/{z}/{x}/{y}.webp'
        },
        tileUrlByPath: {}
    };

    const runtime = buildGuideMapRuntimeTraversableRegionSet({
        guideData,
        mapTileBundle,
        geoCalibration: null,
        traversableRegions: [traversableRegion]
    });

    assert.equal(runtime.normalizedRegions.length, 1);
    assert.equal(runtime.geoRegions.length, 1);
    assert.deepEqual(runtime.normalizedRegions[0].polygon, traversableRegion.polygonNormalized);
    assert.deepEqual(runtime.geoRegions[0].polygon, traversableRegion.geoPolygon);
});
