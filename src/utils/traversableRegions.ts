import type { TraversableRegion } from '../types';
import { haversineDistanceMeters, type GeoPoint } from './geoTransform';

const toRad = (value: number) => (value * Math.PI) / 180;

export interface NormalizedTraversablePoint {
    x: number;
    y: number;
}

export interface NormalizedTraversableRegion {
    id: string;
    polygon: NormalizedTraversablePoint[];
}

const isValidPolygon = (polygon: Array<{ lat: number; lng: number }> | undefined): polygon is Array<{ lat: number; lng: number }> => {
    return Array.isArray(polygon) && polygon.length >= 3;
};

function isPointInPolygon(point: GeoPoint, polygon: Array<{ lat: number; lng: number }>) {
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lng;
        const yi = polygon[i].lat;
        const xj = polygon[j].lng;
        const yj = polygon[j].lat;

        const intersects = ((yi > point.lat) !== (yj > point.lat))
            && (point.lng < ((xj - xi) * (point.lat - yi)) / ((yj - yi) || Number.EPSILON) + xi);

        if (intersects) inside = !inside;
    }

    return inside;
}

function nearestPointOnSegment(point: GeoPoint, start: GeoPoint, end: GeoPoint): GeoPoint {
    const scaleX = Math.cos(toRad((point.lat + start.lat + end.lat) / 3));
    const ax = start.lng * scaleX;
    const ay = start.lat;
    const bx = end.lng * scaleX;
    const by = end.lat;
    const px = point.lng * scaleX;
    const py = point.lat;

    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= Number.EPSILON) return { lat: start.lat, lng: start.lng };

    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
    return {
        lat: start.lat + (end.lat - start.lat) * t,
        lng: start.lng + (end.lng - start.lng) * t
    };
}

function nearestPointOnSegmentWithRatio(point: GeoPoint, start: GeoPoint, end: GeoPoint) {
    const scaleX = Math.cos(toRad((point.lat + start.lat + end.lat) / 3));
    const ax = start.lng * scaleX;
    const ay = start.lat;
    const bx = end.lng * scaleX;
    const by = end.lat;
    const px = point.lng * scaleX;
    const py = point.lat;

    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= Number.EPSILON) {
        return {
            point: { lat: start.lat, lng: start.lng },
            t: 0
        };
    }

    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
    return {
        point: {
            lat: start.lat + (end.lat - start.lat) * t,
            lng: start.lng + (end.lng - start.lng) * t
        },
        t
    };
}

function isValidNormalizedPolygon(polygon: NormalizedTraversablePoint[] | undefined): polygon is NormalizedTraversablePoint[] {
    return Array.isArray(polygon) && polygon.length >= 3;
}

function isPointInNormalizedPolygon(point: NormalizedTraversablePoint, polygon: NormalizedTraversablePoint[]) {
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;

        const intersects = ((yi > point.y) !== (yj > point.y))
            && (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || Number.EPSILON) + xi);

        if (intersects) inside = !inside;
    }

    return inside;
}

function nearestNormalizedPointOnSegment(
    point: NormalizedTraversablePoint,
    start: NormalizedTraversablePoint,
    end: NormalizedTraversablePoint
) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= Number.EPSILON) return { x: start.x, y: start.y };

    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
    return {
        x: start.x + dx * t,
        y: start.y + dy * t
    };
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function projectSimpleMapPointToNormalized(
    point: { lat: number; lng: number },
    mapPixelWidth: number,
    mapPixelHeight: number,
    mapTileMaxZoom: number
): NormalizedTraversablePoint {
    const scale = 256 * 2 ** mapTileMaxZoom;
    return {
        x: clamp01((point.lng * scale) / mapPixelWidth),
        y: clamp01((-point.lat * scale) / mapPixelHeight)
    };
}

export function projectTraversableRegionsToNormalized(
    regions: TraversableRegion[],
    mapPixelWidth: number,
    mapPixelHeight: number,
    mapTileMaxZoom: number
) {
    return regions
        .map((region) => ({
            id: region.id,
            polygon: region.polygon.map((point) => projectSimpleMapPointToNormalized(point, mapPixelWidth, mapPixelHeight, mapTileMaxZoom))
        }))
        .filter((region): region is NormalizedTraversableRegion => isValidNormalizedPolygon(region.polygon));
}

