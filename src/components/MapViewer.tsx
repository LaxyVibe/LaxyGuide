import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch';
import type { MapPin } from '../types';

export interface MapViewerProps {
    imageUrl: string;
    pins: MapPin[];
    highlightedPinId?: string;
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
    centerOnPoint: (point: { x: number; y: number }) => void;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const MapViewer = React.forwardRef<MapViewerHandle, MapViewerProps>(
    (
        {
            imageUrl,
            pins,
            highlightedPinId,
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
        centerOnPoint: (point) => {
            if (!viewportRef.current || !frameRef.current) return;
            const setTransform = transformRef.current?.setTransform;
            if (!setTransform) return;

            const viewportW = viewportRef.current.clientWidth;
            const viewportH = viewportRef.current.clientHeight;
            const frameW = frameRef.current.clientWidth;
            const frameH = frameRef.current.clientHeight;
            if (viewportW <= 0 || viewportH <= 0 || frameW <= 0 || frameH <= 0) return;

            const currentScale = transformRef.current?.instance?.transformState?.scale ?? initialScale;
            const scale = Math.max(0.01, currentScale);

            const targetX = viewportW / 2 - (edgeMarginPx + clamp01(point.x) * frameW) * scale;
            const targetY = viewportH / 2 - (edgeMarginPx + clamp01(point.y) * frameH) * scale;
            setTransform(targetX, targetY, scale, 200, 'easeOut');
        }
    }));

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

    return (
        <div ref={viewportRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            <TransformWrapper
                minScale={1}
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
                                bottom: 16,
                                zIndex: 5,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10
                            }}
                        >
                            <button
                                onClick={() => zpp.zoomIn()}
                                aria-label="Zoom in"
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 12,
                                    border: 'none',
                                    background: 'rgba(245, 245, 245, 0.95)',
                                    color: 'var(--neutral-800)',
                                    fontWeight: 700,
                                    fontSize: 22,
                                    cursor: 'pointer'
                                }}
                            >
                                +
                            </button>
                            <button
                                onClick={() => zpp.zoomOut()}
                                aria-label="Zoom out"
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 12,
                                    border: 'none',
                                    background: 'rgba(245, 245, 245, 0.95)',
                                    color: 'var(--neutral-800)',
                                    fontWeight: 700,
                                    fontSize: 22,
                                    cursor: 'pointer'
                                }}
                            >
                                −
                            </button>
                            <button
                                onClick={() => zpp.resetTransform()}
                                aria-label="Reset zoom"
                                title="Reset zoom"
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 12,
                                    border: 'none',
                                    background: 'rgba(245, 245, 245, 0.95)',
                                    color: 'var(--neutral-800)',
                                    fontWeight: 700,
                                    fontSize: 20,
                                    cursor: 'pointer'
                                }}
                            >
                                ⟲
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

                                        {pins.map(pin => {
                                            const isHighlighted = pin.id === highlightedPinId;
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
                                                    role={onPinClick ? 'button' : undefined}
                                                    aria-label={onPinClick ? `Select pin` : undefined}
                                                    onPointerDown={
                                                        onPinLongPress
                                                            ? (e) => {
                                                                e.stopPropagation();
                                                                onPinLongPressPrime?.(pin.id);
                                                                startLongPress(pin.id);
                                                            }
                                                            : undefined
                                                    }
                                                    onPointerUp={onPinLongPress ? clearLongPress : undefined}
                                                    onPointerCancel={onPinLongPress ? clearLongPress : undefined}
                                                    onPointerLeave={onPinLongPress ? clearLongPress : undefined}
                                                    onClick={
                                                        onPinClick
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
                                                        width: size,
                                                        height: size,
                                                        overflow: 'visible',
                                                        borderRadius: 999,
                                                        background: isHighlighted ? 'var(--misc-opam)' : 'rgba(33, 36, 39, 0.65)',
                                                        border: isHighlighted ? '2px solid rgba(245, 245, 245, 0.95)' : '2px solid rgba(245, 245, 245, 0.75)',
                                                        boxShadow: 'none',
                                                        cursor: onPinClick || onPinLongPress ? 'pointer' : 'default',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'rgba(245, 245, 245, 0.95)',
                                                        fontWeight: 900,
                                                        fontSize,
                                                        lineHeight: 1
                                                    }}
                                                >
                                                    {showPinGpsCount ? gpsCount : null}

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
                                                        {pin.label || pin.id}
                                                    </div>

                                                    {isPressing && (
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
        </div>
    );
    }
);

MapViewer.displayName = 'MapViewer';

export default MapViewer;
