import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch';
import type { MapPin, TraversableRegion } from '../types';
import TiledMapViewer from './TiledMapViewer';
import type { ResolvedMapTileBundle } from '../utils/mapTileBundle';
import { resolveResetViewTarget } from '../utils/mapResetView';
import { buildNormalizedPoiRegions } from '../utils/mapPoiRegions';

interface NormalizedPolygonRegion {
    id: string;
    polygon: Array<{ x: number; y: number }>;
}

export interface MapViewerProps {
    imageUrl: string;
    mapTileUrlTemplate?: string;
    mapTileBundle?: ResolvedMapTileBundle;
    mapLanguage?: string;
    mapPixelWidth?: number;
    mapPixelHeight?: number;
    mapTileMaxZoom?: number;
    pins: MapPin[];
    currentLocationPoint?: { x: number; y: number } | null;
    traversableRegions?: TraversableRegion[];
    traversableRegionsNormalized?: NormalizedPolygonRegion[];
    highlightedPinId?: string;
    pinDisplayNameById?: Record<string, string>;
    fitToViewportOnInit?: boolean;
    centerOnImageOnInit?: boolean;
    focusedPinCard?: {
        pinId: string;
        poiId?: string;
        title: string;
        imageUrl?: string;
        summary?: string;
    };
    showCenterCursor?: boolean;
    showPinGpsCount?: boolean;
    initialScale?: number;
    maxScale?: number;
    edgeMarginPx?: number;
    onMapClick?: (point: { x: number; y: number }) => void;
    onPinClick?: (pinId: string) => void;
    onPinLongPress?: (pinId: string) => void;
    onPinLongPressPrime?: (pinId: string) => void;
    pinLongPressMs?: number;
}

