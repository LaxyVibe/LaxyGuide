import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import GlobalHeader from '../components/GlobalHeader';
import Loading from '../components/Loading';
import MapViewer from '../components/MapViewer';
import { useGuideData } from '../hooks/useGuideData';
import { useTranslation } from '../hooks/useTranslation';
import { ensureLanguageParam, getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';
import type { MapPin, MapPinsFile } from '../types';
import { fetchPinsFile, findNearestPin, loadPinsFromLocalStorage } from '../utils/mapPins';

const GuideMap: React.FC = () => {
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
    const [pins, setPins] = useState<MapPin[]>([]);
    const [pinsError, setPinsError] = useState<string | null>(null);
    const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setPinsError(null);
            if (!guideId) return;

            if (import.meta.env.DEV) {
                const local = loadPinsFromLocalStorage(guideId);
                if (local && local.pins.length > 0) {
                    setPins(local.pins);
                    return;
                }
            }

            const url = data?.mapPinsUrl;
            if (!url) {
                setPins([]);
                return;
            }

            try {
                const file: MapPinsFile = await fetchPinsFile(url);
                if (!cancelled) setPins(file.pins ?? []);
            } catch (e) {
                if (!cancelled) {
                    setPins([]);
                    setPinsError(e instanceof Error ? e.message : String(e));
                }
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [guideId, data?.mapPinsUrl]);

    useEffect(() => {
        if (!('geolocation' in navigator)) return;
        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            () => {
                setHere(null);
            },
            { enableHighAccuracy: true, maximumAge: 2000 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    const nearest = useMemo(() => {
        if (!here || pins.length === 0) return null;
        return findNearestPin(pins, here);
    }, [here, pins]);

    if (transLoading || guideLoading) return <Loading />;
    if (error) return <div>{t('common.error')}: {error}</div>;

    const handleBack = () => {
        const to = guideId ? `/${guideId}?t=${lang}` : `/?t=${lang}`;
        if ('startViewTransition' in document) {
            document.startViewTransition(() => {
                navigate(to);
            });
        } else {
            navigate(to);
        }
    };

    return (
        <div className="page">
            <GlobalHeader title={t('map.title')} showBack={true} onBack={handleBack} />
            <div
                className="scroll-content"
                style={{
                    position: 'relative'
                }}
            >
                {!data?.mapImage ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--neutral-600)', fontWeight: 700 }}>
                        {t('map.noImage')}
                    </div>
                ) : (
                    <>
                        <MapViewer
                            imageUrl={data.mapImage}
                            pins={pins}
                            highlightedPinId={nearest?.pin.id}
                        />

                        {nearest && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: 16,
                                    right: 16,
                                    top: 16,
                                    background: 'var(--neutral-50)',
                                    color: 'var(--neutral-800)',
                                    padding: '10px 12px',
                                    borderRadius: 12,
                                    border: '1px solid var(--neutral-200)',
                                    fontWeight: 900,
                                    fontSize: 12,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: 10,
                                    alignItems: 'center'
                                }}
                            >
                                <div>
                                    <span style={{ color: 'var(--neutral-700)' }}>{t('map.nearestLabel')}: </span>
                                    <span style={{ color: 'var(--misc-opam)' }}>{nearest.pin.label || nearest.pin.id}</span>
                                    <span style={{ color: 'var(--neutral-700)' }}> • {t('map.gpsPointLabel')} </span>
                                    <span style={{ color: 'var(--misc-opam)' }}>#{nearest.pointIndex + 1}</span>
                                </div>
                                <div style={{ color: 'var(--neutral-700)' }}>
                                    {Math.round(nearest.distanceMeters)}m
                                </div>
                            </div>
                        )}

                        {pinsError && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: 16,
                                    right: 16,
                                    bottom: 16,
                                    background: 'rgba(245, 245, 245, 0.95)',
                                    color: 'var(--neutral-700)',
                                    padding: '10px 12px',
                                    borderRadius: 12,
                                    fontWeight: 700,
                                    fontSize: 12
                                }}
                            >
                                {t('common.error')}: {pinsError}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default GuideMap;
