import React, { useState, useEffect } from 'react';
import { ChevronLeft, Check, Send } from 'lucide-react';
import './SurveyDialog.css';

interface SurveyDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const SurveyDialog: React.FC<SurveyDialogProps> = ({ isOpen, onClose }) => {
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
        const hasPosterSelected = formData.q3_source.includes('Exhibition posters and leaflets');
        setShowQ4(hasPosterSelected);
    }, [formData.q3_source]);

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
                <h2 className="success-title">Thank you!</h2>
                <p className="success-message">
                    Please approach the staff to receive your small gift.
                </p>
                <button
                    onClick={onClose}
                    className="close-btn"
                >
                    Close
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
                        if (window.confirm("Are you sure you want to leave without saving?")) {
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
                            Exhibition Questionnaire
                        </h1>
                        <p className="survey-subtitle">We appreciate your cooperation.</p>
                    </div>

                    {/* Intro Text */}
                    <div className="survey-intro">
                        <p>
                            Thank you for visiting our museum today. We appreciate your cooperation in answering the following questionnaire.
                        </p>
                        <div className="gift-badge">
                            <p className="gift-text">
                                After answering, please approach staff for a small gift!
                            </p>
                        </div>
                    </div>

                    {/* Q1: Satisfaction */}
                    <Section badge="Q1" title="Satisfaction with the exhibition">
                        <div className="rating-container">
                            <div className="rating-labels">
                                <span>Very Dissatisfied</span>
                                <span>Very Satisfied</span>
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
                    <Section badge="Q2" title="Please tell us about what impressed you about this exbibition.">
                        <div className="options-grid">
                            {[
                                "Exhibition Theme",
                                "Exhibits",
                                "Special Events",
                                "Multilingual Support",
                            ].map(opt => (
                                <Checkbox
                                    key={opt}
                                    label={opt}
                                    checked={formData.q2_impressed.includes(opt)}
                                    onChange={() => handleMultiSelect('q2_impressed', opt)}
                                />
                            ))}
                        </div>
                        <InputOther
                            value={formData.q2_other}
                            onChange={(e) => handleTextChange('q2_other', e.target.value)}
                            placeholder="Other..."
                        />
                    </Section>

                    {/* Q3: Source */}
                    <Section badge="Q3" title="How did you come to know about this exhibition?">
                        <div className="options-grid">
                            {[
                                "Newspapers and Magazines",
                                "Exhibition posters and leaflets",
                                "SNS",
                                "Acquaintance",
                                "Dropped by chance",
                                "Websites"
                            ].map(opt => (
                                <Checkbox
                                    key={opt}
                                    label={opt}
                                    checked={formData.q3_source.includes(opt)}
                                    onChange={() => handleMultiSelect('q3_source', opt)}
                                />
                            ))}
                        </div>
                        {/* Conditional input field for Website detail, triggered by "Websites" selection */}
                        {formData.q3_source.includes("Websites") && (
                            <div className="input-other-container">
                                <input
                                    type="text"
                                    placeholder="Website name..."
                                    className="input-underline"
                                    value={formData.q3_website_name}
                                    onChange={(e) => handleTextChange('q3_website_name', e.target.value)}
                                />
                            </div>
                        )}
                        <InputOther
                            value={formData.q3_other}
                            onChange={(e) => handleTextChange('q3_other', e.target.value)}
                            placeholder="Other..."
                        />
                    </Section>

                    {/* Q4: Leaflet Location (Conditional) */}
                    {showQ4 && (
                        <div className="animate-fade-in-up">
                            <Section badge="Q4" title="If you selected [Exhibition poster and leafts] above, where did you see the posters and leaflets?">
                                <div className="options-grid">
                                    {[
                                        "Accommodation facility",
                                        "Station",
                                        "Tourist information center",
                                        "Restaurant"
                                    ].map(opt => (
                                        <Checkbox
                                            key={opt}
                                            label={opt}
                                            checked={formData.q4_poster_loc.includes(opt)}
                                            onChange={() => handleMultiSelect('q4_poster_loc', opt)}
                                        />
                                    ))}
                                </div>
                                <InputOther
                                    value={formData.q4_other}
                                    onChange={(e) => handleTextChange('q4_other', e.target.value)}
                                    placeholder="Other..."
                                />
                            </Section>
                        </div>
                    )}

                    {/* Q5: Multilingual Support */}
                    <Section badge="Q5" title="What kind of multilingual support do you need more on the services?">
                        <div className="options-list">
                            {[
                                "Information displays",
                                "Exhibition description detailed",
                                "Captions (list) of each exhibition",
                                "Audio Guide"
                            ].map(opt => (
                                <Checkbox
                                    key={opt}
                                    label={opt}
                                    checked={formData.q5_multilingual.includes(opt)}
                                    onChange={() => handleMultiSelect('q5_multilingual', opt)}
                                />
                            ))}
                        </div>
                        <InputOther
                            value={formData.q5_other}
                            onChange={(e) => handleTextChange('q5_other', e.target.value)}
                            placeholder="Other..."
                        />
                    </Section>

                    {/* Q6: Nationality */}
                    <Section badge="Q6" title="Nationality/Region">
                        <div className="select-wrapper">
                            <select
                                className="select-input"
                                value={formData.q6_nationality}
                                onChange={(e) => handleSingleSelect('q6_nationality', e.target.value)}
                            >
                                <option value="" disabled>Select your region</option>
                                {[
                                    "Korea", "China", "Taiwan", "Hong Kong", "Vietnam",
                                    "Thailand", "Singapore", "Philippines", "Indonesia", "Malaysia",
                                    "India", "The United States of America", "Canada", "United Kingdom",
                                    "France", "Germany", "Italy", "Spain", "Australia", "Other"
                                ].map((country, idx) => (
                                    // Using idx + 1 for display numbering (1. Korea, 2. China, etc.)
                                    <option key={idx} value={country}>{idx + 1}. {country}</option>
                                ))}
                            </select>
                            <div className="select-arrow">
                                <ChevronLeft size={20} className="-rotate-90" />
                            </div>
                        </div>
                        {formData.q6_nationality === 'Other' && (
                            <InputOther
                                value={formData.q6_other}
                                onChange={(e) => handleTextChange('q6_other', e.target.value)}
                                placeholder="Please specify..."
                            />
                        )}
                    </Section>

                    {/* Q7: Length of Stay */}
                    <Section badge="Q7" title="How long do you plan to stay in the area?">
                        <div className="options-list">
                            {[
                                "Day trip",
                                "1 to 2 nights",
                                "3 to 6 nights",
                                "1 to 2 weeks",
                                "More than 2 weeks but less than 1 month",
                                "1 month or more"
                            ].map(opt => (
                                <Radio
                                    key={opt}
                                    label={opt}
                                    checked={formData.q7_stay_length === opt}
                                    onChange={() => handleSingleSelect('q7_stay_length', opt)}
                                />
                            ))}
                        </div>
                    </Section>

                    {/* Q8: Other Places */}
                    <Section badge="Q8" title="Where else have you visited (or plan to visit) outside the local area?">
                        <div className="options-grid">
                            {[
                                "Tokyo", "Kyoto", "Osaka", "Hokkaido",
                                "Okinawa", "Nara", "Hiroshima", "Fukuoka"
                            ].map(opt => (
                                <Checkbox
                                    key={opt}
                                    label={opt}
                                    checked={formData.q8_visited_places.includes(opt)}
                                    onChange={() => handleMultiSelect('q8_visited_places', opt)}
                                />
                            ))}
                        </div>
                        <InputOther
                            value={formData.q8_other}
                            onChange={(e) => handleTextChange('q8_other', e.target.value)}
                            placeholder="Other (e.g. Beppu, Yufuin)..."
                        />
                    </Section>

                    {/* Q9: Opinions */}
                    <Section badge="Q9" title="Please feel free to fill in the form below if you have any opinion or suggestion regarding our efforts to improve the satisfaction of visitors to Japan.">
                        <textarea
                            className="textarea-input"
                            placeholder="Feel free to write here..."
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
                        <span>{isSubmitting ? 'Submitting...' : 'Submit Questionnaire'}</span>
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
