import type { GuideData, GeoCalibration, TraversableRegion } from '../types';
import type { ResolvedMapTileBundle } from './mapTileBundle.ts';
import { normalizeTraversableRegionsForRuntime, type RuntimeTraversableRegionSet } from './traversableRegions.ts';

export interface GuideMapRuntimeGeometry {
    mapImage?: string;
    mapPixelWidth?: number;
    mapPixelHeight?: number;
    mapTileMaxZoom?: number;
    mapTileUrlTemplate?: string;
}

export function resolveGuideMapRuntimeGeometry(params: {
    guideData: Pick<GuideData, 'mapImage' | 'mapPixelWidth' | 'mapPixelHeight' | 'mapTileMaxZoom' | 'mapTileUrlTemplate'>;
    mapTileBundle?: ResolvedMapTileBundle | null;
}): GuideMapRuntimeGeometry {
    const { guideData, mapTileBundle } = params;

    if (mapTileBundle) {
        return {
            mapImage: mapTileBundle.mapImageUrl ?? guideData.mapImage,
            mapPixelWidth: mapTileBundle.manifest.mapPixelWidth,
            mapPixelHeight: mapTileBundle.manifest.mapPixelHeight,
            mapTileMaxZoom: mapTileBundle.manifest.mapTileMaxZoom,
            mapTileUrlTemplate: mapTileBundle.manifest.tilePathTemplate
        };
    }

    return {
        mapImage: guideData.mapImage,
        mapPixelWidth: guideData.mapPixelWidth,
        mapPixelHeight: guideData.mapPixelHeight,
        mapTileMaxZoom: guideData.mapTileMaxZoom,
        mapTileUrlTemplate: guideData.mapTileUrlTemplate
    };
}

export function buildGuideMapRuntimeTraversableRegionSet(params: {
    guideData: Pick<GuideData, 'mapImage' | 'mapPixelWidth' | 'mapPixelHeight' | 'mapTileMaxZoom' | 'mapTileUrlTemplate'>;
    mapTileBundle?: ResolvedMapTileBundle | null;
    geoCalibration: GeoCalibration | null;
    traversableRegions: TraversableRegion[];
}): RuntimeTraversableRegionSet {
    const geometry = resolveGuideMapRuntimeGeometry({
        guideData: params.guideData,
        mapTileBundle: params.mapTileBundle
    });

    if (!geometry.mapPixelWidth || !geometry.mapPixelHeight) {
        return { normalizedRegions: [], geoRegions: [] };
    }

    return normalizeTraversableRegionsForRuntime(
        params.traversableRegions,
        params.geoCalibration,
        geometry.mapPixelWidth,
        geometry.mapPixelHeight,
        geometry.mapTileMaxZoom ?? 5
    );
}
