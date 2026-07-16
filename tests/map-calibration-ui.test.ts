import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCalibrationCornerStatus, getCalibrationDraftCorners } from '../src/utils/mapCalibration.ts';
import type { GeoCalibration } from '../src/types/index.ts';

test('getCalibrationDraftCorners reads saved corner-bilinear calibration into draggable draft corners', () => {
    const calibration: GeoCalibration = {
        method: 'corner-bilinear',
        points: [
            { id: 'topLeft', x: 0, y: 0, lat: 35.111111, lng: 139.111111 },
            { id: 'topRight', x: 1, y: 0, lat: 35.222222, lng: 140.222222 },
            { id: 'bottomRight', x: 1, y: 1, lat: 34.333333, lng: 140.333333 },
            { id: 'bottomLeft', x: 0, y: 1, lat: 34.444444, lng: 139.444444 }
        ],
        transform: {
            topLeft: { lat: 35.111111, lng: 139.111111 },
            topRight: { lat: 35.222222, lng: 140.222222 },
            bottomRight: { lat: 34.333333, lng: 140.333333 },
            bottomLeft: { lat: 34.444444, lng: 139.444444 }
        }
    };

    assert.deepEqual(getCalibrationDraftCorners(calibration), {
        topLeft: { lat: 35.111111, lng: 139.111111 },
        topRight: { lat: 35.222222, lng: 140.222222 },
        bottomRight: { lat: 34.333333, lng: 140.333333 },
        bottomLeft: { lat: 34.444444, lng: 139.444444 }
    });
});

test('formatCalibrationCornerStatus reports pending and fixed-precision coordinates for drag-only calibration UI', () => {
    assert.equal(formatCalibrationCornerStatus('topLeft', {}), 'Top Left: Pending');
    assert.equal(
        formatCalibrationCornerStatus('bottomRight', {
            bottomRight: { lat: 34.3333333, lng: 140.3333333 }
        }),
        'Bottom Right: 34.333333, 140.333333'
    );
});
