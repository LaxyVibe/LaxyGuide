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
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
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

    const handleSubmit = async () => {
        if (rating === 0) {
            alert(t('survey.ratingRequired') || 'Please select a rating');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/.netlify/functions/submit-survey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ responses: { rating, feedback } }),
            });

            let data;
            try {
                data = await res.json();
            } catch (e) {
                throw new Error('Received non-JSON response from server. Function might be missing or returning HTML.');
            }

            if (res.ok && data.success) {
                alert(t('survey.submitted'));
                onClose();
                setRating(0);
                setFeedback('');
            } else {
                throw new Error(data.error || 'Submission failed');
            }
        } catch (err) {
            console.error(err);
            alert(t('common.error') || 'Error submitting survey');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isVisible) return null;

    return (
        <div className={`survey-dialog-overlay ${isOpen ? 'open' : ''}`}>
            <div className="survey-dialog">
                <h2>{t('survey.title')}</h2>
                <p>{t('survey.prompt')}</p>
                
                <div className="star-rating">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            className={`star-btn ${star <= rating ? 'filled' : ''}`}
                            onClick={() => setRating(star)}
                            type="button"
                            aria-label={`${star} stars`}
                        >
                            ★
                        </button>
                    ))}
                </div>

                <textarea 
                    placeholder={t('survey.placeholder')} 
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                />
                <div className="dialog-actions">
                    <button onClick={onClose} disabled={isSubmitting}>{t('survey.cancel')}</button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || rating === 0}
                        className="submit-btn"
                    >
                        {isSubmitting ? t('common.loading') : t('survey.submit')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SurveyDialog;
