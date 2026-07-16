import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polygon, TileLayer, Tooltip, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import { CORNER_LABEL, CORNER_ORDER, type CalibrationDraftCorners, type CornerKey } from '../utils/mapCalibration.ts';

type GeoPoint = { lat: number; lng: number };
const HANDLE_COLOR: Record<CornerKey, string> = {
    topLeft: '#2563eb',
    topRight: '#0891b2',
    bottomRight: '#16a34a',
    bottomLeft: '#d97706'
};

function createHandleIcon(color: string) {
    return L.divIcon({
        className: 'geo-calibration-overlay-editor__handle',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        html: `<div style="width:18px;height:18px;border-radius:999px;border:3px solid #ffffff;background:${color};box-sizing:border-box;box-shadow:0 2px 8px rgba(0,0,0,0.28);cursor:grab;"></div>`
    });
}

const HANDLE_ICONS: Record<CornerKey, L.DivIcon> = {
    topLeft: createHandleIcon(HANDLE_COLOR.topLeft),
    topRight: createHandleIcon(HANDLE_COLOR.topRight),
    bottomRight: createHandleIcon(HANDLE_COLOR.bottomRight),
    bottomLeft: createHandleIcon(HANDLE_COLOR.bottomLeft)
};

interface GeoCalibrationOverlayEditorProps {
    imageUrl: string;
    corners: CalibrationDraftCorners;
    onCornersChange: (next: CalibrationDraftCorners) => void;
    seedVersion?: number;
    seedPoints?: GeoPoint[];
    overlayOpacity?: number;
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] | null {
    const size = vector.length;
    const augmented = matrix.map((row, index) => [...row, vector[index]]);

    for (let pivot = 0; pivot < size; pivot++) {
        let maxRow = pivot;
        for (let row = pivot + 1; row < size; row++) {
            if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[maxRow][pivot])) {
                maxRow = row;
            }
        }

        if (Math.abs(augmented[maxRow][pivot]) < 1e-10) return null;

        if (maxRow !== pivot) {
            const temp = augmented[pivot];
            augmented[pivot] = augmented[maxRow];
            augmented[maxRow] = temp;
        }

        const pivotValue = augmented[pivot][pivot];
        for (let col = pivot; col <= size; col++) {
            augmented[pivot][col] /= pivotValue;
        }

        for (let row = 0; row < size; row++) {
            if (row === pivot) continue;
            const factor = augmented[row][pivot];
            for (let col = pivot; col <= size; col++) {
                augmented[row][col] -= factor * augmented[pivot][col];
            }
        }
    }

    return augmented.map((row) => row[size]);
}

function computeProjectiveMatrix(
    source: Array<{ x: number; y: number }>,
    destination: Array<{ x: number; y: number }>
) {
    const matrix: number[][] = [];
    const vector: number[] = [];

    for (let index = 0; index < 4; index++) {
        const src = source[index];
        const dst = destination[index];

        matrix.push([src.x, src.y, 1, 0, 0, 0, -src.x * dst.x, -src.y * dst.x]);
        vector.push(dst.x);

        matrix.push([0, 0, 0, src.x, src.y, 1, -src.x * dst.y, -src.y * dst.y]);
        vector.push(dst.y);
    }

    const solved = solveLinearSystem(matrix, vector);
    if (!solved) return null;

    const [h11, h12, h13, h21, h22, h23, h31, h32] = solved;

    return [
        h11, h21, 0, h31,
        h12, h22, 0, h32,
        0, 0, 1, 0,
        h13, h23, 0, 1
    ];
}

function hasAllCorners(corners: CalibrationDraftCorners): corners is Record<CornerKey, GeoPoint> {
    return CORNER_ORDER.every((key) => Boolean(corners[key]));
}

function buildSeedCorners(bounds: L.LatLngBounds, tightenToViewport: boolean): Record<CornerKey, GeoPoint> {
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const west = bounds.getWest();
    const latInset = tightenToViewport ? (north - south) * 0.22 : 0;
    const lngInset = tightenToViewport ? (east - west) * 0.22 : 0;

    return {
        topLeft: { lat: north - latInset, lng: west + lngInset },
        topRight: { lat: north - latInset, lng: east - lngInset },
        bottomRight: { lat: south + latInset, lng: east - lngInset },
        bottomLeft: { lat: south + latInset, lng: west + lngInset }
    };
}

