import type { GeoCalibration, TraversableRegion, TraversableRegionsFile } from '../types';
import { normalizeGeoCalibration } from './geoTransform';

const CALIBRATION_PREFIX = 'mapCalibration_draw_';
const TRAVERSABLE_REGIONS_PREFIX = 'mapTraversableRegions_draw_';
const TRAVERSABLE_REGIONS_VERSION = 1;

const normalizeTraversableRegion = (region: unknown, index: number): TraversableRegion | null => {
    if (!region || typeof region !== 'object') return null;

    const item = region as Partial<TraversableRegion>;
    const id = typeof item.id === 'string' && item.id.trim()
        ? item.id.trim()
        : String(index + 1).padStart(3, '0');
    const polygon = Array.isArray(item.polygon)
        ? item.polygon
            .map((point) => ({
                lat: Number(point?.lat),
                lng: Number(point?.lng)
            }))
            .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
        : [];

    return { id, polygon };
};

export function getCalibrationStorageKey(guideId: string) {
    return `${CALIBRATION_PREFIX}${guideId}`;
}

export function loadCalibrationFromLocalStorage(guideId: string): GeoCalibration | null {
    try {
        const raw = localStorage.getItem(getCalibrationStorageKey(guideId));
        if (!raw) return null;
        return normalizeGeoCalibration(JSON.parse(raw));
    } catch {
        return null;
    }
}

export function saveCalibrationToLocalStorage(guideId: string, calibration: GeoCalibration | null) {
    if (!calibration) {
        localStorage.removeItem(getCalibrationStorageKey(guideId));
        return;
    }
    localStorage.setItem(getCalibrationStorageKey(guideId), JSON.stringify(calibration));
}

export function getTraversableRegionsStorageKey(guideId: string) {
    return `${TRAVERSABLE_REGIONS_PREFIX}${guideId}`;
}

export function normalizeTraversableRegionsFile(file: Partial<TraversableRegionsFile>, fallbackGuideId?: string): TraversableRegionsFile {
    const guideId = typeof file.guideId === 'string' && file.guideId.trim()
        ? file.guideId.trim()
        : (fallbackGuideId ?? '');

    const regions = Array.isArray(file.regions)
        ? file.regions
            .map((region, index) => normalizeTraversableRegion(region, index))
            .filter((region): region is TraversableRegion => region !== null)
        : [];

    return {
        version: TRAVERSABLE_REGIONS_VERSION,
        guideId,
        regions
    };
}

export function loadTraversableRegionsFromLocalStorage(guideId: string): TraversableRegionsFile | null {
    try {
        const raw = localStorage.getItem(getTraversableRegionsStorageKey(guideId));
        if (!raw) return null;
        return normalizeTraversableRegionsFile(JSON.parse(raw), guideId);
    } catch {
        return null;
    }
}

export function saveTraversableRegionsToLocalStorage(guideId: string, file: TraversableRegionsFile) {
    localStorage.setItem(
        getTraversableRegionsStorageKey(guideId),
        JSON.stringify(normalizeTraversableRegionsFile(file, guideId))
    );
}
