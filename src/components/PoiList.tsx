import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { POI } from '../types';
import { getLanguageFromQuery } from '../utils/languageUtils';
import ViewTransitionLink from './ViewTransitionLink';
import './DisplayItemList.css';

interface PoiListProps {
    pois: POI[];
}

const PoiList: React.FC<PoiListProps> = ({ pois }) => {
    const { guideId } = useParams<{ guideId: string }>();
    const [searchParams] = useSearchParams();
    const lang = getLanguageFromQuery(searchParams);

    return (
        <div className="display-item-list">
            <div className="items-grid">
                {pois.map((poi) => (
                    <ViewTransitionLink key={poi.number} to={`/${guideId}/${poi.number}?t=${lang}`} className="item-card">
                        <div className="item-image">
                            <img src={poi.hero} alt={poi.title} loading="lazy" />
                            {poi.withAudio && (
                                <div className="audio-icon-overlay">
                                    🔊
                                </div>
                            )}
                        </div>

                        <div className="item-content">
                            <span className="item-year" style={{ color: '#666', fontSize: '0.9rem' }}>#{poi.number}</span>
                            <h3 className="item-title">{poi.title}</h3>
                        </div>
                    </ViewTransitionLink>
                ))}
            </div>
        </div>
    );
};

export default PoiList;