const ProjectiveImageOverlay: React.FC<{
    imageUrl: string;
    corners: CalibrationDraftCorners;
    overlayOpacity: number;
}> = ({ imageUrl, corners, overlayOpacity }) => {
    const map = useMap();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });

    useEffect(() => {
        const pane = map.getPanes().overlayPane;
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '0';
        container.style.top = '0';
        container.style.transformOrigin = '0 0';
        container.style.pointerEvents = 'none';
        container.style.opacity = `${overlayOpacity}`;
        container.style.zIndex = '350';

        const image = document.createElement('img');
        image.alt = 'Calibration overlay';
        image.draggable = false;
        image.style.display = 'block';
        image.style.width = '100%';
        image.style.height = '100%';
        image.style.userSelect = 'none';
        image.style.pointerEvents = 'none';

        container.appendChild(image);
        pane.appendChild(container);

        containerRef.current = container;
        imageRef.current = image;

        return () => {
            container.remove();
            containerRef.current = null;
            imageRef.current = null;
        };
    }, [map]);

    useEffect(() => {
        const image = imageRef.current;
        if (!image) return;

        image.src = imageUrl;
        const handleLoad = () => {
            setNaturalSize({
                width: Math.max(1, image.naturalWidth || 1),
                height: Math.max(1, image.naturalHeight || 1)
            });
        };

        image.addEventListener('load', handleLoad);
        if (image.complete) handleLoad();

        return () => {
            image.removeEventListener('load', handleLoad);
        };
    }, [imageUrl]);

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.style.opacity = `${overlayOpacity}`;
        }
    }, [overlayOpacity]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const update = () => {
            if (!hasAllCorners(corners)) {
                container.style.display = 'none';
                return;
            }

            const destination = CORNER_ORDER.map((key) => {
                const point = corners[key];
                const layerPoint = map.latLngToLayerPoint([point.lat, point.lng]);
                return { x: layerPoint.x, y: layerPoint.y };
            });

            const transform = computeProjectiveMatrix(
                [
                    { x: 0, y: 0 },
                    { x: naturalSize.width, y: 0 },
                    { x: naturalSize.width, y: naturalSize.height },
                    { x: 0, y: naturalSize.height }
                ],
                destination
            );

            if (!transform) {
                container.style.display = 'none';
                return;
            }

            container.style.display = 'block';
            container.style.width = `${naturalSize.width}px`;
            container.style.height = `${naturalSize.height}px`;
            container.style.transform = `matrix3d(${transform.join(',')})`;
        };

        update();
        map.on('zoom viewreset move resize', update);
        return () => {
            map.off('zoom viewreset move resize', update);
        };
    }, [corners, map, naturalSize.height, naturalSize.width]);

    return null;
};

const SeedAndFitController: React.FC<{
    corners: CalibrationDraftCorners;
    onCornersChange: (next: CalibrationDraftCorners) => void;
    seedVersion: number;
    seedPoints: GeoPoint[];
}> = ({ corners, onCornersChange, seedVersion, seedPoints }) => {
    const map = useMap();
    const initializedVersionRef = useRef<number | null>(null);

    useEffect(() => {
        if (initializedVersionRef.current === seedVersion) return;

        if (hasAllCorners(corners)) {
            const bounds = L.latLngBounds(CORNER_ORDER.map((key) => [corners[key].lat, corners[key].lng] as [number, number]));
            map.fitBounds(bounds.pad(0.2), { animate: false, padding: [36, 36] });
            initializedVersionRef.current = seedVersion;
            return;
        }

        if (seedPoints.length > 0) {
            const seedBounds = L.latLngBounds(seedPoints.map((point) => [point.lat, point.lng] as [number, number]));
            map.fitBounds(seedBounds.pad(0.6), { animate: false, padding: [36, 36] });
            onCornersChange(buildSeedCorners(seedBounds.pad(0.35), false));
            initializedVersionRef.current = seedVersion;
            return;
        }

        const viewportBounds = map.getBounds();
        if (!viewportBounds.isValid()) return;
        onCornersChange(buildSeedCorners(viewportBounds, true));
        initializedVersionRef.current = seedVersion;
    }, [corners, map, onCornersChange, seedPoints, seedVersion]);

    return null;
};

const GeoCalibrationOverlayEditor: React.FC<GeoCalibrationOverlayEditorProps> = ({
    imageUrl,
    corners,
    onCornersChange,
    seedVersion = 0,
    seedPoints = [],
    overlayOpacity = 0.62
}) => {
    const completeCorners = hasAllCorners(corners) ? corners : null;

    const polygonPositions = useMemo(
        () => (completeCorners
            ? CORNER_ORDER.map((key) => [completeCorners[key].lat, completeCorners[key].lng] as [number, number])
            : []),
        [completeCorners]
    );

    const handleCornerDrag = React.useCallback((key: CornerKey, latlng: L.LatLng) => {
        onCornersChange({
            ...corners,
            [key]: {
                lat: latlng.lat,
                lng: latlng.lng
            }
        });
    }, [corners, onCornersChange]);

    return (
        <div style={{ width: '100%', height: '100%', borderRadius: 14, overflow: 'hidden' }}>
            <MapContainer
                center={[0, 0]}
                zoom={2}
                style={{ width: '100%', height: '100%' }}
                scrollWheelZoom={true}
                dragging={true}
                touchZoom={true}
                doubleClickZoom={true}
                boxZoom={false}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                <SeedAndFitController
                    corners={corners}
                    onCornersChange={onCornersChange}
                    seedVersion={seedVersion}
                    seedPoints={seedPoints}
                />

                <ProjectiveImageOverlay
                    imageUrl={imageUrl}
                    corners={corners}
                    overlayOpacity={overlayOpacity}
                />

                {polygonPositions.length === 4 && (
                    <Polygon
                        positions={polygonPositions}
                        pathOptions={{
                            color: 'rgba(33, 36, 39, 0.85)',
                            weight: 2,
                            fillOpacity: 0
                        }}
                    />
                )}

                {CORNER_ORDER.map((key) => {
                    const point = corners[key];
                    if (!point) return null;
                    return (
                        <Marker
                            key={key}
                            position={[point.lat, point.lng]}
                            icon={HANDLE_ICONS[key]}
                            draggable={true}
                            bubblingMouseEvents={false}
                            eventHandlers={{
                                drag: (event) => {
                                    const target = event.target as L.Marker;
                                    handleCornerDrag(key, target.getLatLng());
                                },
                                dragend: (event) => {
                                    const target = event.target as L.Marker;
                                    handleCornerDrag(key, target.getLatLng());
                                }
                            }}
                        >
                            <Tooltip permanent direction="top" offset={[0, -12]} opacity={0.95}>
                                {CORNER_LABEL[key]}
                            </Tooltip>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
};

export default GeoCalibrationOverlayEditor;
