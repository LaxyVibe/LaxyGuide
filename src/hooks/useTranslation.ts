import { useState, useEffect } from 'react';
import type { Language } from '../types';

type TranslationObject = {
    [key: string]: string | TranslationObject;
};

type Translations = {
    [key: string]: TranslationObject;
};

const translationsCache: { [lang: string]: Translations } = {};

/**
 * Custom hook for accessing translations based on the current language
 * @param lang - The current language code (e.g., 'en-US', 'ja-JP')
 * @returns Object with t() function to access translations
 */
export function useTranslation(lang: Language) {
    const [translations, setTranslations] = useState<Translations | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check cache first
        if (translationsCache[lang]) {
            setTranslations(translationsCache[lang]);
            setLoading(false);
            return;
        }

        // Load translation file
        const loadTranslations = async () => {
            try {
                const response = await fetch(`/locales/${lang}.json`);
                if (!response.ok) {
                    throw new Error(`Failed to load translations for ${lang}`);
                }
                const data = await response.json();
                translationsCache[lang] = data;
                setTranslations(data);
            } catch (error) {
                console.error(`Error loading translations for ${lang}:`, error);
                // Fallback to English if available
                if (lang !== 'en-US' && translationsCache['en-US']) {
                    setTranslations(translationsCache['en-US']);
                } else if (lang !== 'en-US') {
                    // Try to load English as fallback
                    try {
                        const fallbackResponse = await fetch('/locales/en-US.json');
                        const fallbackData = await fallbackResponse.json();
                        translationsCache['en-US'] = fallbackData;
                        setTranslations(fallbackData);
                    } catch (fallbackError) {
                        console.error('Error loading fallback translations:', fallbackError);
                        setTranslations({});
                    }
                } else {
                    setTranslations({});
                }
            } finally {
                setLoading(false);
            }
        };

        loadTranslations();
    }, [lang]);

    /**
     * Get translation by key path (e.g., 'landing.selectLanguage')
     * @param key - Dot-separated path to translation string
     * @param fallback - Optional fallback text if translation not found
     * @returns Translated string or fallback
     */
    const t = (key: string, fallback?: string): string => {
        if (!translations) {
            return fallback || key;
        }

        const keys = key.split('.');
        let value: string | TranslationObject | undefined = translations;

        for (const k of keys) {
            if (typeof value === 'object' && value !== null && k in value) {
                value = value[k];
            } else {
                return fallback || key;
            }
        }

        return typeof value === 'string' ? value : fallback || key;
    };

    return { t, loading };
}