export interface MapViewerHandle {
    getViewportCenter: () => { x: number; y: number } | null;
    centerOnPoint: (
        point: { x: number; y: number },
        options?: { scale?: number; yOffsetPx?: number }
    ) => void;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const MapViewer = React.forwardRef<MapViewerHandle, MapViewerProps>(
    (
        {
            imageUrl,
            mapTileUrlTemplate,
            mapTileBundle,
            mapLanguage,
            mapPixelWidth,
            mapPixelHeight,
            mapTileMaxZoom,
            pins,
            currentLocationPoint,
            traversableRegions = [],
            traversableRegionsNormalized = [],
            highlightedPinId,
            pinDisplayNameById,
            fitToViewportOnInit = false,
            centerOnImageOnInit = false,
            focusedPinCard,
            showCenterCursor = false,
            showPinGpsCount = true,
            onMapClick,
            onPinClick,
            onPinLongPress,
            onPinLongPressPrime,
            pinLongPressMs = 2000,
            initialScale = 1,
            maxScale = 6,
            edgeMarginPx = 48
        },
        ref
    ) => {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const frameRef = useRef<HTMLDivElement | null>(null);
    const transformRef = useRef<ReactZoomPanPinchContentRef | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const didFitToViewportRef = useRef(false);
    const didCenterOnImageRef = useRef(false);
    const resetScaleRef = useRef(initialScale);

    const [pressingPinId, setPressingPinId] = useState<string | null>(null);
    const [pressProgress, setPressProgress] = useState(0);
    const longPressStartRef = useRef<number | null>(null);
    const longPressTimeoutRef = useRef<number | null>(null);
    const longPressRafRef = useRef<number | null>(null);
    const suppressClickRef = useRef(false);

    const clearLongPress = useCallback(() => {
        if (longPressTimeoutRef.current) {
            window.clearTimeout(longPressTimeoutRef.current);
            longPressTimeoutRef.current = null;
        }
        if (longPressRafRef.current) {
            window.cancelAnimationFrame(longPressRafRef.current);
            longPressRafRef.current = null;
        }
        longPressStartRef.current = null;
        setPressingPinId(null);
        setPressProgress(0);
    }, []);

    const startLongPress = useCallback(
        (pinId: string) => {
            if (!onPinLongPress) return;
            clearLongPress();
            suppressClickRef.current = false;
            setPressingPinId(pinId);
            setPressProgress(0);
            longPressStartRef.current = performance.now();

            const tick = () => {
                if (!longPressStartRef.current) return;
                const elapsed = performance.now() - longPressStartRef.current;
                const p = clamp01(elapsed / pinLongPressMs);
                setPressProgress(p);
                if (p < 1) {
                    longPressRafRef.current = window.requestAnimationFrame(tick);
                }
            };
            longPressRafRef.current = window.requestAnimationFrame(tick);

            longPressTimeoutRef.current = window.setTimeout(() => {
                suppressClickRef.current = true;
                clearLongPress();
                onPinLongPress(pinId);
            }, pinLongPressMs);
        },
        [clearLongPress, onPinLongPress, pinLongPressMs]
    );

    const centerOnPointInternal = useCallback(
        (
            point: { x: number; y: number },
            options?: { scale?: number; yOffsetPx?: number }
        ) => {
            if (!viewportRef.current || !frameRef.current) return;
            const setTransform = transformRef.current?.setTransform;
            if (!setTransform) return;

            const viewportW = viewportRef.current.clientWidth;
            const viewportH = viewportRef.current.clientHeight;
            const frameW = frameRef.current.clientWidth;
            const frameH = frameRef.current.clientHeight;
            if (viewportW <= 0 || viewportH <= 0 || frameW <= 0 || frameH <= 0) return;

            const currentScale = transformRef.current?.instance?.transformState?.scale ?? initialScale;
            const scale = Math.max(0.01, options?.scale ?? currentScale);
            const yOffsetPx = options?.yOffsetPx ?? 0;

            const targetX = viewportW / 2 - (edgeMarginPx + clamp01(point.x) * frameW) * scale;
            const targetY = viewportH / 2 - yOffsetPx - (edgeMarginPx + clamp01(point.y) * frameH) * scale;
            setTransform(targetX, targetY, scale, 200, 'easeOut');
        },
        [edgeMarginPx, initialScale]
    );

    useImperativeHandle(ref, () => ({
        getViewportCenter: () => {
            if (!viewportRef.current || !frameRef.current) return null;
            const viewport = viewportRef.current.getBoundingClientRect();
            const frame = frameRef.current.getBoundingClientRect();
            if (frame.width <= 0 || frame.height <= 0) return null;
            const cx = viewport.left + viewport.width / 2;
            const cy = viewport.top + viewport.height / 2;
            const x = clamp01((cx - frame.left) / frame.width);
            const y = clamp01((cy - frame.top) / frame.height);
            return { x, y };
        },
        centerOnPoint: centerOnPointInternal
    }), [centerOnPointInternal]);

    useEffect(() => {
        didFitToViewportRef.current = false;
        didCenterOnImageRef.current = false;
        resetScaleRef.current = initialScale;
    }, [imageUrl, initialScale]);

    useEffect(() => {
        if (!centerOnImageOnInit) return;
        if (!imageLoaded) return;
        if (didCenterOnImageRef.current) return;
        if (!viewportRef.current || !frameRef.current) return;

        const setTransform = transformRef.current?.setTransform;
        if (!setTransform) return;

        const viewportW = viewportRef.current.clientWidth;
        const viewportH = viewportRef.current.clientHeight;
        const frameW = frameRef.current.clientWidth;
        const frameH = frameRef.current.clientHeight;
        if (viewportW <= 0 || viewportH <= 0 || frameW <= 0 || frameH <= 0) return;

        const scale = Math.max(0.01, initialScale);
        const targetX = viewportW / 2 - (edgeMarginPx + frameW / 2) * scale;
        const targetY = viewportH / 2 - (edgeMarginPx + frameH / 2) * scale;
        setTransform(targetX, targetY, scale, 0, 'easeOut');
        resetScaleRef.current = scale;
        didCenterOnImageRef.current = true;
    }, [centerOnImageOnInit, imageLoaded, initialScale, edgeMarginPx]);

    useEffect(() => {
        if (!fitToViewportOnInit) return;
        if (!imageLoaded) return;
        if (didFitToViewportRef.current) return;
        if (!viewportRef.current || !frameRef.current) return;

        const setTransform = transformRef.current?.setTransform;
        if (!setTransform) return;

        const viewportW = viewportRef.current.clientWidth;
        const viewportH = viewportRef.current.clientHeight;
        const frameW = frameRef.current.clientWidth;
        const frameH = frameRef.current.clientHeight;
        if (viewportW <= 0 || viewportH <= 0 || frameW <= 0 || frameH <= 0) return;

        const contentW = frameW + edgeMarginPx * 2;
        const contentH = frameH + edgeMarginPx * 2;
        const fitScale = Math.max(0.01, Math.min(viewportW / contentW, viewportH / contentH));

        const targetX = viewportW / 2 - (edgeMarginPx + frameW / 2) * fitScale;
        const targetY = viewportH / 2 - (edgeMarginPx + frameH / 2) * fitScale;
        setTransform(targetX, targetY, fitScale, 0, 'easeOut');
        resetScaleRef.current = fitScale;
        didFitToViewportRef.current = true;
    }, [fitToViewportOnInit, imageLoaded, edgeMarginPx]);

    const resetView = useCallback(() => {
        const target = resolveResetViewTarget({
            currentLocationPoint,
            fallbackPoint: { x: 0.5, y: 0.5 },
            resetLevel: resetScaleRef.current
        });
        centerOnPointInternal(target.point, { scale: target.level });
    }, [centerOnPointInternal, currentLocationPoint]);

    const handleClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (!onMapClick) return;
            if (!frameRef.current) return;
            const rect = frameRef.current.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const x = clamp01((e.clientX - rect.left) / rect.width);
            const y = clamp01((e.clientY - rect.top) / rect.height);
            onMapClick({ x, y });
        },
        [onMapClick]
    );

