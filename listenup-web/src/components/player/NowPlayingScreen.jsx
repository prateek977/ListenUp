import React, { useState, useEffect, useRef } from 'react';
import AlbumArtwork from './AlbumArtwork';
import TrackMetadata from './TrackMetadata';
import PlaybackProgress from './PlaybackProgress';
import PlaybackControls from './PlaybackControls';

/**
 * NowPlayingScreen
 * Full-screen immersive dark music player:
 * - Deep black atmospheric surface (#08080D)
 * - Large square artwork with rounded corners & soft elevation
 * - Subtle blurred ambient background derived from album artwork
 * - Clean typography hierarchy (#F5F5F7 & #9999A6)
 * - Lime-green accents (#D5F36A) for playback progress & master play/pause
 * - Functional controls: Like, Add to Playlist, Shuffle, Queue, More Options (3-dot)
 * - Smooth touch-drag dismiss & in-screen queue sheet
 */
export default function NowPlayingScreen({
  isOpen = false,
  onClose,
  currentSong,
  isPlaying = false,
  isBuffering = false,
  currentTime = 0,
  duration = 0,
  onPlayPause,
  onPrevious,
  onNext,
  onSeek,
  formatTime = (s) => `${s}s`,
  shuffle = false,
  onToggleShuffle,
  repeat = 'off',
  onToggleRepeat,
  favorites = [],
  onToggleFavorite,
  onAddToPlaylist,
  onOpenMoreOptions,
  queue = [],
  onPlayFromQueue,
  onRemoveFromQueue,
  onRemoveSong,
  onMoveSong,
  onClearUpcoming,
  activeRoom = null,
  volume = 100,
  isMuted = false,
  onVolumeChange,
  onToggleMute
}) {
  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const containerRef = useRef(null);

  // Derive current song index and upcoming songs
  const currentIdx = currentSong ? queue.findIndex(s => s.id === currentSong.id) : -1;
  const upcomingSongs = currentIdx >= 0 ? queue.slice(currentIdx + 1) : queue;

  // Keyboard accessibility
  useEffect(() => {
    if (!isOpen) {
      setIsQueueDrawerOpen(false);
      return;
    }

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'Escape') {
        if (isQueueDrawerOpen) {
          setIsQueueDrawerOpen(false);
        } else {
          onClose?.();
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        onPlayPause?.();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onSeek?.({ target: { value: Math.min(currentTime + 5, duration || 100) } });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onSeek?.({ target: { value: Math.max(currentTime - 5, 0) } });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isQueueDrawerOpen, onClose, onPlayPause, onSeek, currentTime, duration]);

  // Touch swipe-down to dismiss
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e) => {
    if (!touchStart) return;
    const currentY = e.targetTouches[0].clientY;
    const diff = currentY - touchStart;
    if (diff > 120 && !isQueueDrawerOpen) {
      onClose?.();
      setTouchStart(null);
    }
  };

  const handleTouchEnd = () => {
    setTouchStart(null);
  };

  if (!isOpen) return null;

  const thumbnailUrl = currentSong?.thumbnailUrl || '/default-artwork.svg';
  const isFavorite = currentSong ? favorites.some(s => s.id === currentSong.id) : false;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-50 overflow-hidden flex flex-col justify-between bg-[#08080D] text-[#F5F5F7] select-none animate-fadeIn"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))'
      }}
    >
      {/* 1. Ambient Blurred Artwork & Deep Background Layers */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-700 scale-125 filter blur-3xl opacity-25"
          style={{ backgroundImage: `url(${thumbnailUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#08080D]/85 via-[#08080D]/95 to-[#08080D]" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-[#D5F36A]/5 rounded-full filter blur-[120px] pointer-events-none" />
      </div>

      {/* 2. Top Header Navigation Bar */}
      <header className="relative z-20 w-full max-w-lg mx-auto flex items-center justify-between px-4 sm:px-6 py-2">
        {/* Minimize / Close Button */}
        <button
          onClick={onClose}
          aria-label="Collapse Now Playing"
          title="Minimize player"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[#9999A6] hover:text-[#F5F5F7] hover:bg-white/[0.08] active:scale-90 transition-all cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {/* Center Context Label */}
        <div className="text-center min-w-0 px-2">
          <p className="text-[10px] font-bold tracking-widest uppercase text-[#9999A6]">
            {activeRoom ? `Room • ${activeRoom}` : 'Now Playing'}
          </p>
          <p className="text-xs font-semibold text-[#F5F5F7] truncate max-w-[200px] sm:max-w-[260px]">
            {currentSong ? currentSong.title : 'ListenUp Stream'}
          </p>
        </div>

        {/* Queue Button in Header */}
        <button
          onClick={() => setIsQueueDrawerOpen(!isQueueDrawerOpen)}
          aria-label="Toggle Queue"
          title="View upcoming queue"
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-all cursor-pointer relative ${
            isQueueDrawerOpen ? 'text-[#D5F36A] bg-white/[0.08]' : 'text-[#9999A6] hover:text-[#F5F5F7] hover:bg-white/[0.08]'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
          {upcomingSongs.length > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#D5F36A]" />
          )}
        </button>
      </header>

      {/* 3. Center Section: Large Square Album Artwork with Rounded Corners */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-6 py-2 min-h-0 w-full max-w-lg mx-auto">
        <div className="w-full max-w-[320px] sm:max-w-[360px] md:max-w-[380px] aspect-square flex items-center justify-center">
          <AlbumArtwork
            src={thumbnailUrl}
            alt={currentSong ? currentSong.title : 'ListenUp Artwork'}
            isPlaying={isPlaying}
            className="w-full h-full"
          />
        </div>

        {/* Track Title, Artist, Favorite, Add to Playlist & More Options */}
        <div className="w-full mt-6 sm:mt-8">
          <TrackMetadata
            song={currentSong}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            onAddToPlaylist={onAddToPlaylist}
            onOpenMoreOptions={onOpenMoreOptions}
          />
        </div>
      </main>

      {/* 4. Bottom Controls & Progress Section */}
      <footer className="relative z-20 w-full max-w-lg mx-auto flex flex-col items-center gap-3 pb-2 px-4 sm:px-6">
        {/* Playback Scrubber Bar */}
        <PlaybackProgress
          currentTime={currentTime}
          duration={duration}
          onSeek={onSeek}
          formatTime={formatTime}
          disabled={!currentSong}
        />

        {/* Master Playback Controls */}
        <PlaybackControls
          isPlaying={isPlaying}
          isBuffering={isBuffering}
          onPlayPause={onPlayPause}
          onPrevious={onPrevious}
          onNext={onNext}
          shuffle={shuffle}
          onToggleShuffle={onToggleShuffle}
          repeat={repeat}
          onToggleRepeat={onToggleRepeat}
          isPrevDisabled={queue.length === 0}
          isNextDisabled={queue.length === 0}
          onToggleQueue={() => setIsQueueDrawerOpen(!isQueueDrawerOpen)}
          isQueueOpen={isQueueDrawerOpen}
          queueCount={upcomingSongs.length}
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={onVolumeChange}
          onToggleMute={onToggleMute}
        />
      </footer>

      {/* 5. In-Screen Queue Drawer (Slide-up sheet) */}
      {isQueueDrawerOpen && (
        <div 
          className="fixed inset-x-0 bottom-0 top-20 z-40 bg-[#101017]/98 backdrop-blur-2xl border-t border-white/[0.08] rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.95)] flex flex-col animate-slideUp"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          {/* Drawer Handle & Header */}
          <div className="w-full flex flex-col items-center pt-3 pb-2 px-6 border-b border-white/[0.08]">
            <div className="w-10 h-1 rounded-full bg-white/20 mb-3 cursor-pointer" onClick={() => setIsQueueDrawerOpen(false)} />
            <div className="w-full flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#F5F5F7] flex items-center gap-2">
                  <span>Up Next</span>
                  {upcomingSongs.length > 0 && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#191922] text-[#D5F36A] border border-white/[0.08]">
                      {upcomingSongs.length} upcoming
                    </span>
                  )}
                </h3>
                <p className="text-xs text-[#9999A6]">Upcoming tracks will play in this order</p>
              </div>

              <div className="flex items-center gap-2">
                {upcomingSongs.length > 0 && onClearUpcoming && (
                  <button
                    onClick={() => {
                      onClearUpcoming();
                    }}
                    className="text-xs font-medium text-[#9999A6] hover:text-rose-400 px-2 py-1 transition-colors cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsQueueDrawerOpen(false);
                  }}
                  title="Close Up Next"
                  aria-label="Close Up Next"
                  className="p-2 rounded-full hover:bg-white/[0.08] text-[#9999A6] hover:text-[#F5F5F7] transition-colors cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Queue Song List */}
          <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar divide-y divide-white/[0.04]">
            {upcomingSongs.length === 0 ? (
              <div className="py-16 text-center text-[#666674] flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-[#666674] mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a.75.75 0 00.532-.72v-4.99" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-[#F5F5F7]">Your queue is empty.</p>
                <p className="text-xs text-[#9999A6] mt-1">Use "Play Next" or "Add to Queue" from any track's menu.</p>
              </div>
            ) : (
              upcomingSongs.map((song, idx) => {
                const actualFrom = currentIdx >= 0 ? currentIdx + 1 + idx : idx;
                return (
                  <div
                    key={`${song.id}-${idx}`}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-2xl transition-all group hover:bg-white/[0.04]"
                  >
                    <span className="text-xs font-mono text-[#666674] w-5 text-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div 
                      onClick={() => {
                        onPlayFromQueue?.(song);
                        setIsQueueDrawerOpen(false);
                      }}
                      className="w-11 h-11 rounded-xl overflow-hidden bg-black/60 flex-shrink-0 cursor-pointer"
                    >
                      <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                    <div 
                      onClick={() => {
                        onPlayFromQueue?.(song);
                        setIsQueueDrawerOpen(false);
                      }}
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      <h4 className="text-xs sm:text-sm font-semibold text-[#F5F5F7] group-hover:text-[#D5F36A] truncate">
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-[#9999A6] truncate mt-0.5">{song.artist}</p>
                    </div>

                    {/* Move Up/Down & Remove Action Controls */}
                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      {onMoveSong && (
                        <>
                          <button
                            onClick={() => onMoveSong(actualFrom, actualFrom - 1)}
                            disabled={idx === 0}
                            title="Move Up"
                            className="p-1.5 rounded-lg text-[#9999A6] hover:text-[#D5F36A] disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                            </svg>
                          </button>
                          <button
                            onClick={() => onMoveSong(actualFrom, actualFrom + 1)}
                            disabled={idx === upcomingSongs.length - 1}
                            title="Move Down"
                            className="p-1.5 rounded-lg text-[#9999A6] hover:text-[#D5F36A] disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                        </>
                      )}
                      {(onRemoveFromQueue || onRemoveSong) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const fn = onRemoveFromQueue || onRemoveSong;
                            fn?.(song.id, idx);
                          }}
                          title="Remove from queue"
                          aria-label="Remove from queue"
                          className="p-1.5 rounded-lg text-[#9999A6] hover:text-rose-400 cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
