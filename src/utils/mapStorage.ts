type EnvLikeImportMeta = ImportMeta & {
    env?: Record<string, string | undefined>;
};

const DEFAULT_FIREBASE_STORAGE_BUCKET = 'laxy-guide-dev.firebasestorage.app';

export function getFirebaseStorageBucket() {
    const bucketName = (import.meta as EnvLikeImportMeta).env?.VITE_FIREBASE_STORAGE_BUCKET;
    return typeof bucketName === 'string' && bucketName.trim()
        ? bucketName.trim()
        : DEFAULT_FIREBASE_STORAGE_BUCKET;
}

export function encodeStorageObjectPath(objectPath: string) {
    return objectPath
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
}

export function buildFirebaseStoragePublicUrl(objectPath: string) {
    return `https://storage.googleapis.com/${encodeURIComponent(getFirebaseStorageBucket())}/${encodeStorageObjectPath(objectPath)}`;
}

export function getMapAuthoringObjectPath(guideId: string) {
    return `maps/${String(guideId).trim()}-map-authoring.json`;
}

export function getMapAuthoringPublicUrl(guideId: string) {
    return buildFirebaseStoragePublicUrl(getMapAuthoringObjectPath(guideId));
}

export function getMapTileBundleObjectPath(guideId: string) {
    return `maps/${String(guideId).trim()}-map-tiles.zip`;
}

export function getMapTileBundlePublicUrl(guideId: string) {
    return buildFirebaseStoragePublicUrl(getMapTileBundleObjectPath(guideId));
}
