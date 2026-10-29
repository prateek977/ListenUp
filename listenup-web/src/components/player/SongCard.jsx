import React from 'react';

/**
 * SongCard
 * Reusable song card for homepage shelves, discovery sections, and grids:
 * - Square artwork with smooth zoom on hover
 * - Center play button with active pulse
 * - Three-dot hover context menu button (subtle on desktop, always accessible on touch)
 * - Duration badge / active playing equalizer
 * - Robust error image fallback
 */
export default function SongCard({
  song,
  isCurrent = false,
  isPlaying = false,
  onClick,
  onOpenMenu,
  formatTime = (s) => `${s}s`,
  className = ''
}) {
  if (!song) return null;

  const handleMenuClick = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    onOpenMenu?.(song, rect);
  };

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`w-36 sm:w-44 flex-shrink-0 group cursor-pointer select-none focus:outline-none ${className}`}
    >
      <div 
        className={`relative aspect-square w-full rounded-2xl overflow-hidden bg-[#101017] border shadow-lg transition-all duration-300 ${
          isCurrent 
            ? 'border-[#D5F36A] shadow-[0_0_20px_rgba(213,243,106,0.35)] ring-1 ring-[#D5F36A]' 
            : 'border-white/[0.08] group-hover:border-[#D5F36A]/50 group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.8)]'
        }`}
      >
        {/* Cover Artwork */}
        <img
          src={song.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80'}
          alt={song.title}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80';
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Ambient Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent pointer-events-none" />

        {/* Top Badges: Three-Dot Menu (Right) & Duration/Equalizer (Left) */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-auto z-10">
          {/* Left: Duration or Playing Equalizer Animation */}
          {isCurrent && isPlaying ? (
            <div className="bg-black/85 backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1 border border-[#D5F36A]/40 shadow-sm pointer-events-none">
              <span className="eq-bar !h-3" />
              <span className="eq-bar !h-4" />
              <span className="eq-bar !h-2" />
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

        {/* Center Hover Play Button */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-[#D5F36A] text-black flex items-center justify-center shadow-[0_0_20px_rgba(213,243,106,0.4)] transform scale-75 group-hover:scale-100 transition-transform">
            {isCurrent && isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 translate-x-0.5">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
        </div>

        {/* Bottom Card Title and Artist */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 pointer-events-none">
          <p className="text-xs font-bold text-white truncate drop-shadow group-hover:text-[#D5F36A] transition-colors" title={song.title}>
            {song.title}
          </p>
          <p className="text-[10px] text-[#9999A6] font-medium truncate mt-0.5" title={song.artist}>
            {song.artist || 'Playback'}
          </p>
        </div>
      </div>
    </div>
  );
}