    const shouldUseTiles = (!!mapTileBundle || !!mapTileUrlTemplate)
        && Number.isFinite(mapPixelWidth)
        && Number.isFinite(mapPixelHeight)
        && mapPixelWidth! > 0
        && mapPixelHeight! > 0
        && (Boolean(mapTileBundle) || !imageUrl.startsWith('data:image/'));
    const normalizedPoiRegions = buildNormalizedPoiRegions(
        pins,
        Number.isFinite(mapPixelWidth) && Number.isFinite(mapPixelHeight)
            ? {
                mapPixelWidth: mapPixelWidth!,
                mapPixelHeight: mapPixelHeight!,
                mapTileMaxZoom
            }
            : undefined
    );
    const showPoiMarkers = false;

    if (shouldUseTiles) {
        return (
            <TiledMapViewer
                ref={ref}
                mapTileUrlTemplate={mapTileUrlTemplate!}
                mapTileBundle={mapTileBundle}
                mapLanguage={mapLanguage}
                mapPixelWidth={mapPixelWidth!}
                mapPixelHeight={mapPixelHeight!}
                mapTileMaxZoom={mapTileMaxZoom}
                pins={pins}
                currentLocationPoint={currentLocationPoint}
                traversableRegions={traversableRegions}
                traversableRegionsNormalized={traversableRegionsNormalized}
                highlightedPinId={highlightedPinId}
                pinDisplayNameById={pinDisplayNameById}
                fitToViewportOnInit={fitToViewportOnInit}
                centerOnImageOnInit={centerOnImageOnInit}
                focusedPinCard={focusedPinCard}
                showCenterCursor={showCenterCursor}
                showPinGpsCount={showPinGpsCount}
                initialScale={initialScale}
                maxScale={maxScale}
                edgeMarginPx={edgeMarginPx}
                onMapClick={onMapClick}
                onPinClick={onPinClick}
                onPinLongPress={onPinLongPress}
                onPinLongPressPrime={onPinLongPressPrime}
                pinLongPressMs={pinLongPressMs}
            />
        );
    }

