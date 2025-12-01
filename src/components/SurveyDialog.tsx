import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getLanguageFromQuery } from '../utils/languageUtils';
import { useTranslation } from '../hooks/useTranslation';
import './SurveyDialog.css';

interface SurveyDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const SurveyDialog: React.FC<SurveyDialogProps> = ({ isOpen, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [searchParams] = useSearchParams();
    const lang = getLanguageFromQuery(searchParams);
    const { t } = useTranslation(lang);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
        } else {
            setTimeout(() => setIsVisible(false), 300);
        }
    }, [isOpen]);

    if (!isVisible) return null;

    return (
        <div className={`survey-dialog-overlay ${isOpen ? 'open' : ''}`}>
            <div className="survey-dialog">
                <h2>{t('survey.title')}</h2>
                <p>{t('survey.prompt')}</p>
                <textarea placeholder={t('survey.placeholder')} />
                <div className="dialog-actions">
                    <button onClick={onClose}>{t('survey.cancel')}</button>
                    <button onClick={() => { alert(t('survey.submitted')); onClose(); }}>{t('survey.submit')}</button>
                </div>
            </div>
        </div>
    );
};

export default SurveyDialog;