export function hasTraversableRegions(regions: TraversableRegion[]) {
    return regions.some((region) => isValidPolygon(region.polygon));
}

export function isPointInsideTraversableRegions(point: GeoPoint, regions: TraversableRegion[]) {
    return regions.some((region) => isValidPolygon(region.polygon) && isPointInPolygon(point, region.polygon));
}

export function clampPointToTraversableRegions(point: GeoPoint, regions: TraversableRegion[]) {
    let nearest: { point: GeoPoint; distanceMeters: number } | null = null;

    for (const region of regions) {
        if (!isValidPolygon(region.polygon)) continue;

        const polygon = region.polygon;
        for (let i = 0; i < polygon.length; i++) {
            const start = polygon[i];
            const end = polygon[(i + 1) % polygon.length];
            const candidate = nearestPointOnSegment(point, start, end);
            const distanceMeters = haversineDistanceMeters(point, candidate);
            if (!nearest || distanceMeters < nearest.distanceMeters) {
                nearest = { point: candidate, distanceMeters };
            }
        }
    }

    return nearest?.point ?? null;
}

export function clampPointToTraversableRegionsWithNormalized(
    point: GeoPoint,
    geoRegions: TraversableRegion[],
    normalizedRegions: NormalizedTraversableRegion[]
) {
    let nearest: {
        geoPoint: GeoPoint;
        normalizedPoint: NormalizedTraversablePoint;
        distanceMeters: number;
    } | null = null;

    for (const geoRegion of geoRegions) {
        if (!isValidPolygon(geoRegion.polygon)) continue;

        const normalizedRegion = normalizedRegions.find((region) => region.id === geoRegion.id);
        if (!normalizedRegion || !isValidNormalizedPolygon(normalizedRegion.polygon)) continue;
        if (normalizedRegion.polygon.length !== geoRegion.polygon.length) continue;

        for (let i = 0; i < geoRegion.polygon.length; i++) {
            const geoStart = geoRegion.polygon[i];
            const geoEnd = geoRegion.polygon[(i + 1) % geoRegion.polygon.length];
            const normalizedStart = normalizedRegion.polygon[i];
            const normalizedEnd = normalizedRegion.polygon[(i + 1) % normalizedRegion.polygon.length];
            const candidate = nearestPointOnSegmentWithRatio(point, geoStart, geoEnd);
            const distanceMeters = haversineDistanceMeters(point, candidate.point);
            if (!nearest || distanceMeters < nearest.distanceMeters) {
                nearest = {
                    geoPoint: candidate.point,
                    normalizedPoint: {
                        x: normalizedStart.x + (normalizedEnd.x - normalizedStart.x) * candidate.t,
                        y: normalizedStart.y + (normalizedEnd.y - normalizedStart.y) * candidate.t
                    },
                    distanceMeters
                };
            }
        }
    }

    return nearest;
}

export function hasNormalizedTraversableRegions(regions: NormalizedTraversableRegion[]) {
    return regions.some((region) => isValidNormalizedPolygon(region.polygon));
}

export function isPointInsideNormalizedTraversableRegions(point: NormalizedTraversablePoint, regions: NormalizedTraversableRegion[]) {
    return regions.some((region) => isValidNormalizedPolygon(region.polygon) && isPointInNormalizedPolygon(point, region.polygon));
}

export function clampPointToNormalizedTraversableRegions(
    point: NormalizedTraversablePoint,
    regions: NormalizedTraversableRegion[]
) {
    let nearest: { point: NormalizedTraversablePoint; distanceSquared: number } | null = null;

    for (const region of regions) {
        if (!isValidNormalizedPolygon(region.polygon)) continue;

        const polygon = region.polygon;
        for (let i = 0; i < polygon.length; i++) {
            const start = polygon[i];
            const end = polygon[(i + 1) % polygon.length];
            const candidate = nearestNormalizedPointOnSegment(point, start, end);
            const distanceSquared = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2;
            if (!nearest || distanceSquared < nearest.distanceSquared) {
                nearest = { point: candidate, distanceSquared };
            }
        }
    }

    return nearest?.point ?? null;
}
