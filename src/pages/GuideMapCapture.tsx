import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import GlobalHeader from '../components/GlobalHeader';
import Loading from '../components/Loading';
import MapViewer, { type MapViewerHandle } from '../components/MapViewer';
import PinPolygonEditor from '../components/PinPolygonEditor';
import { useGuideData } from '../hooks/useGuideData';
import { useTranslation } from '../hooks/useTranslation';
import { ensureLanguageParam, getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';
import type { MapPin, MapPinsFile } from '../types';
import { downloadJson, getPinsStorageKey, loadPinsFromLocalStorage, savePinsToLocalStorage, upsertPin } from '../utils/mapPins';
import { convexHullLatLng } from '../utils/convexHull';
import { getNextLetterId } from '../utils/pinIdUtils';
import gridIcon from '../assets/icons/grid.svg';

const FILE_VERSION = 2;

const GuideMapCapture: React.FC = () => {
    const { guideId } = useParams<{ guideId: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        const defaultLang = ensureLanguageParam(searchParams);
        if (defaultLang) {
            setSearchParams(setLanguageInQuery(searchParams, defaultLang), { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const lang = getLanguageFromQuery(searchParams);
    const { t, loading: transLoading } = useTranslation(lang);
    const { data, loading: guideLoading, error } = useGuideData(guideId, lang);

    const [activeId, setActiveId] = useState('');
    const [pinsFile, setPinsFile] = useState<MapPinsFile | null>(null);
    const [status, setStatus] = useState<string>('');
    const [fabOpen, setFabOpen] = useState(false);
    const [didAutoCenter, setDidAutoCenter] = useState(false);
    const [captureView, setCaptureView] = useState<'image' | 'polygon'>('image');
    const [mapImageOverride, setMapImageOverride] = useState<string | null>(null);

    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    const mapRef = React.useRef<MapViewerHandle | null>(null);

    useEffect(() => {
        if (!guideId) return;

        // Load any locally chosen map image override (capture-only).
        try {
            const raw = localStorage.getItem(`mapImageOverride:${guideId}`);
            if (raw && raw.startsWith('data:image/')) {
                setMapImageOverride(raw);
            } else {
                setMapImageOverride(null);
            }
        } catch {
            setMapImageOverride(null);
        }

        const local = loadPinsFromLocalStorage(guideId);
        if (local) {
            setPinsFile(local);
            if (local.pins.length > 0) {
                setActiveId((prev) => prev || local.pins[local.pins.length - 1].id);
            }
        } else {
            setPinsFile({ version: FILE_VERSION, guideId, pins: [] });
        }
        setDidAutoCenter(false);
    }, [guideId]);

    const pins = pinsFile?.pins ?? [];
    const selectedPin = useMemo(() => pins.find(p => p.id === activeId), [pins, activeId]);
    const selectedLatLngs = selectedPin?.latLngs || [];

    const canExport = Boolean(guideId) && Boolean(pinsFile);

    const handleBack = () => {
        const to = guideId ? `/${guideId}/map?${searchParams.toString()}` : `/?${searchParams.toString()}`;
        if ('startViewTransition' in document) {
            document.startViewTransition(() => navigate(to));
        } else {
            navigate(to);
        }
    };

    const highlightedPinId = useMemo(() => {
        if (!activeId) return undefined;
        return pins.some(p => p.id === activeId) ? activeId : undefined;
    }, [activeId, pins]);

    const getNextPinId = () => {
        return getNextLetterId(pins.map(p => p.id));
    };

    const handleAddPin = () => {
        if (!guideId) return;
        const id = getNextPinId();
        const center = mapRef.current?.getViewportCenter() ?? { x: 0.5, y: 0.5 };
        const pin: MapPin = {
            id,
            label: id,
            x: center.x,
            y: center.y,
            latLngs: [],
            createdAt: new Date().toISOString()
        };

        setPinsFile((prev) => {
            const next: MapPinsFile = prev
                ? { ...prev, version: FILE_VERSION, guideId, pins: [...prev.pins, pin] }
                : { version: FILE_VERSION, guideId, pins: [pin] };
            savePinsToLocalStorage(guideId, next);
            return next;
        });
        setActiveId(id);
        setStatus('');
    };

    const playAssignSound = () => {
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 880;
            gain.gain.value = 0.0001;
            osc.connect(gain);
            gain.connect(ctx.destination);

            const now = ctx.currentTime;
            gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.13);

            osc.onended = () => {
                ctx.close().catch(() => undefined);
            };
        } catch {
            // ignore
        }
    };

    const handleSelectPin = (nextId: string) => {
        setActiveId(nextId);
        setStatus('');

        const p = pins.find(pin => pin.id === nextId);
        if (p) {
            mapRef.current?.centerOnPoint({ x: p.x, y: p.y });
        }
    };

    const handleUpdateSelectedLabel = (nextLabel: string) => {
        if (!guideId) return;
        if (!activeId) return;

        setPinsFile((prev) => {
            if (!prev) return prev;
            const current = prev.pins.find(p => p.id === activeId);
            if (!current) return prev;

            const updated: MapPin = { ...current, label: nextLabel };
            const next: MapPinsFile = {
                ...prev,
                version: FILE_VERSION,
                guideId,
                pins: upsertPin(prev.pins, updated)
            };
            savePinsToLocalStorage(guideId, next);
            return next;
        });
    };

    const handleUpdateSelectedPolygon = (nextPolygon: MapPin['polygon']) => {
        if (!guideId) return;
        if (!activeId) return;

        setPinsFile((prev) => {
            if (!prev) return prev;
            const current = prev.pins.find(p => p.id === activeId);
            if (!current) return prev;

            const updated: MapPin = { ...current, polygon: nextPolygon };
            const next: MapPinsFile = {
                ...prev,
                version: FILE_VERSION,
                guideId,
                pins: upsertPin(prev.pins, updated)
            };
            savePinsToLocalStorage(guideId, next);
            return next;
        });
    };

    useEffect(() => {
        if (didAutoCenter) return;
        if (!activeId) return;
        if (captureView !== 'image') return;
        const p = pins.find(pin => pin.id === activeId);
        if (!p) return;
        mapRef.current?.centerOnPoint({ x: p.x, y: p.y });
        setDidAutoCenter(true);
    }, [didAutoCenter, activeId, pins, captureView]);

    useEffect(() => {
        if (captureView !== 'polygon') return;
        if (!guideId) return;
        if (!activeId) return;

        setPinsFile((prev) => {
            if (!prev) return prev;
            const current = prev.pins.find(p => p.id === activeId);
            if (!current) return prev;

            const gps = (current.latLngs || []).map(p => ({ lat: p.lat, lng: p.lng }));
            const hasEnough = gps.length >= 3;
            const hasPolygon = Array.isArray(current.polygon) && current.polygon.length >= 3;
            if (!hasEnough || hasPolygon) return prev;

            const hull = convexHullLatLng(gps);
            if (hull.length < 3) return prev;

            const updated: MapPin = { ...current, polygon: hull };
            const next: MapPinsFile = {
                ...prev,
                version: FILE_VERSION,
                guideId,
                pins: upsertPin(prev.pins, updated)
            };
            savePinsToLocalStorage(guideId, next);
            return next;
        });
    }, [captureView, guideId, activeId]);

    const handleAssignGps = (targetPinId?: string) => {
        if (!guideId) return;
        const pinId = targetPinId || activeId;
        if (!pinId) {
            setStatus(t('map.noActivePin'));
            return;
        }

        if (pinId !== activeId) {
            setActiveId(pinId);
        }

        setStatus(t('map.capturing'));
        if (!('geolocation' in navigator)) {
            setStatus(t('map.captureFailed'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setPinsFile((prev) => {
                    if (!prev) return prev;
                    const current = prev.pins.find(p => p.id === pinId);
                    if (!current) return prev;

                    const maxSeq = Math.max(
                        0,
                        ...(current.latLngs || []).map(p => (typeof p.seq === 'number' && Number.isFinite(p.seq) ? p.seq : 0))
                    );

                    const point = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        capturedAt: new Date().toISOString(),
                        seq: Math.floor(maxSeq) + 1
                    };

                    const updated: MapPin = {
                        ...current,
                        latLngs: [...(current.latLngs || []), point]
                    };

                    const next: MapPinsFile = {
                        ...prev,
                        version: FILE_VERSION,
                        guideId,
                        pins: upsertPin(prev.pins, updated)
                    };
                    savePinsToLocalStorage(guideId, next);
                    return next;
                });

                setStatus(t('map.assignedGps'));
                playAssignSound();
            },
            () => {
                setStatus(t('map.locationDenied'));
            },
            { enableHighAccuracy: true, timeout: 15000 }
        );
    };

    const handleRemoveGpsPoint = (index: number) => {
        if (!guideId) return;
        if (!activeId) {
            setStatus(t('map.noActivePin'));
            return;
        }

        const ok = window.confirm(t('map.removeGpsConfirm'));
        if (!ok) return;

        setPinsFile((prev) => {
            if (!prev) return prev;
            const current = prev.pins.find(p => p.id === activeId);
            if (!current) return prev;

            const nextLatLngs = (current.latLngs || []).filter((_, i) => i !== index);
            const updated: MapPin = { ...current, latLngs: nextLatLngs };
            const next: MapPinsFile = {
                ...prev,
                version: FILE_VERSION,
                guideId,
                pins: upsertPin(prev.pins, updated)
            };
            savePinsToLocalStorage(guideId, next);
            return next;
        });

        setStatus('');
    };

    const handleRemovePin = () => {
        if (!guideId) return;
        if (!activeId) {
            setStatus(t('map.noActivePin'));
            return;
        }

        setPinsFile((prev) => {
            if (!prev) return prev;
            const nextPins = prev.pins.filter(p => p.id !== activeId);
            const next: MapPinsFile = { ...prev, version: FILE_VERSION, guideId, pins: nextPins };
            savePinsToLocalStorage(guideId, next);
            return next;
        });

        setActiveId((prev) => {
            const remaining = pins.filter(p => p.id !== prev);
            return remaining.length > 0 ? remaining[remaining.length - 1].id : '';
        });
        setStatus('');
    };

    const handleExport = () => {
        if (!guideId || !pinsFile) return;
        downloadJson(`${guideId}-map-pins.json`, pinsFile);
        setStatus(t('map.exported'));
    };

    const handleClearAll = () => {
        if (!guideId) return;
        const ok = window.confirm(t('map.clearAllConfirm'));
        if (!ok) return;

        try {
            localStorage.removeItem(getPinsStorageKey(guideId));
        } catch {
            // ignore
        }

        setPinsFile({ version: FILE_VERSION, guideId, pins: [] });
        setActiveId('');
        setDidAutoCenter(false);
        setStatus(t('map.clearedAll'));
        setFabOpen(false);
    };

    if (transLoading || guideLoading) return <Loading />;
    if (error) return <div>{t('common.error')}: {error}</div>;

    const mapImage = mapImageOverride || data?.mapImage;

    const handleChooseMapImage = () => {
        fileInputRef.current?.click();
    };

    const handleMapImageFile = async (file: File | null) => {
        if (!guideId || !file) return;
        try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => reject(new Error('read_failed'));
                reader.onload = () => resolve(String(reader.result || ''));
                reader.readAsDataURL(file);
            });

            if (!dataUrl.startsWith('data:image/')) throw new Error('not_image');

            setMapImageOverride(dataUrl);
            try {
                localStorage.setItem(`mapImageOverride:${guideId}`, dataUrl);
            } catch {
                // If storage is full (large image), still keep it in-memory for this session.
            }
            setStatus(t('map.mapImageReplaced'));
            setCaptureView('image');
            setDidAutoCenter(false);
            setFabOpen(false);
        } catch {
            setStatus(t('map.mapImageReplaceFailed'));
        }
    };

    return (
        <div className="page">
            <GlobalHeader
                title={t('map.captureTitle')}
                showBack={true}
                onBack={handleBack}
                rightSlot={
                    <button
                        className="back-button"
                        onClick={() => setFabOpen(o => !o)}
                        aria-label={t('map.tools')}
                        aria-pressed={fabOpen}
                    >
                        <img src={gridIcon} alt="Tools" style={{ width: 22, height: 22 }} />
                    </button>
                }
            />

            <div
                className="scroll-content"
                style={{
                    position: 'relative',
                    overflowY: captureView === 'polygon' ? 'hidden' : undefined,
                    touchAction: captureView === 'polygon' ? 'none' : undefined
                }}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        // Allow re-selecting the same file.
                        e.currentTarget.value = '';
                        void handleMapImageFile(f);
                    }}
                />

                {captureView === 'polygon' ? (
                    activeId && selectedPin ? (
                        <PinPolygonEditor pin={selectedPin} onPolygonChange={handleUpdateSelectedPolygon} />
                    ) : (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--neutral-600)', fontWeight: 700 }}>
                            {t('map.noActivePin')}
                        </div>
                    )
                ) : !mapImage ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--neutral-600)', fontWeight: 700 }}>
                        {t('map.noImage')}
                    </div>
                ) : (
                    <MapViewer
                        ref={mapRef}
                        imageUrl={mapImage}
                        pins={pins}
                        highlightedPinId={highlightedPinId}
                        onPinClick={handleSelectPin}
                        onPinLongPress={(pinId) => handleAssignGps(pinId)}
                        initialScale={6}
                    />
                )}

                {fabOpen && (
                    <div
                        style={{
                            position: 'fixed',
                            right: 16,
                            top: 'calc(env(safe-area-inset-top) + 72px)',
                            zIndex: 3000,
                            width: 'min(340px, calc(100% - 32px))',
                            background: 'rgba(245, 245, 245, 0.95)',
                            border: '1px solid var(--neutral-200)',
                            borderRadius: 16,
                            padding: 12,
                            color: 'var(--neutral-800)'
                        }}
                    >
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                            <button
                                onClick={() => {
                                    setCaptureView('image');
                                    setDidAutoCenter(false);
                                }}
                                aria-pressed={captureView === 'image'}
                                style={{
                                    height: 40,
                                    borderRadius: 10,
                                    border: 'none',
                                    padding: '0 12px',
                                    background: captureView === 'image' ? 'var(--misc-opam)' : 'rgba(33, 36, 39, 0.1)',
                                    color: captureView === 'image' ? 'white' : 'var(--neutral-800)',
                                    fontWeight: 900,
                                    cursor: 'pointer'
                                }}
                            >
                                {t('map.viewImage')}
                            </button>

                            <button
                                onClick={() => setCaptureView('polygon')}
                                aria-pressed={captureView === 'polygon'}
                                style={{
                                    height: 40,
                                    borderRadius: 10,
                                    border: 'none',
                                    padding: '0 12px',
                                    background: captureView === 'polygon' ? 'var(--misc-opam)' : 'rgba(33, 36, 39, 0.1)',
                                    color: captureView === 'polygon' ? 'white' : 'var(--neutral-800)',
                                    fontWeight: 900,
                                    cursor: 'pointer'
                                }}
                            >
                                {t('map.viewPolygon')}
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                            <select
                                value={activeId}
                                onChange={(e) => handleSelectPin(e.target.value)}
                                disabled={pins.length === 0}
                                aria-label={t('map.selectPin')}
                                style={{
                                    height: 40,
                                    borderRadius: 10,
                                    border: '1px solid rgba(0,0,0,0.08)',
                                    padding: '0 12px',
                                    background: 'rgba(245, 245, 245, 0.95)',
                                    color: 'var(--neutral-800)',
                                    fontWeight: 900,
                                    cursor: pins.length === 0 ? 'not-allowed' : 'pointer',
                                    opacity: pins.length === 0 ? 0.6 : 1,
                                    flex: 1
                                }}
                            >
                                <option value="" disabled>
                                    {t('map.selectPin')}
                                </option>
                                {pins.map((p) => {
                                    const gpsCount = p.latLngs?.length || 0;
                                    return (
                                        <option key={p.id} value={p.id}>
                                            {(p.label || p.id)}{gpsCount > 0 ? ` (${gpsCount})` : ''}
                                        </option>
                                    );
                                })}
                            </select>

                            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--neutral-600)', whiteSpace: 'nowrap' }}>
                                {t('map.pinCountLabel')}: {pins.length}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <button
                                onClick={handleAddPin}
                                style={{
                                    height: 40,
                                    borderRadius: 10,
                                    border: 'none',
                                    padding: '0 14px',
                                    background: 'rgba(245, 245, 245, 0.95)',
                                    color: 'var(--neutral-800)',
                                    fontWeight: 900,
                                    cursor: 'pointer'
                                }}
                            >
                                {t('map.addPin')}
                            </button>

                            <button
                                onClick={handleRemovePin}
                                disabled={!activeId}
                                style={{
                                    height: 40,
                                    borderRadius: 10,
                                    border: 'none',
                                    padding: '0 14px',
                                    background: 'rgba(245, 245, 245, 0.95)',
                                    color: 'var(--neutral-800)',
                                    fontWeight: 900,
                                    cursor: activeId ? 'pointer' : 'not-allowed',
                                    opacity: activeId ? 1 : 0.6
                                }}
                            >
                                {t('map.removePin')}
                            </button>

                            <button
                                onClick={() => handleAssignGps()}
                                disabled={!activeId}
                                style={{
                                    height: 40,
                                    borderRadius: 10,
                                    border: 'none',
                                    padding: '0 14px',
                                    background: 'var(--misc-opam)',
                                    color: 'white',
                                    fontWeight: 900,
                                    cursor: activeId ? 'pointer' : 'not-allowed',
                                    opacity: activeId ? 1 : 0.6
                                }}
                            >
                                {t('map.assignGps')}
                            </button>

                            <button
                                onClick={handleExport}
                                disabled={!canExport}
                                style={{
                                    height: 40,
                                    borderRadius: 10,
                                    border: 'none',
                                    padding: '0 14px',
                                    background: 'var(--misc-opam)',
                                    color: 'white',
                                    fontWeight: 900,
                                    cursor: canExport ? 'pointer' : 'not-allowed',
                                    opacity: canExport ? 1 : 0.6
                                }}
                            >
                                {t('map.exportJson')}
                            </button>
                        </div>

                        <button
                            onClick={handleChooseMapImage}
                            style={{
                                marginTop: 10,
                                height: 40,
                                width: '100%',
                                borderRadius: 10,
                                border: 'none',
                                padding: '0 14px',
                                background: 'rgba(245, 245, 245, 0.95)',
                                color: 'var(--neutral-800)',
                                fontWeight: 900,
                                cursor: 'pointer'
                            }}
                        >
                            {t('map.replaceMapImage')}
                        </button>

                        <button
                            onClick={handleClearAll}
                            disabled={!guideId || pins.length === 0}
                            style={{
                                marginTop: 10,
                                height: 40,
                                width: '100%',
                                borderRadius: 10,
                                border: 'none',
                                padding: '0 14px',
                                background: 'var(--status-red-alpha)',
                                color: 'white',
                                fontWeight: 900,
                                cursor: !guideId || pins.length === 0 ? 'not-allowed' : 'pointer',
                                opacity: !guideId || pins.length === 0 ? 0.6 : 1
                            }}
                        >
                            {t('map.clearAll')}
                        </button>

                        {status && (
                            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: 'var(--neutral-600)' }}>{status}</div>
                        )}

                        {activeId && (
                            <div style={{ marginTop: 12 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                                    <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--neutral-600)' }}>
                                        {t('map.pinLabel')}
                                    </div>
                                    <input
                                        value={selectedPin?.label ?? ''}
                                        onChange={(e) => handleUpdateSelectedLabel(e.target.value)}
                                        style={{
                                            height: 40,
                                            borderRadius: 10,
                                            border: '1px solid rgba(0,0,0,0.08)',
                                            padding: '0 12px',
                                            background: 'rgba(245, 245, 245, 0.95)',
                                            color: 'var(--neutral-800)',
                                            fontWeight: 900
                                        }}
                                    />
                                </div>

                                <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--neutral-600)', marginBottom: 8 }}>
                                    {t('map.gpsPoints')}: {selectedLatLngs.length}
                                </div>

                                {captureView === 'polygon' && selectedLatLngs.length > 0 && selectedLatLngs.length < 3 && (
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-600)', marginBottom: 8 }}>
                                        {t('map.polygonNeed3Points')}
                                    </div>
                                )}

                                {selectedLatLngs.length === 0 ? (
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-600)' }}>{t('map.noGpsPoints')}</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflow: 'auto' }}>
                                        {selectedLatLngs.map((p, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: 10,
                                                    background: 'rgba(245, 245, 245, 0.95)',
                                                    border: '1px solid rgba(0,0,0,0.06)',
                                                    borderRadius: 12,
                                                    padding: '10px 12px'
                                                }}
                                            >
                                                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--neutral-800)' }}>
                                                    {activeId}{p.seq ?? (idx + 1)} — {p.lat.toFixed(6)}, {p.lng.toFixed(6)}
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveGpsPoint(idx)}
                                                    style={{
                                                        height: 32,
                                                        borderRadius: 10,
                                                        border: 'none',
                                                        padding: '0 10px',
                                                        background: 'rgba(33, 36, 39, 0.1)',
                                                        color: 'var(--neutral-800)',
                                                        fontWeight: 900,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {t('map.removeGps')}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GuideMapCapture;
