import React, { useEffect, useRef, useState } from 'react';

/**
 * SongContextMenu
 * Polymorphic context menu for songs:
 * - Desktop: Floating positioned popover anchored to the 3-dot trigger button.
 * - Mobile (< 768px): Sleek bottom sheet with backdrop blur.
 * Actions:
 * - Play Now
 * - Play Next
 * - Add to Queue
 * - Add to Playlist
 * - Like / Unlike
 * - Copy Song Link
 */
export default function SongContextMenu({
  isOpen = false,
  song = null,
  anchorRect = null,
  onClose,
  onPlayNow,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  isFavorite = false,
  onToggleFavorite,
  onViewArtist,
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const menuRef = useRef(null);

  // Keyboard navigation & Escape-to-close
  useEffect(() => {
    if (!isOpen) {
      setCopiedLink(false);
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

  if (!isOpen || !song) return null;

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

  // Calculate clamped coordinates for desktop floating popover
  let floatingStyle = {};
  if (isDesktop && anchorRect) {
    const menuWidth = 230;
    const menuHeight = 270;
    const padding = 12;

    let left = anchorRect.left - menuWidth + anchorRect.width;
    if (left < padding) left = padding;
    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding;
    }

    let top = anchorRect.bottom + 6;
    if (top + menuHeight > window.innerHeight - padding) {
      // Flip above trigger button
      top = Math.max(padding, anchorRect.top - menuHeight - 6);
    }

    floatingStyle = {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${menuWidth}px`,
      zIndex: 105,
    };
  }

  const handleCopyLink = () => {
    const url = `https://listen-up-lilac.vercel.app/search?q=${encodeURIComponent(song.title)}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedLink(true);
    setTimeout(() => {
      setCopiedLink(false);
      onClose?.();
    }, 600);
  };

  const handleAction = (actionFn) => {
    actionFn?.(song);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center select-none pointer-events-auto animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 md:bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu Container: Floating on Desktop, Bottom Sheet on Mobile */}
      <div
        ref={menuRef}
        role="menu"
        aria-orientation="vertical"
        style={isDesktop && anchorRect ? floatingStyle : {}}
        className={`relative bg-[#14141E] border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.95)] overflow-hidden text-[#F5F5F7] ${
          isDesktop && anchorRect
            ? 'rounded-2xl p-1.5 animate-scaleUp'
            : 'w-full rounded-t-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-slideUp'
        }`}
      >
        {/* Mobile Drag Indicator */}
        {!isDesktop && (
          <div className="w-full flex justify-center pt-3 pb-1" onClick={onClose}>
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
        )}

        {/* Song Mini Preview Header */}
        <div className="p-3 border-b border-white/[0.06] flex items-center gap-3 bg-white/[0.02]">
          <img 
            src={song.thumbnailUrl || '/default-artwork.svg'} 
            alt={song.title} 
            onError={(e) => { e.currentTarget.src = '/default-artwork.svg'; }}
            className="w-10 h-10 rounded-xl object-cover border border-white/[0.08] flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-[#F5F5F7] truncate">{song.title}</h4>
            <p className="text-[11px] text-[#9999A6] truncate">{song.artist || 'Unknown Artist'}</p>
          </div>
        </div>

        {/* Action Items */}
        <div className="py-1 flex flex-col divide-y divide-white/[0.04]">
          {/* 1. Play Now */}
          <button
            onClick={() => handleAction(onPlayNow)}
            className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-white/[0.06] text-[#F5F5F7] hover:text-[#D5F36A] transition-colors flex items-center gap-3 text-xs sm:text-sm font-medium cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[#D5F36A] flex-shrink-0">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>Play Now</span>
          </button>

          {/* 2. Play Next */}
          <button
            onClick={() => handleAction(onPlayNext)}
            className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-white/[0.06] text-[#F5F5F7] hover:text-[#D5F36A] transition-colors flex items-center gap-3 text-xs sm:text-sm font-medium cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-[#9999A6] flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21L21 17.25" />
            </svg>
            <span>Play Next</span>
          </button>

          {/* 3. Add to Queue */}
          <button
            onClick={() => handleAction(onAddToQueue)}
            className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-white/[0.06] text-[#F5F5F7] hover:text-[#D5F36A] transition-colors flex items-center gap-3 text-xs sm:text-sm font-medium cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-[#9999A6] flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
            <span>Add to Queue</span>
          </button>

          {/* 4. Add to Playlist */}
          <button
            onClick={() => handleAction(onAddToPlaylist)}
            className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-white/[0.06] text-[#F5F5F7] hover:text-[#D5F36A] transition-colors flex items-center gap-3 text-xs sm:text-sm font-medium cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-[#9999A6] flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>Add to Playlist</span>
          </button>

          {/* 5. Like / Unlike */}
          <button
            onClick={() => handleAction(onToggleFavorite)}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors flex items-center gap-3 text-xs sm:text-sm font-medium cursor-pointer ${
              isFavorite ? 'text-rose-500' : 'text-[#F5F5F7]'
            }`}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill={isFavorite ? 'currentColor' : 'none'} 
              strokeWidth="2" 
              stroke="currentColor" 
              className="w-4 h-4 flex-shrink-0"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            <span>{isFavorite ? 'Remove from Liked' : 'Like Song'}</span>
          </button>

          {/* 6. Copy Link */}
          <button
            onClick={handleCopyLink}
            className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-white/[0.06] text-[#F5F5F7] hover:text-[#D5F36A] transition-colors flex items-center gap-3 text-xs sm:text-sm font-medium cursor-pointer"
          >
            {copiedLink ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#D5F36A] flex-shrink-0">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
                <span className="text-[#D5F36A] font-bold">Link Copied!</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-[#9999A6] flex-shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-3.09a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364l1.757 1.757" />
                </svg>
                <span>Share Song Link</span>
              </>
            )}
          </button>
        </div>

        {/* Mobile Dismiss Button */}
        {!isDesktop && (
          <button
            onClick={onClose}
            className="w-full mt-2 py-3 text-center text-xs font-semibold text-[#9999A6] hover:text-[#F5F5F7] border-t border-white/[0.06] cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

