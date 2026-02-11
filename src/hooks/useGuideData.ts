import { useState, useEffect } from 'react';
import type { GuideData } from '../types';
import { loadGuideData } from '../utils/contentLoader';

export const useGuideData = (guideId: string | undefined, lang: string | undefined) => {
    const [data, setData] = useState<GuideData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!lang) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                if (!guideId) {
                    setError('No guide ID provided');
                    setLoading(false);
                    return;
                }
                const guideData = await loadGuideData(guideId, lang);
                setData(guideData);
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [guideId, lang]);

    return { data, loading, error };
};

