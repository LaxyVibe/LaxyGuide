import type { MapPin, MapPinsFile } from '../types';

const STORAGE_PREFIX = 'mapPins:';
const LATEST_VERSION = 2;

export function getPinsStorageKey(guideId: string) {
    return `${STORAGE_PREFIX}${guideId}`;
}

export function loadPinsFromLocalStorage(guideId: string): MapPinsFile | null {
    try {
        const raw = localStorage.getItem(getPinsStorageKey(guideId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as MapPinsFile;
        if (!parsed || !Array.isArray(parsed.pins)) return null;
        return normalizePinsFile(parsed, guideId);
    } catch {
        return null;
    }
}

export function savePinsToLocalStorage(guideId: string, file: MapPinsFile) {
    localStorage.setItem(getPinsStorageKey(guideId), JSON.stringify(normalizePinsFile(file, guideId)));
}

export async function fetchPinsFile(url: string): Promise<MapPinsFile> {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) {
        throw new Error(`Failed to fetch pins from ${url}`);
    }
    const data = (await resp.json()) as MapPinsFile;
    if (!data || !Array.isArray(data.pins)) {
        throw new Error('Invalid pins file format');
    }
    return normalizePinsFile(data, data.guideId);
}

export function normalizePinsFile(file: MapPinsFile, fallbackGuideId?: string): MapPinsFile {
    const guideId = file.guideId || fallbackGuideId || '';

    const pins: MapPin[] = (file.pins || []).map((pin) => {
        const label = typeof pin.label === 'string' && pin.label.trim().length > 0 ? pin.label : pin.id;
        const latLngs = Array.isArray(pin.latLngs)
            ? pin.latLngs.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
            : [];

        const polygonRaw = Array.isArray((pin as MapPin).polygon) ? (pin as MapPin).polygon : undefined;
        const polygonFiltered = polygonRaw
            ? polygonRaw.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
            : undefined;
        const polygon = polygonFiltered && polygonFiltered.length >= 3 ? polygonFiltered : undefined;

        // v1 migration: if legacy lat/lng exist, convert to a single clustered point.
        if (latLngs.length === 0 && Number.isFinite(pin.lat) && Number.isFinite(pin.lng)) {
            latLngs.push({
                lat: pin.lat as number,
                lng: pin.lng as number,
                capturedAt: pin.createdAt
            });
        }

        return {
            ...pin,
            label,
            latLngs,
            polygon
        };
    });

    return {
        version: LATEST_VERSION,
        guideId,
        pins
    };
}

export function upsertPin(pins: MapPin[], pin: MapPin): MapPin[] {
    const idx = pins.findIndex(p => p.id === pin.id);
    if (idx === -1) return [...pins, pin];
    const next = pins.slice();
    next[idx] = pin;
    return next;
}

export function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const R = 6371000; // meters
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);

    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);

    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    return 2 * R * Math.asin(Math.sqrt(h));
}

export function findNearestPin(pins: MapPin[], here: { lat: number; lng: number }) {
    let nearest: { pin: MapPin; distanceMeters: number; pointIndex: number; point: { lat: number; lng: number } } | null = null;

    for (const pin of pins) {
        const points = pin.latLngs || [];
        if (points.length === 0) continue;

        for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
            const point = points[pointIndex];
            if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
            const d = haversineDistanceMeters(here, { lat: point.lat, lng: point.lng });
            if (!nearest || d < nearest.distanceMeters) {
                nearest = { pin, pointIndex, point: { lat: point.lat, lng: point.lng }, distanceMeters: d };
            }
        }
    }

    return nearest;
}
