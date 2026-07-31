import type { MapPin, MapPinsFile } from '../types';
import {
    projectNormalizedPointToSimpleMap,
    projectSimpleMapPointToNormalizedUnclamped
} from './traversableRegions.ts';

export interface MapPoiRegionGeometry {
    mapPixelWidth: number;
    mapPixelHeight: number;
    mapTileMaxZoom?: number;
}

export interface NormalizedPoiRegion {
    id: string;
    polygon: Array<{ x: number; y: number }>;
}

function isValidGeometry(
    geometry: MapPoiRegionGeometry | null | undefined
): geometry is MapPoiRegionGeometry {
    return Boolean(
        geometry
        && Number.isFinite(geometry.mapPixelWidth)
        && geometry.mapPixelWidth > 0
        && Number.isFinite(geometry.mapPixelHeight)
        && geometry.mapPixelHeight > 0
    );
}

function normalizeSavedPolygon(pin: MapPin) {
    if (!Array.isArray(pin.polygonNormalized)) return [];

    const polygon = pin.polygonNormalized
        .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }));
    const isValid = polygon.every((point) => (
            Number.isFinite(point.x)
            && Number.isFinite(point.y)
            && point.x >= 0
            && point.x <= 1
            && point.y >= 0
            && point.y <= 1
    ));

    return isValid ? polygon : [];
}

function hasUsableArea(polygon: Array<{ x: number; y: number }>) {
    const distinct = new Set(polygon.map((point) => `${point.x.toFixed(10)}:${point.y.toFixed(10)}`));
    if (distinct.size < 3) return false;

    let twiceArea = 0;
    for (let index = 0; index < polygon.length; index++) {
        const current = polygon[index];
        const next = polygon[(index + 1) % polygon.length];
        twiceArea += current.x * next.y - next.x * current.y;
    }
    return Math.abs(twiceArea) > 1e-10;
}

export function resolvePinPolygonNormalized(
    pin: MapPin,
    geometry?: MapPoiRegionGeometry | null
): Array<{ x: number; y: number }> {
    const saved = normalizeSavedPolygon(pin);
    if (saved.length >= 3 && hasUsableArea(saved)) {
        return saved;
    }

    if (!isValidGeometry(geometry) || !Array.isArray(pin.polygon)) {
        return [];
    }

    const zoom = geometry.mapTileMaxZoom ?? 5;
    const migrated = pin.polygon
        .map((point) => projectSimpleMapPointToNormalizedUnclamped(
            point,
            geometry.mapPixelWidth,
            geometry.mapPixelHeight,
            zoom
        ));
    const isValid = migrated.every((point) => (
            Number.isFinite(point.x)
            && Number.isFinite(point.y)
            && point.x >= 0
            && point.x <= 1
            && point.y >= 0
            && point.y <= 1
    ));

    return isValid && migrated.length >= 3 && hasUsableArea(migrated) ? migrated : [];
}

export function normalizePoiPinsForEditor(
    file: MapPinsFile,
    geometry?: MapPoiRegionGeometry | null
): MapPinsFile {
    if (!isValidGeometry(geometry)) return file;

    const zoom = geometry.mapTileMaxZoom ?? 5;
    return {
        ...file,
        pins: file.pins.map((pin) => {
            const polygonNormalized = resolvePinPolygonNormalized(pin, geometry);
            return {
                ...pin,
                polygonNormalized: polygonNormalized.length >= 3 ? polygonNormalized : undefined,
                polygon: polygonNormalized.length >= 3
                    ? polygonNormalized.map((point) => projectNormalizedPointToSimpleMap(
                        point,
                        geometry.mapPixelWidth,
                        geometry.mapPixelHeight,
                        zoom
                    ))
                    : undefined
            };
        })
    };
}

export function updatePoiPolygonForEditor(params: {
    file: MapPinsFile;
    guideId: string;
    pinId: string;
    polygon: Array<{ lat: number; lng: number }> | undefined;
    geometry: MapPoiRegionGeometry;
}): MapPinsFile {
    const { file, geometry, guideId, pinId, polygon } = params;
    const zoom = geometry.mapTileMaxZoom ?? 5;
    const polygonNormalized = (polygon ?? [])
        .map((point) => projectSimpleMapPointToNormalizedUnclamped(
            point,
            geometry.mapPixelWidth,
            geometry.mapPixelHeight,
            zoom
        ));
    const isInBounds = polygonNormalized.every((point) => (
            Number.isFinite(point.x)
            && Number.isFinite(point.y)
            && point.x >= 0
            && point.x <= 1
            && point.y >= 0
            && point.y <= 1
    ));
    const validPolygon = isInBounds && polygonNormalized.length >= 3 && hasUsableArea(polygonNormalized);

    return {
        ...file,
        guideId,
        version: 2,
        pins: file.pins.map((pin) => (
            pin.id === pinId
                ? {
                    ...pin,
                    polygon: validPolygon ? polygon : undefined,
                    polygonNormalized: validPolygon ? polygonNormalized : undefined
                }
                : pin
        ))
    };
}

export function buildNormalizedPoiRegions(
    pins: MapPin[],
    geometry?: MapPoiRegionGeometry | null
): NormalizedPoiRegion[] {
    return pins.flatMap((pin) => {
        const polygon = resolvePinPolygonNormalized(pin, geometry);
        return polygon.length >= 3 ? [{ id: pin.id, polygon }] : [];
    });
}
