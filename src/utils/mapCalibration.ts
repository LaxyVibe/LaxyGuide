import type { GeoCalibration } from '../types/index.ts';
import { transformNormalizedPoint, type GeoPoint } from './geoTransform.ts';

export type CornerKey = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';
export type CalibrationDraftCorners = Partial<Record<CornerKey, GeoPoint>>;

export const CORNER_ORDER: CornerKey[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
export const CORNER_LABEL: Record<CornerKey, string> = {
    topLeft: 'Top Left',
    topRight: 'Top Right',
    bottomRight: 'Bottom Right',
    bottomLeft: 'Bottom Left'
};
export const CORNER_IMAGE_COORDINATES: Record<CornerKey, { x: number; y: number }> = {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 1, y: 0 },
    bottomRight: { x: 1, y: 1 },
    bottomLeft: { x: 0, y: 1 }
};

export function getCalibrationDraftCorners(calibration: GeoCalibration | null): CalibrationDraftCorners {
    if (!calibration) return {};

    return {
        topLeft: transformNormalizedPoint(calibration.transform, CORNER_IMAGE_COORDINATES.topLeft),
        topRight: transformNormalizedPoint(calibration.transform, CORNER_IMAGE_COORDINATES.topRight),
        bottomRight: transformNormalizedPoint(calibration.transform, CORNER_IMAGE_COORDINATES.bottomRight),
        bottomLeft: transformNormalizedPoint(calibration.transform, CORNER_IMAGE_COORDINATES.bottomLeft)
    };
}

export function formatCalibrationCornerStatus(key: CornerKey, corners: CalibrationDraftCorners): string {
    const point = corners[key];
    if (!point) {
        return `${CORNER_LABEL[key]}: Pending`;
    }

    return `${CORNER_LABEL[key]}: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}
