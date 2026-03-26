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
    const query = new URLSearchParams({ url });
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
        throw new Error(`Failed to download bundle (${resp.status})`);
    }
    return resp.blob();
}
