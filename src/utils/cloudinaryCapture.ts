export interface SignedUploadPayload {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    publicId: string;
    uploadUrl: string;
}

export interface CloudBundleItem {
    publicId: string;
    secureUrl: string;
    bytes: number;
    createdAt: string;
    saveName: string;
    format: string;
}

async function readJson<T>(resp: Response): Promise<T> {
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
        const message = (data as { error?: string } | null)?.error || `Request failed (${resp.status})`;
        throw new Error(message);
    }
    return data as T;
}

export async function requestCloudinarySignedUpload(guideId: string, saveName: string): Promise<SignedUploadPayload> {
    const resp = await fetch('/.netlify/functions/cloudinary-sign', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ guideId, saveName })
    });

    return readJson<SignedUploadPayload>(resp);
}

export async function uploadCloudBundle(file: Blob, signed: SignedUploadPayload): Promise<void> {
    const formData = new FormData();
    formData.append('file', file, 'bundle.zip');
    formData.append('api_key', signed.apiKey);
    formData.append('timestamp', String(signed.timestamp));
    formData.append('signature', signed.signature);
    formData.append('public_id', signed.publicId);

    const resp = await fetch(signed.uploadUrl, {
        method: 'POST',
        body: formData
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Cloudinary upload failed');
    }
}

export async function listCloudBundles(guideId: string): Promise<CloudBundleItem[]> {
    const query = new URLSearchParams({ guideId });
    const resp = await fetch(`/.netlify/functions/cloudinary-list-bundles?${query.toString()}`, {
        method: 'GET'
    });

    const data = await readJson<{ bundles?: CloudBundleItem[] }>(resp);
    return Array.isArray(data.bundles) ? data.bundles : [];
}

export async function downloadCloudBundle(
    url: string,
    options?: { publicId?: string; format?: string }
): Promise<Blob> {
    const query = new URLSearchParams({ url, debug: '1' });
    if (options?.publicId) {
        query.set('publicId', options.publicId);
    }
    if (options?.format) {
        query.set('format', options.format);
    }
    const resp = await fetch(`/.netlify/functions/cloudinary-download-bundle?${query.toString()}`, {
        method: 'GET',
        cache: 'no-store'
    });
    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        const detail = text ? `: ${text}` : '';
        throw new Error(`Failed to download bundle (${resp.status})${detail}`);
    }

    const bytes = await resp.arrayBuffer();
    if (!bytes || bytes.byteLength === 0) {
        throw new Error('Downloaded bundle is empty');
    }

    const header = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
    const isZip = header.length >= 2 && header[0] === 0x50 && header[1] === 0x4b;
    if (!isZip) {
        throw new Error('Downloaded bundle is not a valid ZIP');
    }

    const contentType = resp.headers.get('content-type') || 'application/zip';
    return new Blob([bytes], { type: contentType });
}
