import React from 'react';

/**
 * TrackMetadata
 * Large elegant track title, artist metadata, with:
 * - Like / Unlike toggle
 * - Add to Playlist button
 * - More Options (three-dot) button
 */
export default function TrackMetadata({
  song,
  isFavorite = false,
  onToggleFavorite,
  onAddToPlaylist,
  onOpenMoreOptions,
  className = ''
}) {
  const title = song?.title || 'No Track Selected';
  const artist = song?.artist || 'Ready to Stream';

  return (
    <div className={`w-full flex items-center justify-between gap-3 px-1 ${className}`}>
      {/* Title & Artist */}
      <div className="min-w-0 flex-1">
        <h2 
          className="text-xl sm:text-2xl font-bold text-[#F5F5F7] tracking-tight truncate"
          title={title}
        >
          {title}
        </h2>
        <p 
          className="text-sm sm:text-base font-medium text-[#9999A6] truncate mt-1 flex items-center gap-2"
          title={artist}
        >
          <span>{artist}</span>
          {song?.duration && (
            <>
              <span className="w-1 h-1 rounded-full bg-[#666674] inline-block" />
              <span className="text-xs text-[#666674] font-mono">
                {typeof song.duration === 'number' 
                  ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}` 
                  : song.duration}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Action Buttons: Add to Playlist, Favorite, More Options */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
        {/* Add to Playlist Button */}
        {onAddToPlaylist && (
          <button
            onClick={() => song && onAddToPlaylist(song)}
            disabled={!song}
            title="Add to Playlist"
            aria-label="Add to Playlist"
            className="min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded-full text-[#9999A6] hover:text-[#D5F36A] hover:bg-white/[0.08] active:scale-90 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        )}

        {/* Favorite Button */}
        <button
          onClick={() => song && onToggleFavorite?.(song)}
          disabled={!song}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          className={`min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded-full hover:bg-white/[0.08] active:scale-90 transition-all cursor-pointer ${
            isFavorite ? 'text-rose-500 scale-105' : 'text-[#9999A6] hover:text-[#F5F5F7]'
          } disabled:opacity-30 disabled:pointer-events-none`}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill={isFavorite ? 'currentColor' : 'none'} 
            strokeWidth="2" 
            stroke="currentColor" 
            className="w-5 h-5 sm:w-6 sm:h-6 transition-colors drop-shadow"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" 
            />
          </svg>
        </button>

        {/* More Options (Three-dot) Button */}
        {onOpenMoreOptions && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (song) {
                const rect = e.currentTarget.getBoundingClientRect();
                onOpenMoreOptions(song, rect);
              }
            }}
            disabled={!song}
            title="More Options"
            aria-label="More Options"
            className="min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded-full text-[#9999A6] hover:text-[#F5F5F7] hover:bg-white/[0.08] active:scale-90 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
