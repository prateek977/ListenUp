import React, { useState, useEffect } from 'react';

/**
 * QueuePanel
 * Dedicated Queue management panel accessible from Now Playing Card and bottom player.
 * 
 * Critical safety:
 * - Remains closed until user explicitly clicks the Queue button.
 * - Displays polished empty state if no upcoming tracks are queued.
 * - Clearly separates currently playing track from upcoming tracks.
 * - Supports instant playback, reordering (move up/down), item removal, and clearing upcoming tracks.
 */
export default function QueuePanel({
  isOpen = false,
  onClose,
  currentSong = null,
  isPlaying = false,
  queue = [],
  onPlaySong,
  onRemoveFromQueue,
  onRemoveSong,
  onMoveSong,
  onClearUpcoming,
  formatTime = (s) => `${s}s`,
  autoplayEnabled = true,
  onToggleAutoplay,
  onExploreClick
}) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) {
      setShowClearConfirm(false);
      return;
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Derive current song index and upcoming list
  const currentIdx = currentSong ? queue.findIndex(s => s.id === currentSong.id) : -1;
  const upcomingSongs = currentIdx >= 0 ? queue.slice(currentIdx + 1) : queue;

  const handleMoveUp = (indexInUpcoming) => {
    if (indexInUpcoming <= 0) return;
    const actualFrom = currentIdx >= 0 ? currentIdx + 1 + indexInUpcoming : indexInUpcoming;
    const actualTo = actualFrom - 1;
    onMoveSong?.(actualFrom, actualTo);
  };

  const handleMoveDown = (indexInUpcoming) => {
    if (indexInUpcoming >= upcomingSongs.length - 1) return;
    const actualFrom = currentIdx >= 0 ? currentIdx + 1 + indexInUpcoming : indexInUpcoming;
    const actualTo = actualFrom + 1;
    onMoveSong?.(actualFrom, actualTo);
  };

  const handleClear = () => {
    onClearUpcoming?.();
    setShowClearConfirm(false);
  };

  return (
    <div className="fixed inset-0 z-[105] flex justify-end select-none pointer-events-auto animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in Drawer Container */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="queue-panel-heading"
        className="relative w-full max-w-md h-full bg-[#101017] border-l border-white/[0.08] shadow-[-20px_0_50px_rgba(0,0,0,0.9)] flex flex-col z-10 text-[#F5F5F7] animate-slideLeft"
      >
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between bg-[#14141E]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#D5F36A]/10 border border-[#D5F36A]/20 flex items-center justify-center text-[#D5F36A]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </div>
            <div>
              <h2 id="queue-panel-heading" className="text-base font-bold text-[#F5F5F7] flex items-center gap-2">
                <span>Play Queue</span>
                {upcomingSongs.length > 0 && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#191922] text-[#D5F36A] border border-white/[0.08]">
                    {upcomingSongs.length} upcoming
                  </span>
                )}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Autoplay Toggle in Queue */}
            {onToggleAutoplay && (
              <button
                onClick={onToggleAutoplay}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1 ${
                  autoplayEnabled 
                    ? 'text-[#D5F36A] bg-[#D5F36A]/10 border-[#D5F36A]/30' 
                    : 'text-[#666674] bg-white/[0.02] border-white/[0.08] hover:text-[#9999A6]'
                }`}
                title={autoplayEnabled ? 'Autoplay is ON' : 'Autoplay is OFF'}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${autoplayEnabled ? 'bg-[#D5F36A] animate-pulse' : 'bg-[#666674]'}`} />
                <span>Autoplay</span>
              </button>
            )}

            <button
              onClick={onClose}
              aria-label="Close queue"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#9999A6] hover:text-[#F5F5F7] hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Clear Queue Confirmation Banner */}
        {showClearConfirm && (
          <div className="px-4 py-3 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between gap-2 text-xs">
            <span className="text-rose-300 font-medium">Clear all upcoming tracks?</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClear}
                className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold cursor-pointer transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-2.5 py-1 rounded-lg bg-white/[0.08] text-[#9999A6] hover:text-[#F5F5F7] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Queue Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 custom-scrollbar">
          {/* Section 1: Now Playing Track */}
          {currentSong && (
            <div>
              <div className="text-[10px] font-bold text-[#9999A6] uppercase tracking-widest font-mono mb-2 px-1">
                Now Playing
              </div>
              <div className="p-3 rounded-2xl bg-[#191922] border border-[#D5F36A]/40 shadow-[0_4px_20px_rgba(213,243,106,0.1)] flex items-center gap-3.5">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-black/60 border border-white/[0.08] flex-shrink-0">
                  <img src={currentSong.thumbnailUrl} alt={currentSong.title} className="w-full h-full object-cover" />
                  {isPlaying && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#D5F36A] animate-ping" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-[#D5F36A] truncate" title={currentSong.title}>
                    {currentSong.title}
                  </h4>
                  <p className="text-xs text-[#9999A6] truncate mt-0.5" title={currentSong.artist}>
                    {currentSong.artist}
                  </p>
                </div>
                {currentSong.duration && (
                  <span className="text-[11px] font-mono text-[#666674] flex-shrink-0">
                    {formatTime(currentSong.duration)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Section 2: Up Next */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-bold text-[#9999A6] uppercase tracking-widest font-mono">
                Up Next
              </span>
              {upcomingSongs.length > 0 && !showClearConfirm && (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="text-[11px] text-[#9999A6] hover:text-rose-400 font-medium transition-colors cursor-pointer"
                >
                  Clear Upcoming
                </button>
              )}
            </div>

            {/* Empty State vs Song List */}
            {upcomingSongs.length === 0 ? (
              <div className="py-12 px-6 rounded-3xl bg-white/[0.02] border border-dashed border-white/[0.08] text-center flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-[#191922] border border-white/[0.06] flex items-center justify-center text-[#666674] mb-3 shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-7 h-7">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a.75.75 0 00.532-.72v-4.99" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-[#F5F5F7] mb-1">Your queue is empty</h3>
                <p className="text-xs text-[#9999A6] max-w-[240px] leading-relaxed mb-4">
                  Add tracks using <span className="text-[#D5F36A]">"Play Next"</span> or <span className="text-[#D5F36A]">"Add to Queue"</span> from any song's three-dot menu.
                </p>
                {onExploreClick && (
                  <button
                    onClick={() => {
                      onExploreClick();
                      onClose?.();
                    }}
                    className="px-4 py-2 rounded-full bg-[#D5F36A] hover:bg-[#BDE84A] text-black font-extrabold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    Explore Songs
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {upcomingSongs.map((song, uIdx) => {
                  return (
                    <div
                      key={`${song.id}-${uIdx}`}
                      className="group flex items-center gap-3 p-2.5 rounded-2xl bg-[#14141E] hover:bg-[#191922] border border-white/[0.04] hover:border-white/[0.1] transition-all"
                    >
                      {/* Order Index */}
                      <span className="text-xs font-mono text-[#666674] w-5 text-center flex-shrink-0">
                        {uIdx + 1}
                      </span>

                      {/* Artwork */}
                      <div 
                        onClick={() => onPlaySong?.(song)}
                        className="relative w-11 h-11 rounded-xl overflow-hidden bg-black/60 flex-shrink-0 cursor-pointer"
                      >
                        <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#D5F36A]">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>

                      {/* Title & Artist */}
                      <div 
                        onClick={() => onPlaySong?.(song)}
                        className="min-w-0 flex-1 cursor-pointer"
                      >
                        <h4 className="text-xs sm:text-sm font-semibold text-[#F5F5F7] group-hover:text-[#D5F36A] transition-colors truncate">
                          {song.title}
                        </h4>
                        <p className="text-[11px] text-[#9999A6] truncate mt-0.5">{song.artist}</p>
                      </div>

                      {/* Controls: Reorder Up/Down + Remove */}
                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleMoveUp(uIdx)}
                          disabled={uIdx === 0}
                          title="Move Up"
                          aria-label="Move Up"
                          className="p-1.5 rounded-lg text-[#9999A6] hover:text-[#D5F36A] hover:bg-white/[0.06] disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleMoveDown(uIdx)}
                          disabled={uIdx === upcomingSongs.length - 1}
                          title="Move Down"
                          aria-label="Move Down"
                          className="p-1.5 rounded-lg text-[#9999A6] hover:text-[#D5F36A] hover:bg-white/[0.06] disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const fn = onRemoveFromQueue || onRemoveSong;
                            fn?.(song.id, uIdx);
                          }}
                          title="Remove from Queue"
                          aria-label="Remove from Queue"
                          className="p-1.5 rounded-lg text-[#9999A6] hover:text-rose-400 hover:bg-white/[0.06] transition-colors cursor-pointer ml-1"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

