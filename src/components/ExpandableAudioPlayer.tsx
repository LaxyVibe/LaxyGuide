import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getLanguageFromQuery } from '../utils/languageUtils';
import { useTranslation } from '../hooks/useTranslation';
import { parseSRT, type Subtitle } from '../utils/srtParser';
import './ExpandableAudioPlayer.css';
import playIcon from '../assets/icons/play.svg';
import pauseIcon from '../assets/icons/pause.svg';
import collapseIcon from '../assets/icons/collapse.svg';
import rewindIcon from '../assets/icons/rewind.svg';
import fastForwardIcon from '../assets/icons/fast-forward.svg';

interface ExpandableAudioPlayerProps {
    src?: string;
    subtitle?: string;
    title: string;
    artwork?: string;
}

const ExpandableAudioPlayer: React.FC<ExpandableAudioPlayerProps> = ({ src, subtitle, title, artwork }) => {
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

    const audioRef = useRef<HTMLAudioElement>(null);
    const subtitleContainerRef = useRef<HTMLDivElement>(null);
    const currentSubtitleRef = useRef<HTMLSpanElement>(null);
    const manualScrollTimerRef = useRef<number | null>(null);

    // Load subtitles when subtitle URL changes
    useEffect(() => {
        const loadSubtitles = async () => {
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
            } catch (error) {
                console.error('Failed to load subtitles:', error);
                setSubtitles([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadSubtitles();
    }, [subtitle]);

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
    }, [currentTime, subtitles]);

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

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleDurationChange = () => setDuration(audio.duration);
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => setIsPlaying(false);

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
    }, []);

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

    if (!src) return null;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className={`expandable-audio-player ${isExpanded ? 'expanded' : 'collapsed'}`}>
            <audio ref={audioRef} src={src} preload="metadata" />

            {/* Mini Player */}
            <div className="mini-player" onClick={() => setIsExpanded(true)}>
                <p className="mini-player-subtitle">{t('audioPlayer.clickToExpand')}</p>
                <div className="mini-player-bottom">
                    <div
                        className="mini-progress-section"
                        onClick={() => setIsExpanded(true)}
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
            <div className="player-container">
                <div className="player-header">
                    <h2 className="player-title">{title}</h2>
                    <button
                        className="close-button"
                        onClick={() => setIsExpanded(false)}
                        aria-label="Close"
                    >
                        <img src={collapseIcon} alt="Collapse" style={{ width: 42, height: 42 }} />
                    </button>
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
