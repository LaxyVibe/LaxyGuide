import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { LANGUAGES, type Language } from '../types';
import { getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';

const LanguageSwitcher: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const currentLang = getLanguageFromQuery(searchParams);

    const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLang = e.target.value as Language;
        setSearchParams(setLanguageInQuery(searchParams, newLang));
    };

    return (
        <div className="language-switcher">
            <select value={currentLang} onChange={handleLanguageChange}>
                {Object.entries(LANGUAGES).map(([code, name]) => (
                    <option key={code} value={code}>
                        {name}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default LanguageSwitcher;
