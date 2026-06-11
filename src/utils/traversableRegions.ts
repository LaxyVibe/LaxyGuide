import type { GeoCalibration, TraversableRegion } from '../types';
import { haversineDistanceMeters, transformNormalizedPoint, type GeoPoint } from './geoTransform';

const toRad = (value: number) => (value * Math.PI) / 180;

export interface NormalizedTraversablePoint {
    x: number;
    y: number;
}

export interface NormalizedTraversableRegion {
    id: string;
    polygon: NormalizedTraversablePoint[];
}

export interface RuntimeTraversableRegionSet {
    geoRegions: TraversableRegion[];
    normalizedRegions: NormalizedTraversableRegion[];
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

function toPlanarGeoPoint(point: GeoPoint, referenceLat: number) {
    const scaleX = Math.cos(toRad(referenceLat));
    return {
        x: point.lng * scaleX,
        y: point.lat
    };
}

function isPointOnGeoSegment(point: GeoPoint, start: GeoPoint, end: GeoPoint) {
    const referenceLat = (point.lat + start.lat + end.lat) / 3;
    const p = toPlanarGeoPoint(point, referenceLat);
    const a = toPlanarGeoPoint(start, referenceLat);
    const b = toPlanarGeoPoint(end, referenceLat);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= Number.EPSILON) {
        return {
            onSegment: Math.hypot(p.x - a.x, p.y - a.y) <= 1e-10,
            t: 0
        };
    }

    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
    if (t < -1e-9 || t > 1 + 1e-9) {
        return { onSegment: false, t };
    }

    const projectedX = a.x + dx * t;
    const projectedY = a.y + dy * t;
    const distance = Math.hypot(p.x - projectedX, p.y - projectedY);
    return {
        onSegment: distance <= 1e-10,
        t: Math.max(0, Math.min(1, t))
    };
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function projectSimpleMapPointToNormalized(
    point: { lat: number; lng: number },
    mapPixelWidth: number,
    mapPixelHeight: number,
    mapTileMaxZoom: number
): NormalizedTraversablePoint {
    const projected = projectSimpleMapPointToNormalizedUnclamped(point, mapPixelWidth, mapPixelHeight, mapTileMaxZoom);
    return {
        x: clamp01(projected.x),
        y: clamp01(projected.y)
    };
}

export function projectSimpleMapPointToNormalizedUnclamped(
    point: { lat: number; lng: number },
    mapPixelWidth: number,
    mapPixelHeight: number,
    mapTileMaxZoom: number
): NormalizedTraversablePoint {
    const scale = 256 * 2 ** mapTileMaxZoom;
    return {
        x: (point.lng * scale) / mapPixelWidth,
        y: (-point.lat * scale) / mapPixelHeight
    };
}

export function projectNormalizedPointToSimpleMap(
    point: NormalizedTraversablePoint,
    mapPixelWidth: number,
    mapPixelHeight: number,
    mapTileMaxZoom: number
) {
    const scale = 256 * 2 ** mapTileMaxZoom;
    return {
        lat: -(point.y * mapPixelHeight) / scale,
        lng: (point.x * mapPixelWidth) / scale
    };
}

export function normalizeTraversableRegionsForRuntime(
    regions: TraversableRegion[],
    calibration: GeoCalibration | null,
    mapPixelWidth: number,
    mapPixelHeight: number,
    mapTileMaxZoom: number
): RuntimeTraversableRegionSet {
    const normalizedRegions: NormalizedTraversableRegion[] = [];
    const geoRegions: TraversableRegion[] = [];

    for (const region of regions) {
        const normalizedPolygon = Array.isArray(region.polygonNormalized) && region.polygonNormalized.length >= 3
            ? region.polygonNormalized
                .map((point) => ({ x: Number(point.x), y: Number(point.y) }))
                .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
            : region.polygon
                .map((point) => projectSimpleMapPointToNormalizedUnclamped(point, mapPixelWidth, mapPixelHeight, mapTileMaxZoom))
                .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

        if (normalizedPolygon.length < 3) continue;

        normalizedRegions.push({
            id: region.id,
            polygon: normalizedPolygon
        });
        if (Array.isArray(region.geoPolygon) && region.geoPolygon.length >= 3) {
            geoRegions.push({
                id: region.id,
                polygon: region.geoPolygon,
                polygonNormalized: normalizedPolygon,
                geoPolygon: region.geoPolygon
            });
        } else if (calibration) {
            geoRegions.push({
                id: region.id,
                polygon: normalizedPolygon.map((point) => transformNormalizedPoint(calibration.transform, point)),
                polygonNormalized: normalizedPolygon
            });
        }
    }

    return {
        geoRegions,
        normalizedRegions
    };
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

export function projectGeoPointIntoNormalizedRegion(
    point: GeoPoint,
    geoRegion: TraversableRegion,
    normalizedRegion: NormalizedTraversableRegion
) {
    if (!isValidPolygon(geoRegion.polygon)) return null;
    if (!isValidNormalizedPolygon(normalizedRegion.polygon)) return null;
    if (geoRegion.polygon.length !== normalizedRegion.polygon.length) return null;

    const referenceLat = geoRegion.polygon.reduce((sum, vertex) => sum + vertex.lat, 0) / geoRegion.polygon.length;
    const source = geoRegion.polygon.map((vertex) => toPlanarGeoPoint(vertex, referenceLat));
    const target = normalizedRegion.polygon;
    const sample = toPlanarGeoPoint(point, referenceLat);

    for (let i = 0; i < source.length; i++) {
        const vertex = source[i];
        if (Math.hypot(sample.x - vertex.x, sample.y - vertex.y) <= 1e-10) {
            return {
                x: target[i].x,
                y: target[i].y
            };
        }
    }

    for (let i = 0; i < source.length; i++) {
        const next = (i + 1) % source.length;
        const onEdge = isPointOnGeoSegment(point, geoRegion.polygon[i], geoRegion.polygon[next]);
        if (onEdge.onSegment) {
            return {
                x: target[i].x + (target[next].x - target[i].x) * onEdge.t,
                y: target[i].y + (target[next].y - target[i].y) * onEdge.t
            };
        }
    }

    const vectors = source.map((vertex) => ({
        x: vertex.x - sample.x,
        y: vertex.y - sample.y
    }));
    const distances = vectors.map((vector) => Math.hypot(vector.x, vector.y));
    if (distances.some((distance) => distance <= 1e-10)) return null;

    const tanHalfAngles: number[] = [];
    for (let i = 0; i < source.length; i++) {
        const next = (i + 1) % source.length;
        const ri = vectors[i];
        const rj = vectors[next];
        const cross = ri.x * rj.y - ri.y * rj.x;
        const dot = ri.x * rj.x + ri.y * rj.y;
        tanHalfAngles[i] = cross / (distances[i] * distances[next] + dot);
    }

    const weights = source.map((_, i) => {
        const prev = (i - 1 + source.length) % source.length;
        return (tanHalfAngles[prev] + tanHalfAngles[i]) / distances[i];
    });

    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    if (!Number.isFinite(weightSum) || Math.abs(weightSum) <= Number.EPSILON) return null;

    return target.reduce(
        (acc, vertex, index) => ({
            x: acc.x + (weights[index] / weightSum) * vertex.x,
            y: acc.y + (weights[index] / weightSum) * vertex.y
        }),
        { x: 0, y: 0 }
    );
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
