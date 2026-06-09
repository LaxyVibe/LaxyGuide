import type {
    GeoCalibration,
    GeoCalibrationAffine,
    GeoCalibrationCornerBilinear,
    GeoCalibrationCornerTransform,
    GeoCalibrationPoint,
    GeoCalibrationTransform
} from '../types';

export interface GeoPoint {
    lat: number;
    lng: number;
}

export interface NormalizedPoint {
    x: number;
    y: number;
}

export interface GeoCalibrationResult {
    calibration: GeoCalibration;
    residuals: Array<{ pointId: string; errorMeters: number }>;
}

export interface GeoCornerPoints {
    topLeft: GeoCalibrationPoint;
    topRight: GeoCalibrationPoint;
    bottomRight: GeoCalibrationPoint;
    bottomLeft: GeoCalibrationPoint;
}

const EARTH_RADIUS_METERS = 6371000;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const toRad = (value: number) => (value * Math.PI) / 180;

export function haversineDistanceMeters(a: GeoPoint, b: GeoPoint) {
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

function solve3x3(matrix: number[][], vector: number[]): [number, number, number] | null {
    const augmented = matrix.map((row, rowIndex) => [...row, vector[rowIndex]]);

    for (let pivot = 0; pivot < 3; pivot++) {
        let maxRow = pivot;
        for (let row = pivot + 1; row < 3; row++) {
            if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[maxRow][pivot])) {
                maxRow = row;
            }
        }

        if (Math.abs(augmented[maxRow][pivot]) < 1e-12) return null;

        if (maxRow !== pivot) {
            const tmp = augmented[pivot];
            augmented[pivot] = augmented[maxRow];
            augmented[maxRow] = tmp;
        }

        const pivotValue = augmented[pivot][pivot];
        for (let col = pivot; col < 4; col++) {
            augmented[pivot][col] /= pivotValue;
        }

        for (let row = 0; row < 3; row++) {
            if (row === pivot) continue;
            const factor = augmented[row][pivot];
            for (let col = pivot; col < 4; col++) {
                augmented[row][col] -= factor * augmented[pivot][col];
            }
        }
    }

    return [augmented[0][3], augmented[1][3], augmented[2][3]];
}

function fitAffineCoefficients(points: GeoCalibrationPoint[], selector: (point: GeoCalibrationPoint) => number): [number, number, number] | null {
    if (points.length < 3) return null;

    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    let sumXY = 0;
    let sumYY = 0;
    let sumT = 0;
    let sumXT = 0;
    let sumYT = 0;

    for (const point of points) {
        const target = selector(point);
        if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y) || !isFiniteNumber(target)) return null;
        sumX += point.x;
        sumY += point.y;
        sumXX += point.x * point.x;
        sumXY += point.x * point.y;
        sumYY += point.y * point.y;
        sumT += target;
        sumXT += point.x * target;
        sumYT += point.y * target;
    }

    const matrix = [
        [sumXX, sumXY, sumX],
        [sumXY, sumYY, sumY],
        [sumX, sumY, points.length]
    ];
    const vector = [sumXT, sumYT, sumT];
    return solve3x3(matrix, vector);
}

export function normalizeGeoCalibration(raw: unknown): GeoCalibration | null {
    if (!raw || typeof raw !== 'object') return null;

    const calibration = raw as Partial<GeoCalibration> & { points?: unknown };
    if (calibration.method !== 'affine' && calibration.method !== 'corner-bilinear') return null;
    if (!Array.isArray(calibration.points) || calibration.points.length < 1) return null;

    const points = calibration.points
        .map((point, index) => {
            const item = point as Partial<GeoCalibrationPoint>;
            if (!isFiniteNumber(item.x) || !isFiniteNumber(item.y) || !isFiniteNumber(item.lat) || !isFiniteNumber(item.lng)) {
                return null;
            }
            const normalizedPoint: GeoCalibrationPoint = {
                id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `gcp-${index + 1}`,
                x: item.x,
                y: item.y,
                lat: item.lat,
                lng: item.lng,
                label: typeof item.label === 'string' ? item.label : undefined
            };
            return normalizedPoint;
        })
        .filter((item): item is GeoCalibrationPoint => item !== null);

    if (calibration.method === 'affine') {
        if (points.length < 3) return null;
        const transform = calibration.transform as GeoCalibrationTransform | undefined;
        if (!transform || !Array.isArray(transform.lat) || !Array.isArray(transform.lng) || transform.lat.length !== 3 || transform.lng.length !== 3) {
            return null;
        }

        if (!transform.lat.every(isFiniteNumber) || !transform.lng.every(isFiniteNumber)) return null;

        const out: GeoCalibrationAffine = {
            method: 'affine',
            points,
            transform: {
                lat: [transform.lat[0], transform.lat[1], transform.lat[2]],
                lng: [transform.lng[0], transform.lng[1], transform.lng[2]]
            },
            rmsErrorMeters: isFiniteNumber(calibration.rmsErrorMeters) ? calibration.rmsErrorMeters : undefined,
            maxErrorMeters: isFiniteNumber(calibration.maxErrorMeters) ? calibration.maxErrorMeters : undefined,
            createdAt: typeof calibration.createdAt === 'string' ? calibration.createdAt : undefined,
            updatedAt: typeof calibration.updatedAt === 'string' ? calibration.updatedAt : undefined
        };
        return out;
    }

    if (points.length < 4) return null;
    const transform = calibration.transform as GeoCalibrationCornerTransform | undefined;
    if (!transform) return null;

    const keys: Array<keyof GeoCalibrationCornerTransform> = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
    for (const key of keys) {
        const p = transform[key];
        if (!p || !isFiniteNumber(p.lat) || !isFiniteNumber(p.lng)) return null;
    }

    const out: GeoCalibrationCornerBilinear = {
        method: 'corner-bilinear',
        points,
        transform: {
            topLeft: { ...transform.topLeft },
            topRight: { ...transform.topRight },
            bottomRight: { ...transform.bottomRight },
            bottomLeft: { ...transform.bottomLeft }
        },
        createdAt: typeof calibration.createdAt === 'string' ? calibration.createdAt : undefined,
        updatedAt: typeof calibration.updatedAt === 'string' ? calibration.updatedAt : undefined
    };
    return out;
}

