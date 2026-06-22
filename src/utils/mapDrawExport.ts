import type {
    GeoCalibration,
    GeoCalibrationCornerTransform,
    MapDrawExportPayload,
    MapPin,
    TraversableRegion
} from '../types';
import { transformNormalizedPoint } from './geoTransform.ts';

const CORNER_IMAGE_COORDINATES = {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 1, y: 0 },
    bottomRight: { x: 1, y: 1 },
    bottomLeft: { x: 0, y: 1 }
} as const;

function getCalibrationCornerGeoPoints(calibration: GeoCalibration | null): GeoCalibrationCornerTransform | null {
    if (!calibration) return null;

    return {
        topLeft: transformNormalizedPoint(calibration.transform, CORNER_IMAGE_COORDINATES.topLeft),
        topRight: transformNormalizedPoint(calibration.transform, CORNER_IMAGE_COORDINATES.topRight),
        bottomRight: transformNormalizedPoint(calibration.transform, CORNER_IMAGE_COORDINATES.bottomRight),
        bottomLeft: transformNormalizedPoint(calibration.transform, CORNER_IMAGE_COORDINATES.bottomLeft)
    };
}

export function buildMapDrawExportPayload(params: {
    guideId: string;
    calibration: GeoCalibration | null;
    traversableRegions: TraversableRegion[];
    pins: MapPin[];
}): MapDrawExportPayload {
    const { guideId, calibration, traversableRegions, pins } = params;

    return {
        version: 3,
        guideId,
        mapTileCorners: getCalibrationCornerGeoPoints(calibration),
        calibration,
        traversableRegions: traversableRegions
            .filter((region) => (
                (Array.isArray(region.geoPolygon) && region.geoPolygon.length >= 3)
                || (Array.isArray(region.polygonNormalized) && region.polygonNormalized.length >= 3)
            ))
            .map((region) => ({
                id: region.id,
                polygon: Array.isArray(region.geoPolygon) && region.geoPolygon.length >= 3
                    ? region.geoPolygon
                    : (calibration
                        ? (region.polygonNormalized ?? []).map((point) => transformNormalizedPoint(calibration.transform, point))
                        : [])
            })),
        pins: pins.map((pin) => ({
            id: pin.id,
            pinDisplayPosition: {
                x: pin.x,
                y: pin.y,
                geoPosition: calibration
                    ? transformNormalizedPoint(calibration.transform, { x: pin.x, y: pin.y })
                    : undefined
            },
            region: {
                polygon: pin.polygon ?? []
            }
        }))
    };
}
