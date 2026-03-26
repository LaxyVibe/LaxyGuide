import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, FeatureGroup, MapContainer, TileLayer, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import type { MapPin } from '../types';
import { ensureLeafletGeomanLoaded } from '../utils/ensureLeafletGeoman';

type LatLng = { lat: number; lng: number };

function toPositions(points: LatLng[]) {
    return points.map(p => [p.lat, p.lng] as [number, number]);
}

function computeBounds(points: LatLng[]) {
    if (points.length === 0) return null;
    let minLat = points[0].lat;
    let maxLat = points[0].lat;
    let minLng = points[0].lng;
    let maxLng = points[0].lng;
    for (const p of points) {
        minLat = Math.min(minLat, p.lat);
        maxLat = Math.max(maxLat, p.lat);
        minLng = Math.min(minLng, p.lng);
        maxLng = Math.max(maxLng, p.lng);
    }
    return {
        southWest: [minLat, minLng] as [number, number],
        northEast: [maxLat, maxLng] as [number, number]
    };
}

const FitBounds: React.FC<{ points: LatLng[] }> = ({ points }) => {
    const map = useMap();

    useEffect(() => {
        const b = computeBounds(points);
        if (!b) return;
        map.fitBounds([b.southWest, b.northEast], { padding: [24, 24] });
    }, [map, points]);

    return null;
};

function layerToPolygonLatLng(layer: any): LatLng[] | null {
    const latLngs = layer?.getLatLngs?.();
    if (!Array.isArray(latLngs) || latLngs.length === 0) return null;

    // Leaflet polygon latlngs: [ [LatLng, LatLng, ...] ] (first ring)
    const ring = Array.isArray(latLngs[0]) ? latLngs[0] : latLngs;
    if (!Array.isArray(ring) || ring.length < 3) return null;

    const out = ring
        .map((p: any) => ({ lat: Number(p?.lat), lng: Number(p?.lng) }))
        .filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    return out.length >= 3 ? out : null;
}

function isLeafletPolygonLayer(layer: any): layer is L.Polygon {
    return typeof layer?.getLatLngs === 'function' && typeof layer?.setLatLngs === 'function';
}

function applyPolygonToFeatureGroup(featureGroup: L.FeatureGroup, polygon: LatLng[] | undefined) {
    featureGroup.clearLayers();
    if (!polygon || polygon.length < 3) return;
    const layer = L.polygon(toPositions(polygon) as any, {
        color: 'var(--primary-300)',
        weight: 2,
        fillColor: 'var(--primary-300)',
        fillOpacity: 0.2
    });
    featureGroup.addLayer(layer);
}

