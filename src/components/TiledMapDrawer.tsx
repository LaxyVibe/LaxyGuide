import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, FeatureGroup, MapContainer, Polygon, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import * as L from 'leaflet';
import type { MapPin } from '../types';
import { ensureLeafletGeomanLoaded } from '../utils/ensureLeafletGeoman';

type LatLng = { lat: number; lng: number };

export interface TiledMapDrawerProps {
    mapTileUrlTemplate: string;
    mapPixelWidth: number;
    mapPixelHeight: number;
    mapTileMaxZoom?: number;
    pins: MapPin[];
    pinDisplayNameById?: Record<string, string>;
    selectedPinId?: string | null;
    onPinSelect?: (pinId: string) => void;
    onPolygonChange?: (pinId: string, polygon: LatLng[] | undefined) => void;
    onMapClick?: (point: { x: number; y: number }) => void;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const mapPointFromNormalized = (point: { x: number; y: number }, width: number, height: number): L.Point => {
    return L.point(clamp01(point.x) * width, clamp01(point.y) * height);
};

function isLeafletPolygonLayer(layer: any): layer is L.Polygon {
    return typeof layer?.getLatLngs === 'function' && typeof layer?.setLatLngs === 'function';
}

function layerToPolygonLatLng(layer: any): LatLng[] | null {
    const latLngs = layer?.getLatLngs?.();
    if (!Array.isArray(latLngs) || latLngs.length === 0) return null;

    const ring = Array.isArray(latLngs[0]) ? latLngs[0] : latLngs;
    if (!Array.isArray(ring) || ring.length < 3) return null;

    const out = ring
        .map((p: any) => ({ lat: Number(p?.lat), lng: Number(p?.lng) }))
        .filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    return out.length >= 3 ? out : null;
}

function applyPolygonToFeatureGroup(featureGroup: L.FeatureGroup, polygon: LatLng[] | undefined) {
    featureGroup.clearLayers();
    if (!polygon || polygon.length < 3) return;
    const layer = L.polygon(
        polygon.map((p) => [p.lat, p.lng] as [number, number]),
        {
            color: '#2563eb',
            weight: 2,
            fillColor: '#2563eb',
            fillOpacity: 0.2
        }
    );
    featureGroup.addLayer(layer);
}

const FitBoundsOnInit: React.FC<{ bounds: L.LatLngBounds }> = ({ bounds }) => {
    const map = useMap();

    useEffect(() => {
        map.fitBounds(bounds, {
            animate: false,
            padding: [24, 24]
        });
        map.setMaxBounds(bounds.pad(0.15));
    }, [map, bounds]);

    return null;
};

const MapClickBridge: React.FC<{
    onMapClick?: (point: { x: number; y: number }) => void;
    mapPixelWidth: number;
    mapPixelHeight: number;
    mapTileMaxZoom: number;
}> = ({ onMapClick, mapPixelWidth, mapPixelHeight, mapTileMaxZoom }) => {
    useMapEvents({
        click: (e) => {
            if (!onMapClick) return;
            const p = L.CRS.Simple.latLngToPoint(e.latlng, mapTileMaxZoom);
            onMapClick({
                x: clamp01(p.x / mapPixelWidth),
                y: clamp01(p.y / mapPixelHeight)
            });
        }
    });
    return null;
};

const SelectedPinFollower: React.FC<{
    selectedPin?: MapPin;
    mapPixelWidth: number;
    mapPixelHeight: number;
    mapTileMaxZoom: number;
}> = ({ selectedPin, mapPixelWidth, mapPixelHeight, mapTileMaxZoom }) => {
    const map = useMap();

    useEffect(() => {
        if (!selectedPin) return;
        const px = mapPointFromNormalized({ x: selectedPin.x, y: selectedPin.y }, mapPixelWidth, mapPixelHeight);
        const latLng = L.CRS.Simple.pointToLatLng(px, mapTileMaxZoom);
        map.panTo(latLng, { animate: true, duration: 0.2 });
    }, [selectedPin, map, mapPixelWidth, mapPixelHeight, mapTileMaxZoom]);

    return null;
};

const DrawController: React.FC<{
    pins: MapPin[];
    selectedPinId?: string | null;
    onPolygonChange?: (pinId: string, polygon: LatLng[] | undefined) => void;
}> = ({ pins, selectedPinId, onPolygonChange }) => {
    const map = useMap();
    const featureGroupRef = useRef<L.FeatureGroup>(null);
    const [featureGroupReadyTick, setFeatureGroupReadyTick] = useState(0);
    const hasInitialized = useRef(false);

    const activePinId = useMemo(() => selectedPinId ?? null, [selectedPinId]);

    const selectedPolygon = useMemo(() => {
        if (!activePinId) return undefined;
        const selectedPin = pins.find((pin) => pin.id === activePinId);
        const points = selectedPin?.polygon;
        if (!points || points.length < 3) return undefined;
        return points.map((point) => ({ lat: point.lat, lng: point.lng }));
    }, [pins, activePinId]);

    useEffect(() => {
        const featureGroup = featureGroupRef.current;
        if (!featureGroup) return;
        applyPolygonToFeatureGroup(featureGroup, selectedPolygon);
    }, [selectedPolygon, activePinId, featureGroupReadyTick]);

    useEffect(() => {
        let disposed = false;

        const setup = async () => {
            const featureGroup = featureGroupRef.current;
            if (!featureGroup) return;

            // Geoman is guaranteed loaded before the map was created (gated in TiledMapDrawer),
            // but await here as a safety net to handle any edge cases.
            await ensureLeafletGeomanLoaded();
            if (disposed) return;

            const mapAny = map as any;
            // Geoman attaches via addInitHook on map creation; if somehow missing, bail.
            if (!mapAny?.pm) return;

            // Hide the toolbar when no pin is focused — nothing to draw for.
            if (!activePinId) {
                mapAny.pm.removeControls?.();
                featureGroup.clearLayers();
                return;
            }

            mapAny.pm.removeControls?.();
            mapAny.pm.setGlobalOptions({ layerGroup: featureGroup });
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
                if (!activePinId) return;
                const layers = featureGroup.getLayers();
                const firstPoly = layers.find((layer) => isLeafletPolygonLayer(layer));
                const poly = firstPoly ? layerToPolygonLatLng(firstPoly) : null;
                onPolygonChange?.(activePinId, poly ?? undefined);
            };

            const onCreate = (e: any) => {
                if (e?.shape && String(e.shape).toLowerCase() !== 'polygon') return;
                const layer = e?.layer;
                if (!layer || !isLeafletPolygonLayer(layer)) return;
                if (!activePinId) {
                    featureGroup.clearLayers();
                    return;
                }
                featureGroup.clearLayers();
                featureGroup.addLayer(layer);
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
    }, [activePinId, map, onPolygonChange, featureGroupReadyTick]);

    const handleFeatureGroupRef = useCallback((layer: L.FeatureGroup | null) => {
        featureGroupRef.current = layer as any;
        if (layer && !hasInitialized.current) {
            hasInitialized.current = true;
            setFeatureGroupReadyTick((v) => v + 1);
        }
    }, []);

    return <FeatureGroup ref={handleFeatureGroupRef} />;
};

const TiledMapDrawer: React.FC<TiledMapDrawerProps> = ({
    mapTileUrlTemplate,
    mapPixelWidth,
    mapPixelHeight,
    mapTileMaxZoom = 5,
    pins,
    pinDisplayNameById,
    selectedPinId,
    onPinSelect,
    onPolygonChange,
    onMapClick
}) => {
    // Ensure Geoman is fully loaded BEFORE the MapContainer renders.
    // L.Map.addInitHook (used by Geoman) only applies to maps created after the
    // import, so we gate the map on geomanReady to guarantee map.pm is populated.
    const [geomanReady, setGeomanReady] = useState(false);
    useEffect(() => {
        ensureLeafletGeomanLoaded().then(() => setGeomanReady(true));
    }, []);

    const selectedPin = useMemo(() => pins.find((pin) => pin.id === selectedPinId), [pins, selectedPinId]);
    const mapMinZoom = useMemo(() => Math.max(0, mapTileMaxZoom - 3), [mapTileMaxZoom]);
    const mapMaxZoom = mapTileMaxZoom;

    const imageBounds = useMemo(() => {
        const southWest = L.CRS.Simple.pointToLatLng(L.point(0, mapPixelHeight), mapTileMaxZoom);
        const northEast = L.CRS.Simple.pointToLatLng(L.point(mapPixelWidth, 0), mapTileMaxZoom);
        return L.latLngBounds(southWest, northEast);
    }, [mapPixelHeight, mapPixelWidth, mapTileMaxZoom]);

    const pinToLatLng = useCallback((pin: MapPin) => {
        const px = mapPointFromNormalized({ x: pin.x, y: pin.y }, mapPixelWidth, mapPixelHeight);
        return L.CRS.Simple.pointToLatLng(px, mapTileMaxZoom);
    }, [mapPixelHeight, mapPixelWidth, mapTileMaxZoom]);

    if (!geomanReady) return <div style={{ width: '100%', height: '100%' }} />;

    return (
        <MapContainer
            crs={L.CRS.Simple}
            zoom={mapTileMaxZoom}
            minZoom={mapMinZoom}
            maxZoom={mapMaxZoom}
            zoomControl={true}
            attributionControl={false}
            maxBounds={imageBounds.pad(0.15)}
            style={{ width: '100%', height: '100%' }}
        >
            <FitBoundsOnInit bounds={imageBounds} />

            <TileLayer
                url={mapTileUrlTemplate}
                noWrap={true}
                bounds={imageBounds}
                maxNativeZoom={mapTileMaxZoom}
                maxZoom={mapMaxZoom}
                minZoom={mapMinZoom}
                keepBuffer={2}
                errorTileUrl=""
            />

            <MapClickBridge
                onMapClick={onMapClick}
                mapPixelWidth={mapPixelWidth}
                mapPixelHeight={mapPixelHeight}
                mapTileMaxZoom={mapTileMaxZoom}
            />

            <SelectedPinFollower
                selectedPin={selectedPin}
                mapPixelWidth={mapPixelWidth}
                mapPixelHeight={mapPixelHeight}
                mapTileMaxZoom={mapTileMaxZoom}
            />

            {pins.map((pin) => {
                const isSelected = pin.id === selectedPinId;
                const points = pin.polygon;
                const hasPolygon = Array.isArray(points) && points.length >= 3;

                return (
                    <React.Fragment key={pin.id}>
                        {hasPolygon && (
                            <Polygon
                                positions={(points || []).map((p) => [p.lat, p.lng] as [number, number])}
                                pathOptions={{
                                    color: isSelected ? '#2563eb' : 'rgba(33, 36, 39, 0.6)',
                                    fillColor: isSelected ? '#2563eb' : 'rgba(33, 36, 39, 0.4)',
                                    fillOpacity: isSelected ? 0.25 : 0.14,
                                    weight: isSelected ? 2 : 1
                                }}
                            />
                        )}

                        <CircleMarker
                            center={pinToLatLng(pin)}
                            radius={isSelected ? 10 : 7}
                            bubblingMouseEvents={false}
                            pathOptions={{
                                color: 'rgba(245, 245, 245, 0.95)',
                                fillColor: isSelected ? '#2563eb' : 'rgba(33, 36, 39, 0.65)',
                                fillOpacity: 1,
                                weight: 2
                            }}
                            eventHandlers={{
                                click: (e) => {
                                    e.originalEvent.stopPropagation();
                                    onPinSelect?.(pin.id);
                                }
                            }}
                        >
                            <Tooltip
                                permanent
                                direction="top"
                                offset={[0, -8]}
                                opacity={0.95}
                                interactive={true}
                                className="pin-id-tooltip"
                            >
                                <div
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onPinSelect?.(pin.id);
                                    }}
                                >
                                    {pinDisplayNameById?.[pin.id] || pin.label || pin.id}
                                </div>
                            </Tooltip>
                        </CircleMarker>
                    </React.Fragment>
                );
            })}

            <DrawController
                pins={pins}
                selectedPinId={selectedPinId}
                onPolygonChange={onPolygonChange}
            />
        </MapContainer>
    );
};

export default TiledMapDrawer;
