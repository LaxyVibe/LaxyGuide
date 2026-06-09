import type { TraversableRegion } from '../types';
import { haversineDistanceMeters, type GeoPoint } from './geoTransform';

const toRad = (value: number) => (value * Math.PI) / 180;

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
