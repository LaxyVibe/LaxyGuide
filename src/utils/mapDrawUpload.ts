import type { MapDrawExportPayload } from '../types';

async function readJson<T>(resp: Response): Promise<T> {
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
        const message = (data as { error?: string } | null)?.error || `Request failed (${resp.status})`;
        throw new Error(message);
    }

    return data as T;
}

export async function uploadMapDrawJson(params: {
    guideId: string;
    payload: MapDrawExportPayload;
    idToken: string;
}): Promise<{ ok: true; path: string }> {
    const resp = await fetch('/.netlify/functions/upload-map-draw-json', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${params.idToken}`
        },
        body: JSON.stringify({
            guideId: params.guideId,
            payload: params.payload
        })
    });

    return readJson<{ ok: true; path: string }>(resp);
}
