import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { POI } from '../types';
import { getLanguageFromQuery } from '../utils/languageUtils';
import ViewTransitionLink from './ViewTransitionLink';
import './PoiList.css';

interface PoiListProps {
    pois: POI[];
}

const PoiList: React.FC<PoiListProps> = ({ pois }) => {
    const { guideId } = useParams<{ guideId: string }>();
    const [searchParams] = useSearchParams();
    const lang = getLanguageFromQuery(searchParams);

    return (
        <div className="poi-list">
            {pois.map((poi) => (
                <ViewTransitionLink key={poi.number} to={`/${guideId}/${poi.number}?t=${lang}`} className="poi-list-item">
                    <div className="poi-number">{poi.number}</div>
                    <div className="poi-thumbnail">
                        <img src={poi.hero} alt={poi.title} loading="lazy" />
                    </div>
                    <div className="poi-title">{poi.title}</div>
                    {poi.withAudio && (
                        <div className="poi-audio-icon" role="img" aria-label="Audio available">
                            <span className="poi-audio-glyph" aria-hidden="true" />
                        </div>
                    )}
                </ViewTransitionLink>
            ))}
        </div>
    );
};

export default PoiList;
