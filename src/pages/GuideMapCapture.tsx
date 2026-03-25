import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import GlobalHeader from '../components/GlobalHeader';
import Loading from '../components/Loading';
import MapViewer, { type MapViewerHandle } from '../components/MapViewer';
import { useGuideData } from '../hooks/useGuideData';
import { useTranslation } from '../hooks/useTranslation';
import { ensureLanguageParam, getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';
import type { MapPin, MapPinsFile } from '../types';
import { downloadJson, loadPinsFromLocalStorage, savePinsToLocalStorage, upsertPin } from '../utils/mapPins';

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

    const mapRef = React.useRef<MapViewerHandle | null>(null);

    useEffect(() => {
        if (!guideId) return;
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
        const numeric = pins
            .map(p => Number.parseInt(p.id, 10))
            .filter(n => Number.isFinite(n));
        const next = numeric.length > 0 ? Math.max(...numeric) + 1 : 1;
        return String(next);
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

    useEffect(() => {
        if (didAutoCenter) return;
        if (!activeId) return;
        const p = pins.find(pin => pin.id === activeId);
        if (!p) return;
        mapRef.current?.centerOnPoint({ x: p.x, y: p.y });
        setDidAutoCenter(true);
    }, [didAutoCenter, activeId, pins]);

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
                const point = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    capturedAt: new Date().toISOString()
                };

                setPinsFile((prev) => {
                    if (!prev) return prev;
                    const current = prev.pins.find(p => p.id === pinId);
                    if (!current) return prev;

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

    if (transLoading || guideLoading) return <Loading />;
    if (error) return <div>{t('common.error')}: {error}</div>;

    const mapImage = data?.mapImage;

    return (
        <div className="page">
            <GlobalHeader title={t('map.captureTitle')} showBack={true} onBack={handleBack} />

            <div className="scroll-content" style={{ position: 'relative' }}>
                {!mapImage ? (
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
                            position: 'absolute',
                            left: 16,
                            bottom: 86,
                            zIndex: 10,
                            width: 'min(340px, calc(100% - 32px))',
                            background: 'rgba(245, 245, 245, 0.95)',
                            border: '1px solid var(--neutral-200)',
                            borderRadius: 16,
                            padding: 12,
                            color: 'var(--neutral-800)'
                        }}
                    >
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
                                                    #{idx + 1} — {p.lat.toFixed(6)}, {p.lng.toFixed(6)}
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

                <button
                    onClick={() => setFabOpen(o => !o)}
                    aria-label={t('map.tools')}
                    style={{
                        position: 'absolute',
                        left: 16,
                        bottom: 16,
                        zIndex: 11,
                        width: 56,
                        height: 56,
                        borderRadius: 999,
                        border: 'none',
                        background: 'var(--misc-opam)',
                        color: 'white',
                        fontWeight: 900,
                        fontSize: 22,
                        cursor: 'pointer'
                    }}
                >
                    {fabOpen ? '×' : '≡'}
                </button>
            </div>
        </div>
    );
};

export default GuideMapCapture;
