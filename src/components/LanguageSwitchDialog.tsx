import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { getLanguageFromQuery } from '../utils/languageUtils';
import { useTranslation } from '../hooks/useTranslation';
import './LanguageSwitchDialog.css';

export interface LanguageOption {
    code: string;
    label: string;
}

interface LanguageSwitchDialogProps {
    open: boolean;
    languages: LanguageOption[];
    selectedLanguage: string;
    onSelect: (code: string) => void;
    onApply: () => void;
    onClose: () => void;
}

const LanguageSwitchDialog: React.FC<LanguageSwitchDialogProps> = ({
    open,
    languages,
    selectedLanguage,
    onSelect,
    onApply,
    onClose,
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [searchParams] = useSearchParams();
    const lang = getLanguageFromQuery(searchParams);
    const { t } = useTranslation(lang);

    useEffect(() => {
        if (open) {
            setIsVisible(true);
        } else {
            setTimeout(() => setIsVisible(false), 300);
        }
    }, [open]);

    const handleApply = () => {
        ReactGA.event({
            category: "User Interaction",
            action: "Change Language",
            label: selectedLanguage
        });
        onApply();
    };

    if (!isVisible) return null;

    return (
        <div className={`language-dialog-backdrop ${open ? 'open' : ''}`}>
            <div className="language-dialog">
                <div className="language-dialog-header">
                    <button className="language-dialog-back" onClick={onClose}>&larr;</button>
                    <span className="language-dialog-title">{t('languageSwitch.title')}</span>
                </div>
                <div className="language-dialog-list">
                    {languages.map(lang => (
                        <div
                            key={lang.code}
                            className={`language-dialog-item${selectedLanguage === lang.code ? ' selected' : ''}`}
                            onClick={() => onSelect(lang.code)}
                        >
                            {selectedLanguage === lang.code && <span className="language-dialog-check">✓</span>}
                            <span>{lang.label}</span>
                        </div>
                    ))}
                    <div className="language-dialog-bottom">
                        <button className="language-dialog-apply" onClick={handleApply}>{t('languageSwitch.apply')}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LanguageSwitchDialog;
