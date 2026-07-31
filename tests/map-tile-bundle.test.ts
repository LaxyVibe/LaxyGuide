import test from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveBundledLabelTileUrl,
    resolveBundledTileUrl,
    type ResolvedMapTileBundle
} from '../src/utils/mapTileBundle.ts';

const layeredBundle: ResolvedMapTileBundle = {
    manifest: {
        schemaVersion: 2,
        guideId: 'JPN-USAA-TEM-001',
        mapPixelWidth: 4019,
        mapPixelHeight: 3625,
        mapTileMaxZoom: 5,
        tilePathTemplate: 'tiles/base/{z}/{x}/{y}.webp',
        labelTilePathTemplates: {
            'ja-JP': 'tiles/labels/ja-JP/{z}/{x}/{y}.webp'
        }
    },
    tileUrlByPath: {
        'tiles/base/5/3/4.webp': 'blob:base-tile',
        'tiles/labels/ja-JP/5/3/4.webp': 'blob:ja-label-tile'
    }
};

test('layered map bundles resolve shared base and language-specific label tiles', () => {
    assert.equal(resolveBundledTileUrl(layeredBundle, 5, 3, 4), 'blob:base-tile');
    assert.equal(
        resolveBundledLabelTileUrl(layeredBundle, 'ja-JP', 5, 3, 4),
        'blob:ja-label-tile'
    );
    assert.equal(
        resolveBundledLabelTileUrl(layeredBundle, 'JA-jp', 5, 3, 4),
        'blob:ja-label-tile'
    );
    assert.equal(resolveBundledLabelTileUrl(layeredBundle, 'en-US', 5, 3, 4), undefined);
});