export function buildGeoCalibration(points: GeoCalibrationPoint[]): GeoCalibrationResult | null {
    if (points.length < 3) return null;

    const latCoefficients = fitAffineCoefficients(points, (point) => point.lat);
    const lngCoefficients = fitAffineCoefficients(points, (point) => point.lng);
    if (!latCoefficients || !lngCoefficients) return null;

    const transform: GeoCalibrationTransform = {
        lat: latCoefficients,
        lng: lngCoefficients
    };

    const calibration: GeoCalibration = {
        method: 'affine',
        points: points.map((point) => ({ ...point })),
        transform,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const residuals = points.map((point) => {
        const projected = transformNormalizedPoint(transform, point);
        return {
            pointId: point.id,
            errorMeters: haversineDistanceMeters({ lat: projected.lat, lng: projected.lng }, { lat: point.lat, lng: point.lng })
        };
    });

    const rmsErrorMeters = Math.sqrt(residuals.reduce((sum, item) => sum + item.errorMeters * item.errorMeters, 0) / residuals.length);
    const maxErrorMeters = residuals.reduce((max, item) => Math.max(max, item.errorMeters), 0);

    calibration.rmsErrorMeters = rmsErrorMeters;
    calibration.maxErrorMeters = maxErrorMeters;

    return { calibration, residuals };
}

export function buildCornerBilinearCalibration(corners: GeoCornerPoints): GeoCalibrationResult {
    const orderedPoints: GeoCalibrationPoint[] = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];

    const calibration: GeoCalibrationCornerBilinear = {
        method: 'corner-bilinear',
        points: orderedPoints.map((point) => ({ ...point })),
        transform: {
            topLeft: { lat: corners.topLeft.lat, lng: corners.topLeft.lng },
            topRight: { lat: corners.topRight.lat, lng: corners.topRight.lng },
            bottomRight: { lat: corners.bottomRight.lat, lng: corners.bottomRight.lng },
            bottomLeft: { lat: corners.bottomLeft.lat, lng: corners.bottomLeft.lng }
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const residuals = orderedPoints.map((point) => ({ pointId: point.id, errorMeters: 0 }));
    return { calibration, residuals };
}

function transformCornerBilinearPoint(transform: GeoCalibrationCornerTransform, point: NormalizedPoint): GeoPoint {
    const x = Math.max(0, Math.min(1, point.x));
    const y = Math.max(0, Math.min(1, point.y));

    const wTL = (1 - x) * (1 - y);
    const wTR = x * (1 - y);
    const wBR = x * y;
    const wBL = (1 - x) * y;

    return {
        lat: transform.topLeft.lat * wTL + transform.topRight.lat * wTR + transform.bottomRight.lat * wBR + transform.bottomLeft.lat * wBL,
        lng: transform.topLeft.lng * wTL + transform.topRight.lng * wTR + transform.bottomRight.lng * wBR + transform.bottomLeft.lng * wBL
    };
}

export function transformNormalizedPoint(transform: GeoCalibration['transform'], point: NormalizedPoint): GeoPoint {
    if ('topLeft' in transform) {
        return transformCornerBilinearPoint(transform, point);
    }
    return {
        lat: transform.lat[0] * point.x + transform.lat[1] * point.y + transform.lat[2],
        lng: transform.lng[0] * point.x + transform.lng[1] * point.y + transform.lng[2]
    };
}

export function transformLatLngToNormalized(transform: GeoCalibration['transform'], point: GeoPoint): NormalizedPoint | null {
    if ('topLeft' in transform) {
        // Approximate inverse for bilinear mapping via local affine approximation around center.
        const latTransform: GeoCalibrationTransform = {
            lat: [
                (transform.topRight.lat - transform.topLeft.lat + transform.bottomRight.lat - transform.bottomLeft.lat) / 2,
                (transform.bottomLeft.lat - transform.topLeft.lat + transform.bottomRight.lat - transform.topRight.lat) / 2,
                (transform.topLeft.lat + transform.topRight.lat + transform.bottomLeft.lat + transform.bottomRight.lat) / 4
            ],
            lng: [
                (transform.topRight.lng - transform.topLeft.lng + transform.bottomRight.lng - transform.bottomLeft.lng) / 2,
                (transform.bottomLeft.lng - transform.topLeft.lng + transform.bottomRight.lng - transform.topRight.lng) / 2,
                (transform.topLeft.lng + transform.topRight.lng + transform.bottomLeft.lng + transform.bottomRight.lng) / 4
            ]
        };

        return transformLatLngToNormalized(latTransform, point);
    }

    const a = transform.lat[0];
    const b = transform.lat[1];
    const c = transform.lat[2];
    const d = transform.lng[0];
    const e = transform.lng[1];
    const f = transform.lng[2];

    const determinant = a * e - b * d;
    if (Math.abs(determinant) < 1e-12) return null;

    const x = ((point.lat - c) * e - b * (point.lng - f)) / determinant;
    const y = (a * (point.lng - f) - (point.lat - c) * d) / determinant;

    return { x, y };
}

export function getGeoCalibrationPointLabel(index: number) {
    return `GCP ${index + 1}`;
}