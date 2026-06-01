import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
    CircleMarker,
    MapContainer,
    TileLayer,
    Tooltip,
    useMapEvents
} from 'react-leaflet';
import * as L from 'leaflet';
import type { MapPin } from '../types';
import type { MapViewerHandle, MapViewerProps } from './MapViewer';

type TiledMapViewerProps = Pick<
    MapViewerProps,
    | 'pins'
    | 'highlightedPinId'
    | 'pinDisplayNameById'
    | 'focusedPinCard'
    | 'showPinGpsCount'
    | 'fitToViewportOnInit'
    | 'centerOnImageOnInit'
    | 'initialScale'
    | 'maxScale'
    | 'edgeMarginPx'
    | 'onMapClick'
    | 'onPinClick'
    | 'onPinLongPress'
    | 'onPinLongPressPrime'
    | 'pinLongPressMs'
    | 'showCenterCursor'
> & {
    mapTileUrlTemplate: string;
    mapPixelWidth: number;
    mapPixelHeight: number;
    mapTileMaxZoom?: number;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const mapPointFromNormalized = (point: { x: number; y: number }, width: number, height: number): L.Point => {
    return L.point(clamp01(point.x) * width, clamp01(point.y) * height);
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

const TiledMapViewer = React.forwardRef<MapViewerHandle, TiledMapViewerProps>(
    (
        {
            mapTileUrlTemplate,
            mapPixelWidth,
            mapPixelHeight,
            mapTileMaxZoom = 5,
            pins,
            highlightedPinId,
            pinDisplayNameById,
            focusedPinCard,
            showPinGpsCount = true,
            fitToViewportOnInit = false,
            centerOnImageOnInit = true,
            initialScale = 1,
            maxScale = 6,
            edgeMarginPx = 48,
            onMapClick,
            onPinClick,
            onPinLongPress,
            onPinLongPressPrime,
            pinLongPressMs = 2000,
            showCenterCursor = false
        },
        ref
    ) => {
        const [map, setMap] = useState<L.Map | null>(null);
        const [ready, setReady] = useState(false);
        const [pressingPinId, setPressingPinId] = useState<string | null>(null);

        const longPressStartRef = useRef<number | null>(null);
        const longPressTimeoutRef = useRef<number | null>(null);
        const suppressClickRef = useRef(false);

        const initZoomRef = useRef<number>(mapTileMaxZoom);
        const initCenterRef = useRef<L.LatLng | null>(null);
        const baseZoomRef = useRef<number>(mapTileMaxZoom);

        const mapMinZoom = useMemo(() => Math.max(0, mapTileMaxZoom - Math.ceil(Math.log2(Math.max(1, maxScale)))), [mapTileMaxZoom, maxScale]);
        const mapMaxZoom = useMemo(() => mapTileMaxZoom, [mapTileMaxZoom]);

        const imageBounds = useMemo(() => {
            const southWest = L.CRS.Simple.pointToLatLng(L.point(0, mapPixelHeight), mapTileMaxZoom);
            const northEast = L.CRS.Simple.pointToLatLng(L.point(mapPixelWidth, 0), mapTileMaxZoom);
            return L.latLngBounds(southWest, northEast);
        }, [mapPixelHeight, mapPixelWidth, mapTileMaxZoom]);

        const clearLongPress = useCallback(() => {
            if (longPressTimeoutRef.current) {
                window.clearTimeout(longPressTimeoutRef.current);
                longPressTimeoutRef.current = null;
            }
            longPressStartRef.current = null;
            setPressingPinId(null);
        }, []);

        const startLongPress = useCallback(
            (pinId: string) => {
                if (!onPinLongPress) return;
                clearLongPress();
                suppressClickRef.current = false;
                setPressingPinId(pinId);
                longPressStartRef.current = performance.now();

                longPressTimeoutRef.current = window.setTimeout(() => {
                    suppressClickRef.current = true;
                    clearLongPress();
                    onPinLongPress(pinId);
                }, pinLongPressMs);
            },
            [clearLongPress, onPinLongPress, pinLongPressMs]
        );

        useEffect(() => {
            return () => {
                if (longPressTimeoutRef.current) {
                    window.clearTimeout(longPressTimeoutRef.current);
                }
            };
        }, []);

        useEffect(() => {
            if (!map) return;

            map.invalidateSize();
            map.setMaxBounds(imageBounds.pad(0.15));

            // Fit image once and then derive the initial zoom from legacy scale semantics.
            map.fitBounds(imageBounds, {
                animate: false,
                padding: [edgeMarginPx, edgeMarginPx]
            });

            const fitZoom = map.getZoom();
            baseZoomRef.current = fitZoom;

            const desiredZoom = centerOnImageOnInit || !fitToViewportOnInit
                ? Math.max(mapMinZoom, Math.min(mapMaxZoom, fitZoom + Math.log2(Math.max(0.01, initialScale))))
                : fitZoom;

            map.setView(imageBounds.getCenter(), desiredZoom, { animate: false });
            initZoomRef.current = desiredZoom;
            initCenterRef.current = imageBounds.getCenter();
            setReady(true);
        }, [
            centerOnImageOnInit,
            edgeMarginPx,
            fitToViewportOnInit,
            imageBounds,
            initialScale,
            map,
            mapMaxZoom,
            mapMinZoom
        ]);

        useImperativeHandle(ref, () => ({
            getViewportCenter: () => {
                if (!map) return null;
                const center = map.getCenter();
                const p = L.CRS.Simple.latLngToPoint(center, mapTileMaxZoom);
                return {
                    x: clamp01(p.x / mapPixelWidth),
                    y: clamp01(p.y / mapPixelHeight)
                };
            },
            centerOnPoint: (point, options) => {
                if (!map) return;
                const pxPoint = mapPointFromNormalized(point, mapPixelWidth, mapPixelHeight);
                const latLng = L.CRS.Simple.pointToLatLng(pxPoint, mapTileMaxZoom);

                let zoom = map.getZoom();
                if (typeof options?.scale === 'number') {
                    zoom = Math.max(
                        mapMinZoom,
                        Math.min(mapMaxZoom, baseZoomRef.current + Math.log2(Math.max(0.01, options.scale)))
                    );
                }

                if (options?.yOffsetPx) {
                    const cp = map.latLngToContainerPoint(latLng);
                    cp.y -= options.yOffsetPx;
                    const shifted = map.containerPointToLatLng(cp);
                    map.setView(shifted, zoom, { animate: true, duration: 0.2 });
                    return;
                }

                map.setView(latLng, zoom, { animate: true, duration: 0.2 });
            }
        }), [map, mapMaxZoom, mapMinZoom, mapPixelHeight, mapPixelWidth, mapTileMaxZoom]);

        const resetView = useCallback(() => {
            if (!map) return;
            if (!initCenterRef.current) return;
            map.setView(initCenterRef.current, initZoomRef.current, { animate: true, duration: 0.2 });
        }, [map]);

        const pinToLatLng = useCallback((pin: MapPin) => {
            const px = mapPointFromNormalized({ x: pin.x, y: pin.y }, mapPixelWidth, mapPixelHeight);
            return L.CRS.Simple.pointToLatLng(px, mapTileMaxZoom);
        }, [mapPixelHeight, mapPixelWidth, mapTileMaxZoom]);

        return (
            <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
                <div
                    style={{
                        position: 'absolute',
                        right: 16,
                        top: 16,
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column',
                        width: 60,
                        borderRadius: 20,
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        overflow: 'hidden',
                        background: 'rgba(230, 230, 231, 0.96)',
                        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)'
                    }}
                >
                    <button
                        onClick={() => map?.zoomIn()}
                        aria-label="Zoom in"
                        style={{
                            width: '100%',
                            height: 56,
                            border: 'none',
                            background: 'transparent',
                            color: '#E43216',
                            fontWeight: 700,
                            fontSize: 46,
                            cursor: 'pointer'
                        }}
                    >
                        +
                    </button>
                    <div style={{ height: 1, background: 'rgba(0, 0, 0, 0.12)' }} />
                    <button
                        onClick={() => map?.zoomOut()}
                        aria-label="Zoom out"
                        style={{
                            width: '100%',
                            height: 56,
                            border: 'none',
                            background: 'transparent',
                            color: '#E43216',
                            fontWeight: 700,
                            fontSize: 46,
                            lineHeight: 0.75,
                            cursor: 'pointer'
                        }}
                    >
                        -
                    </button>
                    <div style={{ height: 1, background: 'rgba(0, 0, 0, 0.12)' }} />
                    <button
                        onClick={resetView}
                        aria-label="Reset zoom"
                        title="Reset zoom"
                        style={{
                            width: '100%',
                            height: 56,
                            border: 'none',
                            background: 'transparent',
                            color: '#E43216',
                            cursor: 'pointer'
                        }}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="30"
                            height="30"
                            fill="none"
                            style={{ transform: 'rotate(20deg)' }}
                        >
                            <path
                                d="M3 11.5L20.5 4.5L13.5 22L10.8 13.8L3 11.5Z"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </div>

                <MapContainer
                    crs={L.CRS.Simple}
                    zoom={mapTileMaxZoom}
                    minZoom={mapMinZoom}
                    maxZoom={mapMaxZoom}
                    zoomControl={false}
                    attributionControl={false}
                    style={{ width: '100%', height: '100%' }}
                    ref={setMap}
                >
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

                    {ready && pins.map((pin) => {
                        const isHighlighted = pin.id === highlightedPinId;
                        const showFocusCard = focusedPinCard?.pinId === pin.id;
                        const pinDisplayName = pinDisplayNameById?.[pin.id] || pin.label || pin.id;
                        const gpsCount = pin.latLngs?.length || 0;
                        const isPressing = pressingPinId === pin.id;

                        return (
                            <CircleMarker
                                key={pin.id}
                                center={pinToLatLng(pin)}
                                radius={isHighlighted ? 10 : 7}
                                bubblingMouseEvents={false}
                                pathOptions={{
                                    color: isHighlighted ? 'rgba(245, 245, 245, 0.95)' : 'rgba(245, 245, 245, 0.75)',
                                    fillColor: isHighlighted ? 'var(--misc-opam)' : 'rgba(33, 36, 39, 0.65)',
                                    fillOpacity: 1,
                                    weight: 2
                                }}
                                eventHandlers={{
                                    mousedown: (e) => {
                                        e.originalEvent.stopPropagation();
                                        onPinLongPressPrime?.(pin.id);
                                        if (onPinLongPress) startLongPress(pin.id);
                                    },
                                    mouseup: clearLongPress,
                                    mouseout: clearLongPress,
                                    click: (e) => {
                                        e.originalEvent.stopPropagation();
                                        if (!onPinClick) return;
                                        if (suppressClickRef.current) {
                                            suppressClickRef.current = false;
                                            return;
                                        }
                                        onPinClick(pin.id);
                                    }
                                }}
                            >
                                {showPinGpsCount && (
                                    <Tooltip permanent direction="top" offset={[0, -6]} opacity={0.92} interactive={false}>
                                        <div style={{ fontWeight: 900, fontSize: 10 }}>{gpsCount}</div>
                                    </Tooltip>
                                )}

                                {!showFocusCard && (
                                    <Tooltip permanent direction="bottom" offset={[0, 8]} opacity={0.95} interactive={true}>
                                        <div
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onPinClick?.(pin.id);
                                            }}
                                            style={{
                                                fontWeight: 900,
                                                fontSize: 10,
                                                cursor: onPinClick ? 'pointer' : 'default'
                                            }}
                                        >
                                            {pinDisplayName}
                                        </div>
                                    </Tooltip>
                                )}

                                {showFocusCard && focusedPinCard && (
                                    <Tooltip
                                        permanent
                                        direction="bottom"
                                        offset={[0, 10]}
                                        opacity={1}
                                        interactive={true}
                                        className="map-pin-focus-card-tooltip"
                                    >
                                        <div
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                            }}
                                            style={{
                                                width: 230,
                                                padding: 12,
                                                borderRadius: 16,
                                                border: '1px solid rgba(33, 36, 39, 0.1)',
                                                background: 'rgba(242, 242, 243, 0.98)',
                                                color: 'var(--neutral-800)',
                                                boxShadow: '0 6px 0 rgba(228, 50, 22, 0.9), 0 14px 24px rgba(0, 0, 0, 0.18)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                                {focusedPinCard.imageUrl ? (
                                                    <img
                                                        src={focusedPinCard.imageUrl}
                                                        alt=""
                                                        style={{
                                                            width: 66,
                                                            height: 66,
                                                            borderRadius: 12,
                                                            objectFit: 'cover',
                                                            flex: '0 0 auto'
                                                        }}
                                                    />
                                                ) : (
                                                    <div
                                                        style={{
                                                            width: 66,
                                                            height: 66,
                                                            borderRadius: 12,
                                                            background: 'rgba(33, 36, 39, 0.12)',
                                                            flex: '0 0 auto'
                                                        }}
                                                    />
                                                )}

                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div
                                                        style={{
                                                            fontSize: 16,
                                                            fontWeight: 900,
                                                            lineHeight: 1.1,
                                                            color: '#E43216',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis'
                                                        }}
                                                    >
                                                        {focusedPinCard.title}
                                                    </div>

                                                    {focusedPinCard.poiId && (
                                                        <div
                                                            style={{
                                                                marginTop: 8,
                                                                display: 'inline-block',
                                                                padding: '2px 9px',
                                                                borderRadius: 11,
                                                                background: '#E43216',
                                                                color: 'rgba(245, 245, 245, 0.98)',
                                                                fontSize: 12,
                                                                fontWeight: 900,
                                                                letterSpacing: 0.3
                                                            }}
                                                        >
                                                            {focusedPinCard.poiId}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {focusedPinCard.summary && (
                                                <div
                                                    style={{
                                                        marginTop: 10,
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        lineHeight: 1.35,
                                                        color: 'var(--neutral-700)'
                                                    }}
                                                >
                                                    {focusedPinCard.summary}
                                                </div>
                                            )}
                                        </div>
                                    </Tooltip>
                                )}

                                {isPressing && (
                                    <CircleMarker
                                        center={pinToLatLng(pin)}
                                        radius={isHighlighted ? 15 : 12}
                                        bubblingMouseEvents={false}
                                        pathOptions={{
                                            color: 'var(--misc-opam)',
                                            fillOpacity: 0,
                                            weight: 2,
                                            opacity: 0.9
                                        }}
                                    />
                                )}
                            </CircleMarker>
                        );
                    })}
                </MapContainer>

                {!ready && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 1001,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--neutral-50)',
                            color: 'var(--neutral-600)',
                            fontWeight: 900,
                            pointerEvents: 'auto'
                        }}
                    >
                        Loading...
                    </div>
                )}

                {showCenterCursor && (
                    <div
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 34,
                            height: 34,
                            zIndex: 1000,
                            pointerEvents: 'none'
                        }}
                    >
                        <div
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: 0,
                                transform: 'translateX(-50%)',
                                width: 2,
                                height: '100%',
                                background: 'rgba(245, 245, 245, 0.9)',
                                boxShadow: '0 0 0 1px rgba(33, 36, 39, 0.55)'
                            }}
                        />
                        <div
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '100%',
                                height: 2,
                                background: 'rgba(245, 245, 245, 0.9)',
                                boxShadow: '0 0 0 1px rgba(33, 36, 39, 0.55)'
                            }}
                        />
                        <div
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: 8,
                                height: 8,
                                borderRadius: 999,
                                background: 'var(--misc-opam)',
                                border: '1px solid rgba(245, 245, 245, 0.95)'
                            }}
                        />
                    </div>
                )}
            </div>
        );
    }
);

TiledMapViewer.displayName = 'TiledMapViewer';

export default TiledMapViewer;
