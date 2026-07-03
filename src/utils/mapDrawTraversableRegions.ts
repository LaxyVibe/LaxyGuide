import type { TraversableRegion, TraversableRegionsFile } from '../types';
import {
    projectNormalizedPointToSimpleMap,
    projectSimpleMapPointToNormalizedUnclamped
} from './traversableRegions.ts';

export interface MapDrawTraversableGeometry {
    mapPixelWidth: number;
    mapPixelHeight: number;
    mapTileMaxZoom?: number;
}

function isValidGeometry(geometry: MapDrawTraversableGeometry | null | undefined): geometry is MapDrawTraversableGeometry {
    return Boolean(
        geometry
        && Number.isFinite(geometry.mapPixelWidth)
        && Number.isFinite(geometry.mapPixelHeight)
    );
}

function normalizePolygonNormalized(
    region: TraversableRegion,
    geometry: MapDrawTraversableGeometry
) {
    const zoom = geometry.mapTileMaxZoom ?? 5;
    const normalizedFromSavedField = Array.isArray(region.polygonNormalized) && region.polygonNormalized.length >= 3
        ? region.polygonNormalized
            .map((point) => ({ x: Number(point.x), y: Number(point.y) }))
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        : [];
    if (normalizedFromSavedField.length >= 3) {
        return normalizedFromSavedField;
    }

    return (region.polygon ?? [])
        .map((point) => projectSimpleMapPointToNormalizedUnclamped(
            point,
            geometry.mapPixelWidth,
            geometry.mapPixelHeight,
            zoom
        ))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function normalizeTraversableRegionsForEditor(
    file: TraversableRegionsFile,
    geometry?: MapDrawTraversableGeometry | null
): TraversableRegionsFile {
    if (!isValidGeometry(geometry)) return file;

    const zoom = geometry.mapTileMaxZoom ?? 5;

    return {
        ...file,
        regions: file.regions.map((region) => {
            const polygonNormalized = normalizePolygonNormalized(region, geometry);

            return {
                ...region,
                polygonNormalized,
                polygon: polygonNormalized.map((point) => projectNormalizedPointToSimpleMap(
                    point,
                    geometry.mapPixelWidth,
                    geometry.mapPixelHeight,
                    zoom
                ))
            };
        })
    };
}

export function updateTraversableRegionPolygonForEditor(params: {
    file: TraversableRegionsFile;
    guideId: string;
    regionId: string;
    polygon: Array<{ lat: number; lng: number }> | undefined;
    geometry: MapDrawTraversableGeometry;
}): TraversableRegionsFile {
    const { file, geometry, guideId, polygon, regionId } = params;
    const zoom = geometry.mapTileMaxZoom ?? 5;
    const polygonNormalized = (polygon ?? [])
        .map((point) => projectSimpleMapPointToNormalizedUnclamped(
            point,
            geometry.mapPixelWidth,
            geometry.mapPixelHeight,
            zoom
        ))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

    return {
        ...file,
        guideId,
        version: 1,
        regions: file.regions.map((region) => (
            region.id === regionId
                ? { ...region, polygon: polygon ?? [], polygonNormalized, geoPolygon: undefined }
                : region
        ))
    };
}
