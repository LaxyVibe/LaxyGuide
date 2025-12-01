import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
                </div>
                <div className="language-dialog-bottom">
                    <button className="language-dialog-apply" onClick={onApply}>{t('languageSwitch.apply')}</button>
                </div>
                <div className="language-dialog-footer">
                    <span className="footer-text">{t('languageSwitch.poweredBy')}</span>
                    <div className="footer-logo" />
                </div>
            </div>
        </div>
    );
};

export default LanguageSwitchDialog;
