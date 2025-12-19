import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { getLanguageFromQuery } from '../utils/languageUtils';
import { useTranslation } from '../hooks/useTranslation';
import { type Subtitle, type Slide } from '../types';
import { parseSRT } from '../utils/srtParser';
import { parseTTML, type TTMLData } from '../utils/ttmlParser';
import './ExpandableAudioPlayer.css';
import playIcon from '../assets/icons/play.svg';
import pauseIcon from '../assets/icons/pause.svg';
import collapseIcon from '../assets/icons/collapse.svg';
import rewindIcon from '../assets/icons/rewind.svg';
import fastForwardIcon from '../assets/icons/fast-forward.svg';

interface ExpandableAudioPlayerProps {
    src?: string;
    subtitle?: string;
    ttml?: string;
    title: string;
    artwork?: string;
}

const ExpandableAudioPlayer: React.FC<ExpandableAudioPlayerProps> = ({ src, subtitle, ttml, title, artwork }) => {
    const [searchParams] = useSearchParams();
    const lang = getLanguageFromQuery(searchParams);
    const { t } = useTranslation(lang);

    const [isExpanded, setIsExpanded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
    const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState(-1);
    const [isManualScroll, setIsManualScroll] = useState(false);
    const [isBackwardAnimating, setIsBackwardAnimating] = useState(false);
    const [isForwardAnimating, setIsForwardAnimating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [ttmlData, setTTMLData] = useState<TTMLData | null>(null);
    const [slides, setSlides] = useState<Slide[]>([]);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(-1);
    const [activeAudioSrc, setActiveAudioSrc] = useState<string | undefined>(src);

    const audioRef = useRef<HTMLAudioElement>(null);
    const subtitleContainerRef = useRef<HTMLDivElement>(null);
    const currentSubtitleRef = useRef<HTMLSpanElement>(null);
    const manualScrollTimerRef = useRef<number | null>(null);
    const milestonesSentRef = useRef<Set<number>>(new Set());

    // Reset milestones when src changes
    useEffect(() => {
        milestonesSentRef.current.clear();
    }, [src]);

    // Load subtitles or TTML when URLs change
    useEffect(() => {
        const loadContent = async () => {
            if (ttml) {
                try {
                    setIsLoading(true);
                    const response = await fetch(ttml);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const xml = await response.text();
                    const parsed = parseTTML(xml);
                    setTTMLData(parsed);
                } catch (error) {
                    console.error('Failed to load TTML:', error);
                } finally {
                    setIsLoading(false);
                }
                return;
            }

            if (!subtitle) {
                setSubtitles([]);
                return;
            }

            try {
                setIsLoading(true);
                const response = await fetch(subtitle);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const srtContent = await response.text();
                const parsedSubtitles = parseSRT(srtContent);
                setSubtitles(parsedSubtitles);
                setTTMLData(null); // Clear TTML data if using SRT
            } catch (error) {
                console.error('Failed to load subtitles:', error);
                setSubtitles([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadContent();
    }, [subtitle, ttml]);

    // Update language-specific content when lang or ttmlData changes
    useEffect(() => {
        if (ttmlData) {
            // Priority 1: Current language
            // Priority 2: en-US
            // Priority 3: First available
            const availableLangs = Object.keys(ttmlData.audioSources);
            const targetLang = availableLangs.includes(lang) ? lang : (availableLangs.includes('en-US') ? 'en-US' : availableLangs[0]);

            if (targetLang) {
                setActiveAudioSrc(ttmlData.audioSources[targetLang]);
                setSubtitles(ttmlData.subtitles[targetLang] || []);
                setSlides(ttmlData.slides[targetLang] || []);
            }
        } else {
            setActiveAudioSrc(src);
        }
    }, [lang, ttmlData, src]);

    // Update current subtitle based on time
    useEffect(() => {
        let newIndex = -1;
        // Find the LAST subtitle that matches the current time.
        // This handles overlapping times or ensures we pick the most relevant one if logic was slightly off.
        // But for standard SRT, they shouldn't overlap much.
        // The issue "more than one sentence highlighted" suggests the previous index isn't being cleared
        // or the loop finds multiple matches (which shouldn't happen with standard SRT unless times overlap).
        // However, the state `currentSubtitleIndex` is a single number, so only one can be active at a time
        // in the render loop: `const isCurrent = index === currentSubtitleIndex;`.

        // Wait, if the user says "more than one sentence highlighted", maybe the CSS class isn't being removed?
        // Or maybe `currentSubtitleIndex` isn't updating correctly?
        // Ah, if I use a loop and break, it finds the *first* match.

        for (let i = 0; i < subtitles.length; i++) {
            const sub = subtitles[i];
            if (currentTime >= sub.startTime && currentTime <= sub.endTime) {
                newIndex = i;
                // break; // Don't break. If subtitles overlap at boundaries (e.g. 5.0s), we want the LATEST one.
            }
        }

        // If no match found (e.g. gap between subtitles), newIndex remains -1.
        // This should correctly de-highlight everything.

        if (currentSubtitleIndex !== newIndex) {
            setCurrentSubtitleIndex(newIndex);
        }

        // Update slides
        let newSlideIndex = -1;
        for (let i = 0; i < slides.length; i++) {
            const slide = slides[i];
            if (currentTime >= slide.startTime && currentTime <= slide.endTime) {
                newSlideIndex = i;
            }
        }
        if (currentSlideIndex !== newSlideIndex) {
            setCurrentSlideIndex(newSlideIndex);
        }
    }, [currentTime, subtitles, slides]);

    // Auto-scroll to current subtitle
    useEffect(() => {
        if (!isManualScroll && currentSubtitleRef.current && subtitleContainerRef.current && isExpanded) {
            const container = subtitleContainerRef.current;
            const element = currentSubtitleRef.current;

            const containerRect = container.getBoundingClientRect();
            const elementRect = element.getBoundingClientRect();

            const scrollTo = element.offsetTop - (containerRect.height / 2) + (elementRect.height / 2);
            const boundedScrollTo = Math.max(0, Math.min(scrollTo, container.scrollHeight - containerRect.height));

            container.scrollTo({
                top: boundedScrollTo,
                behavior: 'smooth'
            });
        }
    }, [currentSubtitleIndex, isManualScroll, isExpanded]);

    // Audio event handlers
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);

            // Track progress milestones
            if (audio.duration > 0) {
                const progress = (audio.currentTime / audio.duration) * 100;
                const milestones = [25, 50, 75];

                milestones.forEach(milestone => {
                    if (progress >= milestone && !milestonesSentRef.current.has(milestone)) {
                        milestonesSentRef.current.add(milestone);
                        ReactGA.event({
                            category: "Media",
                            action: `Audio Progress ${milestone}%`,
                            label: title
                        });
                    }
                });
            }
        };
        const handleDurationChange = () => setDuration(audio.duration);
        const handlePlay = () => {
            setIsPlaying(true);
            ReactGA.event({
                category: "Media",
                action: "Play Audio",
                label: title
            });
        };
        const handlePause = () => {
            setIsPlaying(false);
            ReactGA.event({
                category: "Media",
                action: "Pause Audio",
                label: title
            });
        };
        const handleEnded = () => {
            setIsPlaying(false);
            ReactGA.event({
                category: "Media",
                action: "Finish Audio",
                label: title
            });
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('durationchange', handleDurationChange);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('durationchange', handleDurationChange);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [title]);

    // Media Session API
    useEffect(() => {
        if ('mediaSession' in navigator && audioRef.current) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: 'Laxy Guide',
                artwork: artwork ? [{ src: artwork, sizes: '512x512', type: 'image/jpeg' }] : []
            });

            const audio = audioRef.current;

            navigator.mediaSession.setActionHandler('play', () => {
                audio.play();
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                audio.pause();
            });
            navigator.mediaSession.setActionHandler('seekbackward', (details) => {
                const skipTime = details.seekOffset || 15;
                audio.currentTime = Math.max(audio.currentTime - skipTime, 0);
            });
            navigator.mediaSession.setActionHandler('seekforward', (details) => {
                const skipTime = details.seekOffset || 15;
                audio.currentTime = Math.min(audio.currentTime + skipTime, audio.duration);
            });
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime && details.fastSeek && 'fastSeek' in audio) {
                    audio.fastSeek(details.seekTime);
                } else if (details.seekTime) {
                    audio.currentTime = details.seekTime;
                }
            });
        }
    }, [title, artwork]);

    // Cleanup manual scroll timer
    useEffect(() => {
        return () => {
            if (manualScrollTimerRef.current) {
                clearTimeout(manualScrollTimerRef.current);
            }
        };
    }, []);

    const togglePlayPause = () => {
        if (audioRef.current) {
            if (audioRef.current.paused) {
                audioRef.current.play();
            } else {
                audioRef.current.pause();
            }
        }
    };

    const handleSkipBackward = () => {
        if (audioRef.current) {
            setIsBackwardAnimating(true);
            audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 15);
            setTimeout(() => setIsBackwardAnimating(false), 200);
            setIsManualScroll(false); // Reset manual scroll to allow auto-scroll
        }
    };

    const handleSkipForward = () => {
        if (audioRef.current) {
            setIsForwardAnimating(true);
            audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 15);
            setTimeout(() => setIsForwardAnimating(false), 200);
            setIsManualScroll(false); // Reset manual scroll to allow auto-scroll
        }
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (audioRef.current) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = x / rect.width;
            audioRef.current.currentTime = percentage * duration;
            setIsManualScroll(false); // Reset manual scroll to allow auto-scroll
        }
    };

    const handleSubtitleClick = (index: number) => {
        if (audioRef.current && subtitles[index]) {
            ReactGA.event({
                category: "Media",
                action: "Click Subtitle",
                label: title
            });
            audioRef.current.currentTime = subtitles[index].startTime;
            if (!isPlaying) {
                audioRef.current.play();
            }
            setIsManualScroll(false); // Reset manual scroll to allow auto-scroll
        }
    };

    const handleUserScrollInteraction = () => {
        if (!isManualScroll) {
            setIsManualScroll(true);
        }

        if (manualScrollTimerRef.current) {
            clearTimeout(manualScrollTimerRef.current);
        }

        manualScrollTimerRef.current = setTimeout(() => {
            setIsManualScroll(false);
        }, 5000);
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleExpand = () => {
        setIsExpanded(true);
        ReactGA.event({
            category: "Media",
            action: "Expand Player",
            label: title
        });
    };

    const handleCollapse = () => {
        setIsExpanded(false);
        ReactGA.event({
            category: "Media",
            action: "Collapse Player",
            label: title
        });
    };

    if (!src) return null;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className={`expandable-audio-player ${isExpanded ? 'expanded' : 'collapsed'}`}>
            <audio ref={audioRef} src={activeAudioSrc} preload="metadata" />

            {/* Mini Player */}
            <div className="mini-player" onClick={handleExpand}>
                <p className="mini-player-subtitle">{t('audioPlayer.clickToExpand')}</p>
                <div className="mini-player-bottom">
                    <div
                        className="mini-progress-section"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleExpand();
                        }}
                        role="button"
                        aria-label="Open player"
                    >
                        <div className="mini-progress-bar">
                            <div
                                className="mini-progress-fill"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                    <div className="mini-player-controls" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="control-button play-pause"
                            onClick={togglePlayPause}
                            aria-label={isPlaying ? 'Pause' : 'Play'}
                        >
                            <img src={isPlaying ? pauseIcon : playIcon} alt={isPlaying ? 'Pause' : 'Play'} style={{ width: 42, height: 42, filter: 'brightness(0) invert(1)' }} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Expanded Player */}
            <div className={`player-container ${slides.length > 0 ? 'with-slides' : ''}`}>
                <div className="player-header">
                    <h2 className="player-title">{title}</h2>
                    <button
                        className="close-button"
                        onClick={handleCollapse}
                        aria-label="Close"
                    >
                        <img src={collapseIcon} alt="Collapse" style={{ width: 42, height: 42 }} />
                    </button>
                </div>

                {/* Slide Viewer */}
                <div className="slide-viewer">
                    {slides.length > 0 ? (
                        currentSlideIndex !== -1 ? (
                            <img
                                src={slides[currentSlideIndex].image}
                                alt={`Slide ${currentSlideIndex + 1}`}
                                className="slide-image"
                            />
                        ) : (
                            <div className="slide-placeholder">
                                <span>No slide for current time</span>
                            </div>
                        )
                    ) : (
                        <div className="slide-placeholder">
                            <span>{artwork ? <img src={artwork} alt={title} className="slide-image" /> : 'Audio Guide'}</span>
                        </div>
                    )}
                </div>

                <div
                    className="subtitle-container"
                    ref={subtitleContainerRef}
                    onWheel={handleUserScrollInteraction}
                    onTouchStart={handleUserScrollInteraction}
                >
                    {subtitles.length > 0 ? (
                        <div className="subtitle-text">
                            {subtitles.map((subtitle, index) => {
                                const isCurrent = index === currentSubtitleIndex;
                                return (
                                    <React.Fragment key={index}>
                                        <span
                                            ref={isCurrent ? currentSubtitleRef : null}
                                            className={`subtitle-segment ${isCurrent ? 'active' : ''}`}
                                            onClick={() => handleSubtitleClick(index)}
                                        >
                                            {subtitle.text}
                                        </span>
                                        {' '}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="no-subtitles">
                            {isLoading ? t('audioPlayer.loadingSubtitles') : t('audioPlayer.noSubtitles')}
                        </div>
                    )}
                </div>

                <div className="player-controls">
                    <div className="progress-section">
                        <div className="progress-bar" onClick={handleProgressClick}>
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${progress}%` }}
                            />
                            <div
                                className="progress-thumb"
                                style={{ left: `${progress}%` }}
                            />
                        </div>
                        <div className="time-display">
                            <span>{formatTime(currentTime)}</span>
                            <span>-{formatTime(duration - currentTime)}</span>
                        </div>
                    </div>

                    <div className="control-buttons">
                        <button
                            className={`control-button skip-button ${isBackwardAnimating ? 'animating backward' : ''}`}
                            onClick={handleSkipBackward}
                            aria-label="Rewind 15 seconds"
                        >
                            <img src={rewindIcon} alt="Rewind 15 seconds" style={{ width: 40, height: 40 }} />
                        </button>

                        <button
                            className="control-button play-pause"
                            onClick={togglePlayPause}
                            aria-label={isPlaying ? 'Pause' : 'Play'}
                        >
                            <img src={isPlaying ? pauseIcon : playIcon} alt={isPlaying ? 'Pause' : 'Play'} style={{ width: 24, height: 24, filter: 'brightness(0) saturate(100%) invert(72%) sepia(16%) saturate(1024%) hue-rotate(343deg) brightness(95%) contrast(86%)' }} />
                        </button>

                        <button
                            className={`control-button skip-button ${isForwardAnimating ? 'animating forward' : ''}`}
                            onClick={handleSkipForward}
                            aria-label="Forward 15 seconds"
                        >
                            <img src={fastForwardIcon} alt="Forward 15 seconds" style={{ width: 40, height: 40 }} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpandableAudioPlayer;