    return (
        <div ref={viewportRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            <style>{`
                @keyframes map-current-location-pulse {
                    0% { transform: translate(-50%, -50%) scale(0.85); opacity: 0.95; }
                    70% { transform: translate(-50%, -50%) scale(1.7); opacity: 0; }
                    100% { transform: translate(-50%, -50%) scale(1.7); opacity: 0; }
                }
                @keyframes map-current-location-blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.55; }
                }
            `}</style>
            <TransformWrapper
                minScale={fitToViewportOnInit ? 0.01 : 1}
                maxScale={maxScale}
                initialScale={initialScale}
                centerOnInit={true}
                wheel={{ step: 0.15 }}
                pinch={{ step: 5 }}
                doubleClick={{ disabled: false }}
            >
                {(zpp) => {
                    transformRef.current = zpp;
                    return (
                    <>
                        <div
                            style={{
                                position: 'absolute',
                                right: 16,
                                top: 16,
                                zIndex: 5,
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
                                onClick={() => zpp.zoomIn()}
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
                                onClick={() => zpp.zoomOut()}
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
                                −
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

                        <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                            <div
                                ref={contentRef}
                                onClick={handleClick}
                                role={onMapClick ? 'button' : undefined}
                                style={{
                                    position: 'relative',
                                    width: '100%',
                                    padding: edgeMarginPx,
                                    boxSizing: 'border-box',
                                    touchAction: 'none',
                                    userSelect: 'none'
                                }}
                            >
                                <div ref={frameRef} style={{ position: 'relative', width: '100%' }}>
                                    <img
                                        src={imageUrl}
                                        alt="Map"
                                        onLoad={() => setImageLoaded(true)}
                                        onError={() => setImageLoaded(true)}
                                        style={{
                                            width: '100%',
                                            height: 'auto',
                                            display: 'block',
                                            pointerEvents: 'none'
                                        }}
                                    />

                                        {traversableRegionsNormalized.length > 0 && (
                                            <svg
                                                aria-hidden="true"
                                                viewBox="0 0 100 100"
                                                preserveAspectRatio="none"
                                                style={{
                                                    position: 'absolute',
                                                    inset: 0,
                                                    width: '100%',
                                                    height: '100%',
                                                    pointerEvents: 'none',
                                                    zIndex: 1
                                                }}
                                            >
                                                {traversableRegionsNormalized
                                                    .filter((region) => region.polygon.length >= 3)
                                                    .map((region) => (
                                                        <polygon
                                                            key={region.id}
                                                            points={region.polygon.map((point) => `${clamp01(point.x) * 100},${clamp01(point.y) * 100}`).join(' ')}
                                                            fill="rgba(34, 197, 94, 0.16)"
                                                            stroke="rgba(22, 163, 74, 0.95)"
                                                            strokeWidth="0.5"
                                                        />
                                                    ))}
                                            </svg>
                                        )}

                                        {normalizedPoiRegions.length > 0 && (
                                            <svg
                                                viewBox="0 0 100 100"
                                                preserveAspectRatio="none"
                                                style={{
                                                    position: 'absolute',
                                                    inset: 0,
                                                    width: '100%',
                                                    height: '100%',
                                                    pointerEvents: 'none',
                                                    zIndex: 2
                                                }}
                                            >
                                                {normalizedPoiRegions.map((region) => (
                                                    <polygon
                                                        key={`poi-region-${region.id}`}
                                                        points={region.polygon
                                                            .map((point) => `${clamp01(point.x) * 100},${clamp01(point.y) * 100}`)
                                                            .join(' ')}
                                                        fill="transparent"
                                                        stroke="transparent"
                                                        pointerEvents="all"
                                                        cursor={onPinClick ? 'pointer' : 'default'}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            onPinClick?.(region.id);
                                                        }}
                                                    />
                                                ))}
                                            </svg>
                                        )}

                                        {pins.map(pin => {
                                            const isHighlighted = pin.id === highlightedPinId;
                                            const showFocusCard = focusedPinCard?.pinId === pin.id;
                                            const pinDisplayName = pinDisplayNameById?.[pin.id] || pin.id;
                                            const gpsCount = pin.latLngs?.length || 0;
                                            const size = isHighlighted ? 20 : 14;
                                            const fontSize = isHighlighted ? 11 : 9;
                                            const ringSize = size + 10;
                                            const ringStroke = 3;
                                            const ringR = (ringSize - ringStroke) / 2;
                                            const ringC = 2 * Math.PI * ringR;
                                            const isPressing = pressingPinId === pin.id;
                                            return (
                                                <div
                                                    key={pin.id}
                                                    role={showPoiMarkers && onPinClick ? 'button' : undefined}
                                                    aria-label={showPoiMarkers && onPinClick ? 'Select pin' : undefined}
                                                    onPointerDown={
                                                        showPoiMarkers && onPinLongPress
                                                            ? (e) => {
                                                                e.stopPropagation();
                                                                onPinLongPressPrime?.(pin.id);
                                                                startLongPress(pin.id);
                                                            }
                                                            : undefined
                                                    }
                                                    onPointerUp={showPoiMarkers && onPinLongPress ? clearLongPress : undefined}
                                                    onPointerCancel={showPoiMarkers && onPinLongPress ? clearLongPress : undefined}
                                                    onPointerLeave={showPoiMarkers && onPinLongPress ? clearLongPress : undefined}
                                                    onClick={
                                                        showPoiMarkers && onPinClick
                                                            ? (e) => {
                                                                e.stopPropagation();
                                                                if (suppressClickRef.current) {
                                                                    suppressClickRef.current = false;
                                                                    return;
                                                                }
                                                                onPinClick(pin.id);
                                                            }
                                                            : undefined
                                                    }
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${pin.x * 100}%`,
                                                        top: `${pin.y * 100}%`,
                                                        transform: 'translate(-50%, -50%)',
                                                        width: showPoiMarkers ? size : 1,
                                                        height: showPoiMarkers ? size : 1,
                                                        overflow: 'visible',
                                                        borderRadius: 999,
                                                        background: showPoiMarkers
                                                            ? (isHighlighted ? 'var(--misc-opam)' : 'rgba(33, 36, 39, 0.65)')
                                                            : 'transparent',
                                                        border: showPoiMarkers
                                                            ? (isHighlighted ? '2px solid rgba(245, 245, 245, 0.95)' : '2px solid rgba(245, 245, 245, 0.75)')
                                                            : 'none',
                                                        boxShadow: 'none',
                                                        cursor: showPoiMarkers && (onPinClick || onPinLongPress) ? 'pointer' : 'default',
                                                        pointerEvents: showPoiMarkers ? undefined : 'none',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'rgba(245, 245, 245, 0.95)',
                                                        fontWeight: 900,
                                                        fontSize,
                                                        lineHeight: 1
                                                    }}
                                                >
                                                    {showPoiMarkers && showPinGpsCount ? gpsCount : null}

                                                    {!showFocusCard && showPoiMarkers && (
                                                        <div
                                                            aria-hidden="true"
                                                            style={{
                                                                position: 'absolute',
                                                                left: '50%',
                                                                top: 'calc(100% + 4px)',
                                                                transform: 'translateX(-50%)',
                                                                padding: '2px 6px',
                                                                borderRadius: 10,
                                                                background: 'rgba(245, 245, 245, 0.95)',
                                                                color: 'var(--neutral-800)',
                                                                fontWeight: 900,
                                                                fontSize: 10,
                                                                whiteSpace: 'nowrap',
                                                                pointerEvents: 'none'
                                                            }}
                                                        >
                                                            {pinDisplayName}
                                                        </div>
                                                    )}

                                                    {showFocusCard && (
                                                        <div
                                                            aria-hidden="true"
                                                            style={{
                                                                position: 'absolute',
                                                                left: '50%',
                                                                top: 'calc(100% + 8px)',
                                                                transform: 'translateX(-50%)',
                                                                width: 230,
                                                                padding: 12,
                                                                borderRadius: 16,
                                                                border: '1px solid rgba(33, 36, 39, 0.1)',
                                                                background: 'rgba(242, 242, 243, 0.98)',
                                                                color: 'var(--neutral-800)',
                                                                boxShadow: '0 6px 0 rgba(228, 50, 22, 0.9), 0 14px 24px rgba(0, 0, 0, 0.18)',
                                                                pointerEvents: 'none',
                                                                zIndex: 2
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
                                                    )}

                                                    {isPressing && showPoiMarkers && (
                                                        <svg
                                                            width={ringSize}
                                                            height={ringSize}
                                                            viewBox={`0 0 ${ringSize} ${ringSize}`}
                                                            style={{
                                                                position: 'absolute',
                                                                left: '50%',
                                                                top: '50%',
                                                                transform: 'translate(-50%, -50%) rotate(-90deg)',
                                                                pointerEvents: 'none'
                                                            }}
                                                        >
                                                            <circle
                                                                cx={ringSize / 2}
                                                                cy={ringSize / 2}
                                                                r={ringR}
                                                                fill="transparent"
                                                                stroke="rgba(245, 245, 245, 0.35)"
                                                                strokeWidth={ringStroke}
                                                            />
                                                            <circle
                                                                cx={ringSize / 2}
                                                                cy={ringSize / 2}
                                                                r={ringR}
                                                                fill="transparent"
                                                                stroke="var(--misc-opam)"
                                                                strokeWidth={ringStroke}
                                                                strokeLinecap="round"
                                                                strokeDasharray={ringC}
                                                                strokeDashoffset={ringC * (1 - pressProgress)}
                                                            />
                                                        </svg>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {currentLocationPoint && (
                                            <>
                                                <div
                                                    aria-hidden="true"
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${clamp01(currentLocationPoint.x) * 100}%`,
                                                        top: `${clamp01(currentLocationPoint.y) * 100}%`,
                                                        width: 18,
                                                        height: 18,
                                                        borderRadius: 999,
                                                        background: 'rgba(14, 165, 233, 0.22)',
                                                        pointerEvents: 'none',
                                                        zIndex: 2,
                                                        animation: 'map-current-location-pulse 1.6s ease-out infinite'
                                                    }}
                                                />
                                                <div
                                                    aria-hidden="true"
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${clamp01(currentLocationPoint.x) * 100}%`,
                                                        top: `${clamp01(currentLocationPoint.y) * 100}%`,
                                                        transform: 'translate(-50%, -50%)',
                                                        width: 18,
                                                        height: 18,
                                                        borderRadius: 999,
                                                        background: '#0ea5e9',
                                                        border: '3px solid rgba(245, 245, 245, 0.96)',
                                                        boxShadow: '0 0 0 8px rgba(14, 165, 233, 0.18)',
                                                        pointerEvents: 'none',
                                                        zIndex: 3,
                                                        animation: 'map-current-location-blink 1.1s ease-in-out infinite'
                                                    }}
                                                />
                                            </>
                                        )}
                                </div>
                            </div>
                        </TransformComponent>
                    </>
                    );
                }}
            </TransformWrapper>

            {!imageLoaded && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--neutral-50)',
                        color: 'var(--neutral-600)',
                        fontWeight: 900,
                        pointerEvents: 'auto'
                    }}
                >
                    Loading…
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
                        zIndex: 5,
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

MapViewer.displayName = 'MapViewer';

export default MapViewer;
