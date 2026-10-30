import React from 'react';

/**
 * SongCard
 * Premium music streaming card matching ListenUp design system:
 * - Default 16:10 landscape orientation matching reference UI
 * - Full cinematic artwork with subtle bottom vignette
 * - Bottom title & artist metadata with circular play button
 * - Context menu trigger & duration / live playback equalizer
 * - Robust image fallback & accessibility support
 */
export default function SongCard({
  song,
  playlist = null,
  isCurrent = false,
  isPlaying = false,
  isFav = false,
  onClick,
  onPlay,
  onOpenMenu,
  onOpenContextMenu,
  formatTime = (s) => {
    if (!s) return '';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  },
  variant = 'landscape',
  className = ''
}) {
  if (!song) return null;

  const handleCardClick = (e) => {
    if (onClick) {
      onClick(e);
    } else if (onPlay) {
      onPlay(song, playlist || [song]);
    }
  };

  const handleMenuClick = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    if (onOpenMenu) {
      onOpenMenu(song, rect);
    } else if (onOpenContextMenu) {
      onOpenContextMenu(song, rect);
    }
  };

  const isLandscape = variant === 'landscape';

  return (
    <div
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick(e);
        }
      }}
      className={`${
        isLandscape ? 'w-52 sm:w-60 flex-shrink-0' : 'w-36 sm:w-44 flex-shrink-0'
      } group cursor-pointer select-none focus:outline-none ${className}`}
    >
      <div
        className={`relative ${
          isLandscape ? 'aspect-[16/10]' : 'aspect-square'
        } w-full rounded-2xl overflow-hidden bg-[#12121A] border transition-all duration-300 ${
          isCurrent
            ? 'border-[#D5F36A] shadow-[0_0_20px_rgba(213,243,106,0.35)] ring-1 ring-[#D5F36A]'
            : 'border-white/[0.08] group-hover:border-[#D5F36A]/50 group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.8)]'
        }`}
      >
        {/* Cover Artwork */}
        <img
          src={song.thumbnailUrl || '/default-artwork.svg'}
          alt={song.title}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = '/default-artwork.svg';
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Ambient Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0F] via-[#0B0B0F]/50 to-transparent pointer-events-none" />

        {/* Top Badges: Playing Equalizer / Duration & Three-Dot Context Menu */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-auto z-10">
          {/* Left: Duration or Playing Equalizer Animation */}
          {isCurrent && isPlaying ? (
            <div className="bg-black/85 backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1 border border-[#D5F36A]/40 shadow-sm pointer-events-none">
              <span className="eq-bar !h-3 bg-[#D5F36A]" />
              <span className="eq-bar !h-4 bg-[#D5F36A]" />
              <span className="eq-bar !h-2 bg-[#D5F36A]" />
            </div>
          ) : song.duration ? (
            <span className="text-[10px] font-mono font-semibold bg-black/75 backdrop-blur-md px-1.5 py-0.5 rounded text-slate-300 pointer-events-none">
              {formatTime(song.duration)}
            </span>
          ) : (
            <span />
          )}

          {/* Right: Three-Dot Context Menu Button */}
          <button
            onClick={handleMenuClick}
            aria-label={`More options for ${song.title}`}
            title="More options"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/75 hover:bg-black text-[#F5F5F7] hover:text-[#D5F36A] border border-white/10 hover:border-[#D5F36A]/40 backdrop-blur-md flex items-center justify-center transition-all opacity-85 sm:opacity-0 sm:group-hover:opacity-100 hover:scale-110 active:scale-95 shadow-md cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
          </button>
        </div>

        {/* Bottom Metadata & Integrated Play Button */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2 z-10">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-semibold text-white truncate drop-shadow group-hover:text-[#D5F36A] transition-colors" title={song.title}>
              {song.title}
            </p>
            <p className="text-[10px] sm:text-xs text-[#9999A6] font-medium truncate mt-0.5" title={song.artist}>
              {song.artist || 'Playback'}
            </p>
          </div>

          {/* Bottom-right Circular Play / Pause Button matching reference */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 shadow-md ${
            isCurrent && isPlaying
              ? 'bg-[#D5F36A] text-black shadow-[0_0_12px_rgba(213,243,106,0.5)]'
              : 'bg-black/80 hover:bg-[#D5F36A] text-white hover:text-black group-hover:scale-110'
          }`}>
            {isCurrent && isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 translate-x-0.5">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
