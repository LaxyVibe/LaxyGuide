import React, { useState, useEffect } from 'react';
import { ChevronLeft, Check, Send } from 'lucide-react';
import './SurveyDialog.css';
import { useTranslation } from '../hooks/useTranslation';
import type { Language } from '../types';

interface SurveyDialogProps {
    isOpen: boolean;
    onClose: () => void;
    lang: Language;
}

const SurveyDialog: React.FC<SurveyDialogProps> = ({ isOpen, onClose, lang }) => {
    const { t } = useTranslation(lang);
    // --- State ---
    const [formData, setFormData] = useState({
        q1_satisfaction: null as number | null,
        q2_impressed: [] as string[],
        q2_other: '',
        q3_source: [] as string[],
        q3_website_name: '',
        q3_other: '',
        q4_poster_loc: [] as string[],
        q4_other: '',
        q5_multilingual: [] as string[],
        q5_other: '',
        q6_nationality: '',
        q6_other: '',
        q7_stay_length: '',
        q8_visited_places: [] as string[],
        q8_other: '',
        q9_feedback: ''
    });

    const [submitted, setSubmitted] = useState(false);
    const [showQ4, setShowQ4] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- Effect to handle conditional Q4 visibility ---
    useEffect(() => {
        // Q3 Option 2 is "Exhibition posters and leaflets"
        const hasPosterSelected = formData.q3_source.includes(t('survey.q3.posters'));
        setShowQ4(hasPosterSelected);
    }, [formData.q3_source, t]);

    // --- Handlers ---
    const handleSingleSelect = (key: string, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleMultiSelect = (key: keyof typeof formData, value: string) => {
        setFormData(prev => {
            const current = prev[key] as string[];
            if (current.includes(value)) {
                return { ...prev, [key]: current.filter(item => item !== value) };
            } else {
                return { ...prev, [key]: [...current, value] };
            }
        });
    };

    const handleTextChange = (key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Basic validation check to ensure at least one radio/checkbox question has an answer
        const isFormValid = Object.values(formData).some(value =>
            (Array.isArray(value) && value.length > 0) ||
            (typeof value === 'string' && value.trim() !== '') ||
            (typeof value === 'number' && value !== null)
        );

        if (isFormValid) {
            setIsSubmitting(true);
            try {
                const res = await fetch('/.netlify/functions/submit-survey', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ responses: formData }),
                });

                let data;
                try {
                    data = await res.json();
                } catch (e) {
                    throw new Error('Received non-JSON response from server. Function might be missing or returning HTML.');
                }

                if (res.ok && data.success) {
                    setSubmitted(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    console.error(data.error || 'Submission failed');
                    alert('Submission failed. Please try again.');
                }
            } catch (err) {
                console.error(err);
                alert('Error submitting survey. Please check your connection.');
            } finally {
                setIsSubmitting(false);
            }
        } else {
            console.warn("Please fill out at least one field before submitting.");
            alert("Please fill out at least one field before submitting.");
        }
    };

    if (!isOpen) return null;

    if (submitted) {
        return (
            <div className="success-screen">
                <div className="success-icon-circle">
                    <Check size={40} color="#D4AF37" />
                </div>
                <h2 className="success-title">{t('survey.success.title')}</h2>
                <p className="success-message">
                    {t('survey.success.message')}
                </p>
                <button
                    onClick={onClose}
                    className="close-btn"
                >
                    {t('survey.success.close')}
                </button>
            </div>
        );
    }

    return (
        <div className="survey-overlay">

            {/* --- Simple, White Header matching the user's image request --- */}
            <nav className="survey-header">
                {/* Back Arrow */}
                <button
                    className="icon-btn"
                    onClick={() => {
                        if (window.confirm(t('survey.confirmLeave'))) {
                            onClose();
                        }
                    }}
                >
                    <ChevronLeft size={28} strokeWidth={2.5} />
                </button>
            </nav>

            {/* --- Main Content Area (Full white background) --- */}
            <div className="survey-content">
                <div className="survey-container">
                    {/* Title Section */}
                    <div className="survey-title-section">
                        <h1 className="survey-title">
                            {t('survey.title')}
                        </h1>
                        <p className="survey-subtitle">{t('survey.subtitle')}</p>
                    </div>

                    {/* Intro Text */}
                    <div className="survey-intro">
                        <p>
                            {t('survey.intro')}
                        </p>
                        <div className="gift-badge">
                            <p className="gift-text">
                                {t('survey.giftBadge')}
                            </p>
                        </div>
                    </div>

                    {/* Q1: Satisfaction */}
                    <Section badge="Q1" title={t('survey.q1.title')}>
                        <div className="rating-container">
                            <div className="rating-labels">
                                <span>{t('survey.q1.veryDissatisfied')}</span>
                                <span>{t('survey.q1.verySatisfied')}</span>
                            </div>
                            <div className="rating-buttons">
                                {[1, 2, 3, 4, 5].map((num) => (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => handleSingleSelect('q1_satisfaction', num)}
                                        className={`rating-btn ${formData.q1_satisfaction === num ? 'active' : 'inactive'
                                            }`}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </Section>

                    {/* Q2: Impressed By */}
                    <Section badge="Q2" title={t('survey.q2.title')}>
                        <div className="options-grid">
                            {[
                                { key: 'exhibitionTheme', label: t('survey.q2.exhibitionTheme') },
                                { key: 'exhibits', label: t('survey.q2.exhibits') },
                                { key: 'specialEvents', label: t('survey.q2.specialEvents') },
                                { key: 'multilingualSupport', label: t('survey.q2.multilingualSupport') },
                            ].map(opt => (
                                <Checkbox
                                    key={opt.key}
                                    label={opt.label}
                                    checked={formData.q2_impressed.includes(opt.label)}
                                    onChange={() => handleMultiSelect('q2_impressed', opt.label)}
                                />
                            ))}
                        </div>
                        <InputOther
                            value={formData.q2_other}
                            onChange={(e) => handleTextChange('q2_other', e.target.value)}
                            placeholder={t('survey.q2.other')}
                        />
                    </Section>

                    {/* Q3: Source */}
                    <Section badge="Q3" title={t('survey.q3.title')}>
                        <div className="options-grid">
                            {[
                                { key: 'newspapers', label: t('survey.q3.newspapers') },
                                { key: 'posters', label: t('survey.q3.posters') },
                                { key: 'sns', label: t('survey.q3.sns') },
                                { key: 'acquaintance', label: t('survey.q3.acquaintance') },
                                { key: 'droppedBy', label: t('survey.q3.droppedBy') },
                                { key: 'websites', label: t('survey.q3.websites') }
                            ].map(opt => (
                                <Checkbox
                                    key={opt.key}
                                    label={opt.label}
                                    checked={formData.q3_source.includes(opt.label)}
                                    onChange={() => handleMultiSelect('q3_source', opt.label)}
                                />
                            ))}
                        </div>
                        {/* Conditional input field for Website detail, triggered by "Websites" selection */}
                        {formData.q3_source.includes(t('survey.q3.websites')) && (
                            <div className="input-other-container">
                                <input
                                    type="text"
                                    placeholder={t('survey.q3.websiteName')}
                                    className="input-underline"
                                    value={formData.q3_website_name}
                                    onChange={(e) => handleTextChange('q3_website_name', e.target.value)}
                                />
                            </div>
                        )}
                        <InputOther
                            value={formData.q3_other}
                            onChange={(e) => handleTextChange('q3_other', e.target.value)}
                            placeholder={t('survey.q3.other')}
                        />
                    </Section>

                    {/* Q4: Leaflet Location (Conditional) */}
                    {showQ4 && (
                        <div className="animate-fade-in-up">
                            <Section badge="Q4" title={t('survey.q4.title')}>
                                <div className="options-grid">
                                    {[
                                        { key: 'accommodation', label: t('survey.q4.accommodation') },
                                        { key: 'station', label: t('survey.q4.station') },
                                        { key: 'touristInfo', label: t('survey.q4.touristInfo') },
                                        { key: 'restaurant', label: t('survey.q4.restaurant') }
                                    ].map(opt => (
                                        <Checkbox
                                            key={opt.key}
                                            label={opt.label}
                                            checked={formData.q4_poster_loc.includes(opt.label)}
                                            onChange={() => handleMultiSelect('q4_poster_loc', opt.label)}
                                        />
                                    ))}
                                </div>
                                <InputOther
                                    value={formData.q4_other}
                                    onChange={(e) => handleTextChange('q4_other', e.target.value)}
                                    placeholder={t('survey.q4.other')}
                                />
                            </Section>
                        </div>
                    )}

                    {/* Q5: Multilingual Support */}
                    <Section badge="Q5" title={t('survey.q5.title')}>
                        <div className="options-list">
                            {[
                                { key: 'infoDisplays', label: t('survey.q5.infoDisplays') },
                                { key: 'exhibitionDesc', label: t('survey.q5.exhibitionDesc') },
                                { key: 'captions', label: t('survey.q5.captions') },
                                { key: 'audioGuide', label: t('survey.q5.audioGuide') }
                            ].map(opt => (
                                <Checkbox
                                    key={opt.key}
                                    label={opt.label}
                                    checked={formData.q5_multilingual.includes(opt.label)}
                                    onChange={() => handleMultiSelect('q5_multilingual', opt.label)}
                                />
                            ))}
                        </div>
                        <InputOther
                            value={formData.q5_other}
                            onChange={(e) => handleTextChange('q5_other', e.target.value)}
                            placeholder={t('survey.q5.other')}
                        />
                    </Section>

                    {/* Q6: Nationality */}
                    <Section badge="Q6" title={t('survey.q6.title')}>
                        <div className="select-wrapper">
                            <select
                                className="select-input"
                                value={formData.q6_nationality}
                                onChange={(e) => handleSingleSelect('q6_nationality', e.target.value)}
                            >
                                <option value="" disabled>{t('survey.q6.selectRegion')}</option>
                                {[
                                    { key: 'korea', label: t('survey.q6.korea') },
                                    { key: 'china', label: t('survey.q6.china') },
                                    { key: 'taiwan', label: t('survey.q6.taiwan') },
                                    { key: 'hongKong', label: t('survey.q6.hongKong') },
                                    { key: 'vietnam', label: t('survey.q6.vietnam') },
                                    { key: 'thailand', label: t('survey.q6.thailand') },
                                    { key: 'singapore', label: t('survey.q6.singapore') },
                                    { key: 'philippines', label: t('survey.q6.philippines') },
                                    { key: 'indonesia', label: t('survey.q6.indonesia') },
                                    { key: 'malaysia', label: t('survey.q6.malaysia') },
                                    { key: 'india', label: t('survey.q6.india') },
                                    { key: 'usa', label: t('survey.q6.usa') },
                                    { key: 'canada', label: t('survey.q6.canada') },
                                    { key: 'uk', label: t('survey.q6.uk') },
                                    { key: 'france', label: t('survey.q6.france') },
                                    { key: 'germany', label: t('survey.q6.germany') },
                                    { key: 'italy', label: t('survey.q6.italy') },
                                    { key: 'spain', label: t('survey.q6.spain') },
                                    { key: 'australia', label: t('survey.q6.australia') },
                                    { key: 'other', label: t('survey.q6.other') }
                                ].map((country, idx) => (
                                    <option key={country.key} value={country.label}>{idx + 1}. {country.label}</option>
                                ))}
                            </select>
                            <div className="select-arrow">
                                <ChevronLeft size={20} className="-rotate-90" />
                            </div>
                        </div>
                        {formData.q6_nationality === t('survey.q6.other') && (
                            <InputOther
                                value={formData.q6_other}
                                onChange={(e) => handleTextChange('q6_other', e.target.value)}
                                placeholder={t('survey.q6.pleaseSpecify')}
                            />
                        )}
                    </Section>

                    {/* Q7: Length of Stay */}
                    <Section badge="Q7" title={t('survey.q7.title')}>
                        <div className="options-list">
                            {[
                                { key: 'dayTrip', label: t('survey.q7.dayTrip') },
                                { key: 'nights1to2', label: t('survey.q7.nights1to2') },
                                { key: 'nights3to6', label: t('survey.q7.nights3to6') },
                                { key: 'weeks1to2', label: t('survey.q7.weeks1to2') },
                                { key: 'weeks2to1month', label: t('survey.q7.weeks2to1month') },
                                { key: 'month1plus', label: t('survey.q7.month1plus') }
                            ].map(opt => (
                                <Radio
                                    key={opt.key}
                                    label={opt.label}
                                    checked={formData.q7_stay_length === opt.label}
                                    onChange={() => handleSingleSelect('q7_stay_length', opt.label)}
                                />
                            ))}
                        </div>
                    </Section>

                    {/* Q8: Other Places */}
                    <Section badge="Q8" title={t('survey.q8.title')}>
                        <div className="options-grid">
                            {[
                                { key: 'tokyo', label: t('survey.q8.tokyo') },
                                { key: 'kyoto', label: t('survey.q8.kyoto') },
                                { key: 'osaka', label: t('survey.q8.osaka') },
                                { key: 'hokkaido', label: t('survey.q8.hokkaido') },
                                { key: 'okinawa', label: t('survey.q8.okinawa') },
                                { key: 'nara', label: t('survey.q8.nara') },
                                { key: 'hiroshima', label: t('survey.q8.hiroshima') },
                                { key: 'fukuoka', label: t('survey.q8.fukuoka') }
                            ].map(opt => (
                                <Checkbox
                                    key={opt.key}
                                    label={opt.label}
                                    checked={formData.q8_visited_places.includes(opt.label)}
                                    onChange={() => handleMultiSelect('q8_visited_places', opt.label)}
                                />
                            ))}
                        </div>
                        <InputOther
                            value={formData.q8_other}
                            onChange={(e) => handleTextChange('q8_other', e.target.value)}
                            placeholder={t('survey.q8.other')}
                        />
                    </Section>

                    {/* Q9: Opinions */}
                    <Section badge="Q9" title={t('survey.q9.title')}>
                        <textarea
                            className="textarea-input"
                            placeholder={t('survey.q9.placeholder')}
                            value={formData.q9_feedback}
                            onChange={(e) => handleTextChange('q9_feedback', e.target.value)}
                        ></textarea>
                    </Section>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="submit-btn"
                    >
                        <span>{isSubmitting ? t('survey.submitting') : t('survey.submit')}</span>
                        {!isSubmitting && <Send size={20} />}
                    </button>

                </div>

                {/* Footer */}
            </div>
        </div>
    );
};

// --- Sub-components for cleaner code ---




const Section = ({ badge, title, children }: { badge: string, title: string, children: React.ReactNode }) => (
    <div className="survey-section">
        <div className="section-header">
            {/* The Gold Badge from the UI Reference */}
            <span className="section-badge">
                {badge}
            </span>
            <h3 className="section-title">
                {title}
            </h3>
        </div>
        <div className="section-body">
            {children}
        </div>
    </div>
);

const Checkbox = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: () => void }) => (
    <label className={`option-label ${checked ? 'checked' : ''}`}>
        <div className={`checkbox-box ${checked ? 'checked' : ''}`}>
            {checked && <Check size={14} className="text-white" />}
        </div>
        <input
            type="checkbox"
            className="hidden"
            checked={checked}
            onChange={onChange}
        />
        <span className={`option-text ${checked ? 'font-medium' : ''}`}>
            {label}
        </span>
    </label>
);

const Radio = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: () => void }) => (
    <label className={`option-label ${checked ? 'checked' : ''}`}>
        <div className={`radio-circle ${checked ? 'checked' : ''}`}>
            {checked && <div className="radio-dot" />}
        </div>
        <input
            type="radio"
            className="hidden"
            checked={checked}
            onChange={onChange}
        />
        <span className={`option-text ${checked ? 'font-medium' : ''}`}>
            {label}
        </span>
    </label>
);

const InputOther = ({ value, onChange, placeholder }: { value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder: string }) => (
    <div className="input-other-container">
        <input
            type="text"
            className="input-underline"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
        />
    </div>
);

export default SurveyDialog;
