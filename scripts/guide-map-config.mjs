export const guideMapConfig = {
    'JPN-USAA-TEM-001': {
        sourceImagePath: 'src/assets/map/usaa.webp',
        publicMapImagePath: 'maps/JPN-USAA-TEM-001.webp',
        tileOutputDir: 'maps/JPN-USAA-TEM-001',
        bundleOutputDir: 'bundles/JPN-USAA-TEM-001',
        mapTileMaxZoom: 5
    }
};

export function getGuideMapConfig(guideId) {
    return guideMapConfig[String(guideId || '').trim().toUpperCase()] ?? null;
}
