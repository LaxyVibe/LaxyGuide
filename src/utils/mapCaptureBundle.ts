import JSZip from 'jszip';
import type { MapPinsFile } from '../types';
import { normalizePinsFile } from './mapPins';

const MANIFEST_FILE = 'manifest.json';
const PINS_FILE = 'map-pins.json';

interface BundleManifest {
    schemaVersion: 1;
    guideId: string;
    saveName: string;
    createdAt: string;
    pinsFile: string;
    imageFile: string;
}

export interface ParsedCaptureBundle {
    pinsFile: MapPinsFile;
    imageDataUrl: string;
    manifest?: BundleManifest;
}

export async function imageSourceToBlob(imageSource: string): Promise<Blob> {
    if (imageSource.startsWith('data:')) {
        const resp = await fetch(imageSource);
        if (!resp.ok) throw new Error('Failed to read image data URL');
        return resp.blob();
    }

    const resp = await fetch(imageSource, { cache: 'no-store' });
    if (!resp.ok) {
        throw new Error('Failed to fetch map image');
    }
    return resp.blob();
}

function pickImageExtension(blob: Blob): string {
    const type = blob.type.toLowerCase();
    if (type.includes('png')) return 'png';
    if (type.includes('webp')) return 'webp';
    if (type.includes('gif')) return 'gif';
    return 'jpg';
}

export async function buildCaptureBundle(params: {
    guideId: string;
    saveName: string;
    pinsFile: MapPinsFile;
    imageBlob: Blob;
}): Promise<Blob> {
    const zip = new JSZip();
    const createdAt = new Date().toISOString();
    const ext = pickImageExtension(params.imageBlob);
    const imageFile = `map-image.${ext}`;

    const manifest: BundleManifest = {
        schemaVersion: 1,
        guideId: params.guideId,
        saveName: params.saveName,
        createdAt,
        pinsFile: PINS_FILE,
        imageFile
    };

    zip.file(PINS_FILE, JSON.stringify(params.pinsFile, null, 2));
    zip.file(imageFile, params.imageBlob);
    zip.file(MANIFEST_FILE, JSON.stringify(manifest, null, 2));

    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(blob);
    });
}

function findImageEntry(zip: JSZip, preferredName?: string): string | null {
    if (preferredName && zip.file(preferredName)) return preferredName;

    const imageCandidate = Object.keys(zip.files).find((name) => /^map-image\.(png|jpg|jpeg|webp|gif)$/i.test(name));
    if (imageCandidate) return imageCandidate;

    const firstByExt = Object.keys(zip.files).find((name) => /\.(png|jpg|jpeg|webp|gif)$/i.test(name));
    return firstByExt || null;
}

export async function parseCaptureBundle(bundleBlob: Blob, expectedGuideId: string): Promise<ParsedCaptureBundle> {
    const zip = await JSZip.loadAsync(bundleBlob);

    const manifestRaw = await zip.file(MANIFEST_FILE)?.async('string');
    const manifest = manifestRaw ? (JSON.parse(manifestRaw) as BundleManifest) : undefined;

    const pinsPath = manifest?.pinsFile || PINS_FILE;
    const pinsRaw = await zip.file(pinsPath)?.async('string');
    if (!pinsRaw) {
        throw new Error('Missing map-pins.json in bundle');
    }

    const parsed = JSON.parse(pinsRaw) as MapPinsFile;
    const normalizedPins = normalizePinsFile(parsed, expectedGuideId);
    if (!normalizedPins.guideId || normalizedPins.guideId !== expectedGuideId) {
        throw new Error('Bundle guide does not match current guide');
    }

    const imageEntry = findImageEntry(zip, manifest?.imageFile);
    if (!imageEntry) {
        throw new Error('Missing map image in bundle');
    }

    const imageBlob = await zip.file(imageEntry)?.async('blob');
    if (!imageBlob) {
        throw new Error('Failed to extract map image from bundle');
    }

    const imageDataUrl = await blobToDataUrl(imageBlob);
    if (!imageDataUrl.startsWith('data:image/')) {
        throw new Error('Invalid image in bundle');
    }

    return {
        pinsFile: normalizedPins,
        imageDataUrl,
        manifest
    };
}
