import { useState, useEffect } from 'react';
import type { GuideData } from '../types';

export const useGuideData = (guideId: string | undefined, lang: string | undefined) => {
    const [data, setData] = useState<GuideData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!guideId || !lang) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                // Construct path to JSON file
                // Note: In production, this should be relative to base or absolute path
                const response = await fetch(`/${guideId}/${lang}/data.json`);
                if (!response.ok) {
                    throw new Error('Failed to load guide data');
                }
                const jsonData = await response.json();
                setData(jsonData);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [guideId, lang]);

    return { data, loading, error };
};
