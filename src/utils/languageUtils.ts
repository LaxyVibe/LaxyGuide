import { LANGUAGES, type Language } from '../types';

export const DEFAULT_LANGUAGE: Language = 'en-US';
export const QUERY_PARAM_KEY = 't';

export const getDeviceLanguage = (): Language => {
    const browserLang = navigator.language;
    // Simple mapping
    if (browserLang.startsWith('ja')) return 'ja-JP';
    if (browserLang.startsWith('ko')) return 'ko-KR';
    if (browserLang.startsWith('zh')) {
        if (browserLang.includes('TW') || browserLang.includes('HK')) return 'zh-TW';
        return 'zh-CN';
    }
    return DEFAULT_LANGUAGE;
};

export const getLanguageFromQuery = (searchParams: URLSearchParams): Language => {
    const lang = searchParams.get(QUERY_PARAM_KEY);
    if (lang && Object.keys(LANGUAGES).includes(lang)) {
        return lang as Language;
    }
    return getDeviceLanguage();
};

export const setLanguageInQuery = (searchParams: URLSearchParams, lang: Language): URLSearchParams => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set(QUERY_PARAM_KEY, lang);
    return newParams;
};

export const ensureLanguageParam = (searchParams: URLSearchParams): Language | null => {
    const lang = searchParams.get(QUERY_PARAM_KEY);
    if (!lang || !Object.keys(LANGUAGES).includes(lang)) {
        return getDeviceLanguage();
    }
    return null;
};