const GeomanControls: React.FC<{
    featureGroupRef: React.RefObject<L.FeatureGroup | null>;
    onPolygonChange: (polygon: MapPin['polygon']) => void;
}> = ({ featureGroupRef, onPolygonChange }) => {
    const map = useMap();

    useEffect(() => {
        let disposed = false;

        const setup = async () => {
            const fg = featureGroupRef.current;
            if (!fg) return;

            await ensureLeafletGeomanLoaded();
            if (disposed) return;

            const mapAny = map as any;
            if (!mapAny?.pm) return;

            // Avoid accumulating duplicate control toolbars across re-renders.
            mapAny.pm.removeControls?.();

            // Limit Geoman operations to the feature group so we keep exactly one polygon.
            mapAny.pm.setGlobalOptions({ layerGroup: fg });

            // Show only the relevant controls.
            mapAny.pm.addControls({
                position: 'topright',
                drawMarker: false,
                drawPolyline: false,
                drawRectangle: false,
                drawCircle: false,
                drawCircleMarker: false,
                drawText: false,
                drawPolygon: true,
                editMode: true,
                dragMode: false,
                cutPolygon: false,
                removalMode: true,
                rotateMode: false
            });

            const syncFromGroup = () => {
                const layers = fg.getLayers();
                const firstPoly = layers.find((layer) => isLeafletPolygonLayer(layer));
                const poly = firstPoly ? layerToPolygonLatLng(firstPoly) : null;
                onPolygonChange(poly ?? undefined);
            };

            const onCreate = (e: any) => {
                if (e?.shape && String(e.shape).toLowerCase() !== 'polygon') return;
                const layer = e?.layer;
                if (!layer || !isLeafletPolygonLayer(layer)) return;
                fg.clearLayers();
                fg.addLayer(layer);
                syncFromGroup();
            };

            const onUpdate = (e: any) => {
                if (e?.layer && isLeafletPolygonLayer(e.layer)) {
                    syncFromGroup();
                }
            };

            const onRemove = () => {
                syncFromGroup();
            };

            map.on('pm:create' as any, onCreate);
            map.on('pm:update' as any, onUpdate);
            map.on('pm:remove' as any, onRemove);

            return () => {
                map.off('pm:create' as any, onCreate);
                map.off('pm:update' as any, onUpdate);
                map.off('pm:remove' as any, onRemove);
                mapAny.pm?.removeControls?.();
            };
        };

        let cleanup: (() => void) | undefined;
        setup()
            .then((maybeCleanup) => {
                if (typeof maybeCleanup === 'function') cleanup = maybeCleanup;
            })
            .catch(() => undefined);

        return () => {
            disposed = true;
            cleanup?.();
        };
    }, [map, featureGroupRef, onPolygonChange]);

    return null;
};

export interface PinPolygonEditorProps {
    pin: MapPin;
    onPolygonChange: (polygon: MapPin['polygon']) => void;
}

const PinPolygonEditor: React.FC<PinPolygonEditorProps> = ({ pin, onPolygonChange }) => {
    const [geomanReady, setGeomanReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        ensureLeafletGeomanLoaded()
            .then(() => {
                if (!cancelled) setGeomanReady(true);
            })
            .catch(() => {
                // Keep the map usable even if Geoman fails to load.
                if (!cancelled) setGeomanReady(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const gpsPoints = useMemo(
        () => (pin.latLngs || []).map(p => ({ lat: p.lat, lng: p.lng })),
        [pin.latLngs]
    );

    const polygon = pin.polygon;

    const pointsForBounds = useMemo(() => {
        if (polygon && polygon.length >= 3) return polygon;
        return gpsPoints;
    }, [polygon, gpsPoints]);

    const featureGroupRef = useRef<L.FeatureGroup>(null);

    const center = useMemo(() => {
        const src = pointsForBounds.length > 0 ? pointsForBounds : [{ lat: 0, lng: 0 }];
        const avg = src.reduce(
            (acc, p) => ({ lat: acc.lat + p.lat / src.length, lng: acc.lng + p.lng / src.length }),
            { lat: 0, lng: 0 }
        );
        return [avg.lat, avg.lng] as [number, number];
    }, [pointsForBounds]);

    useEffect(() => {
        const fg = featureGroupRef.current;
        if (!fg) return;
        applyPolygonToFeatureGroup(fg, polygon);
    }, [pin.id, polygon]);

    return (
        <div style={{ width: '100%', height: '100%' }}>
            {geomanReady ? (
                <MapContainer
                    center={center}
                    zoom={17}
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

                    <FitBounds points={pointsForBounds} />

                    {gpsPoints.map((p, idx) => (
                        <CircleMarker
                            key={idx}
                            center={[p.lat, p.lng]}
                            radius={5}
                            pathOptions={{
                                color: 'var(--primary-300)',
                                fillColor: 'var(--primary-300)',
                                fillOpacity: 0.65,
                                weight: 2
                            }}
                        />
                    ))}

                    <FeatureGroup ref={featureGroupRef}>
                        <GeomanControls featureGroupRef={featureGroupRef} onPolygonChange={onPolygonChange} />
                    </FeatureGroup>
                </MapContainer>
            ) : (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--neutral-600)',
                        fontWeight: 800
                    }}
                >
                    Loading map tools…
                </div>
            )}
        </div>
    );
};

export default PinPolygonEditor;
