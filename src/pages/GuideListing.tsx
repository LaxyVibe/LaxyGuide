import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAllGuides, getGuideAvailableLanguages, type GuideSummary } from '../utils/contentLoader';
import './GuideListing.css';

interface GuideWithLanguages extends GuideSummary {
    languages: string[];
}

const GuideListing: React.FC = () => {
    const [guides, setGuides] = useState<GuideWithLanguages[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchGuides = async () => {
            try {
                // Default to en-US for the listing initial load
                const data = await loadAllGuides('en-US');
                // Fetch available languages for each guide
                const guidesWithLangs = await Promise.all(
                    data.map(async (guide) => {
                        const languages = await getGuideAvailableLanguages(guide.id);
                        return { ...guide, languages };
                    })
                );
                setGuides(guidesWithLangs);
            } catch (error) {
                console.error("Failed to load guides:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchGuides();
    }, []);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading Guides...</p>
            </div>
        );
    }

    return (
        <div className="guide-listing-page">
            <header className="guide-listing-header">
                <h1>Laxy Guide Staging</h1>
                <p>Select a guide to preview</p>
            </header>

            <main className="guide-grid">
                {guides.map((guide) => (
                    <div
                        key={guide.id}
                        className="guide-card"
                        onClick={() => navigate(`/${guide.id}`)}
                    >
                        <div
                            className="guide-card-image"
                            style={{ backgroundImage: guide.image ? `url(${guide.image})` : 'none' }}
                        >
                            {!guide.image && <div className="guide-card-placeholder">No Image</div>}
                            <div className="guide-card-overlay">
                                <h3>{guide.title}</h3>
                                <span className="guide-code">{guide.id}</span>
                                <div className="guide-languages">
                                    {guide.languages.map((lang) => (
                                        <span key={lang} className="language-tag">{lang}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </main>

            {guides.length === 0 && (
                <div className="no-guides">
                    <p>No guides found.</p>
                </div>
            )}
        </div>
    );
};

export default GuideListing;
