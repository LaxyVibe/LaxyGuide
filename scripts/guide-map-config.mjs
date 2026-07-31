export const guideMapConfig = {
    'JPN-USAA-TEM-001': {
        baseSourceImagePath: 'src/assets/map/JPN-USAA-TEM-001/map-base.png',
        labelSourceImagePaths: {
            'ja-JP': 'src/assets/map/JPN-USAA-TEM-001/map-labels.ja-JP.png'
        },
        publicMapImagePath: 'maps/JPN-USAA-TEM-001.webp',
        tileOutputDir: 'maps/JPN-USAA-TEM-001',
        bundleOutputDir: 'bundles/JPN-USAA-TEM-001',
        mapTileMaxZoom: 5
    },
    'JPN-BEPU-MUS-001': {
        tileOutputDir: 'maps/JPN-BEPU-MUS-001',
        bundleOutputDir: 'bundles/JPN-BEPU-MUS-001',
        mapTileMaxZoom: 5
    }
};

export function getGuideMapConfig(guideId) {
    return guideMapConfig[String(guideId || '').trim().toUpperCase()] ?? null;
}

export function getGuideMapSourceImagePath(guideId, overrideSourceImagePath) {
    const normalizedOverride = String(overrideSourceImagePath || '').trim();
    if (normalizedOverride) {
        return normalizedOverride;
    }

    const config = getGuideMapConfig(guideId);
    return config?.baseSourceImagePath ?? config?.sourceImagePath ?? null;
}
