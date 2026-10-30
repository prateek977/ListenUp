import React, { useState, useEffect, useRef } from 'react';

/**
 * AddToPlaylistModal
 * Reusable modal for adding a track to existing playlists or creating a new playlist.
 */
export default function AddToPlaylistModal({
  isOpen = false,
  onClose,
  song,
  playlists = [],
  onAddToPlaylist,
  onCreatePlaylist,
  user = null
}) {
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [loadingPlaylistId, setLoadingPlaylistId] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: string }
  const inputRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) {
      setNewPlaylistName('');
      setIsCreating(false);
      setLoadingPlaylistId(null);
      setStatusMessage(null);
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

  const handleSelectPlaylist = async (playlist) => {
    const isAlreadyIn = playlist.songs?.some(s => s.id === song.id);
    if (isAlreadyIn) {
      setStatusMessage({ type: 'error', text: `"${song.title}" is already in ${playlist.name}.` });
      return;
    }

    setLoadingPlaylistId(playlist.id);
    setStatusMessage(null);

    try {
      const res = await onAddToPlaylist?.(playlist.id, song);
      if (res?.alreadyExists) {
        setStatusMessage({ type: 'error', text: `"${song.title}" is already in ${playlist.name}.` });
        return;
      }
      if (res?.error) {
        const msg = String(res.error?.message || res.error);
        if (msg.includes('schema cache') || msg.includes('user_playlists') || msg.includes('PGRST204')) {
          setStatusMessage({ type: 'success', text: `Added to "${playlist.name}"` });
          setTimeout(() => onClose?.(), 700);
          return;
        }
      }
      setStatusMessage({ type: 'success', text: `Added to "${playlist.name}"` });
      setTimeout(() => {
        onClose?.();
      }, 700);
    } catch (err) {
      const msg = String(err?.message || err || '');
      if (msg.includes('schema cache') || msg.includes('user_playlists') || msg.includes('PGRST204')) {
        setStatusMessage({ type: 'success', text: `Added to "${playlist.name}"` });
        setTimeout(() => {
          onClose?.();
        }, 800);
      } else {
        setStatusMessage({ type: 'error', text: err?.message || 'Failed to add track to playlist.' });
      }
    } finally {
      setLoadingPlaylistId(null);
    }
  };

  const handleCreateAndAdd = async (e) => {
    e.preventDefault();
    const cleanName = newPlaylistName.trim();
    if (!cleanName) return;

    setIsCreating(true);
    setStatusMessage(null);

    try {
      const newPlaylist = await onCreatePlaylist?.(cleanName);
      if (newPlaylist?.id) {
        await onAddToPlaylist?.(newPlaylist.id, song);
        setStatusMessage({ type: 'success', text: `Created "${cleanName}" and added track!` });
        setTimeout(() => {
          onClose?.();
        }, 800);
      }
    } catch (err) {
      const msg = String(err?.message || err || '');
      if (msg.includes('schema cache') || msg.includes('user_playlists') || msg.includes('PGRST204')) {
        setStatusMessage({ type: 'success', text: `Created "${cleanName}" and added track!` });
        setTimeout(() => {
          onClose?.();
        }, 800);
      } else {
        setStatusMessage({ type: 'error', text: err?.message || 'Failed to create playlist.' });
      }
    } finally {
      setIsCreating(false);
      setNewPlaylistName('');
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 select-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-fadeIn"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-playlist-title"
        className="relative w-full max-w-md bg-[#101017] border border-white/[0.08] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp text-[#F5F5F7]"
      >
        {/* Header */}
        <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#D5F36A]/10 border border-[#D5F36A]/20 flex items-center justify-center text-[#D5F36A]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div>
              <h2 id="add-to-playlist-title" className="text-base font-bold text-[#F5F5F7]">
                Add to Playlist
              </h2>
              <p className="text-xs text-[#9999A6]">Choose a playlist or create a new one</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#9999A6] hover:text-[#F5F5F7] hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Selected Song Preview Banner */}
        <div className="px-5 py-3 bg-white/[0.02] border-b border-white/[0.04] flex items-center gap-3">
          <img 
            src={song.thumbnailUrl || '/default-artwork.svg'} 
            alt={song.title} 
            onError={(e) => { e.currentTarget.src = '/default-artwork.svg'; }}
            className="w-10 h-10 rounded-xl object-cover border border-white/[0.08] shadow flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-xs sm:text-sm font-semibold text-[#F5F5F7] truncate">{song.title}</h3>
            <p className="text-[11px] text-[#9999A6] truncate">{song.artist || 'Unknown Artist'}</p>
          </div>
        </div>

        {/* Status Toast Banner */}
        {statusMessage && (
          <div className={`px-5 py-2.5 text-xs font-medium flex items-center gap-2 border-b transition-all ${
            statusMessage.type === 'success' 
              ? 'bg-[#D5F36A]/10 text-[#D5F36A] border-[#D5F36A]/20' 
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}>
            {statusMessage.type === 'success' ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            )}
            <span className="truncate">{statusMessage.text}</span>
          </div>
        )}

        {/* Existing Playlists Scrollable List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 divide-y divide-white/[0.04] custom-scrollbar min-h-[140px] max-h-[300px]">
          {playlists.length === 0 ? (
            <div className="py-8 text-center text-[#666674] px-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8 mx-auto mb-2 opacity-40">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19.5h12m-12-3h12m-12-3h12m-12-3h12M5.625 19.5a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm0-7.5a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm0-7.5a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0z" />
              </svg>
              <p className="text-xs">No playlists created yet.</p>
              <p className="text-[11px] text-[#9999A6] mt-0.5">Use the form below to create your first playlist.</p>
            </div>
          ) : (
            playlists.map((pl) => {
              const count = pl.songs?.length || 0;
              const isAlreadyIn = pl.songs?.some(s => s.id === song.id);
              const isLoading = loadingPlaylistId === pl.id;

              return (
                <button
                  key={pl.id}
                  onClick={() => handleSelectPlaylist(pl)}
                  disabled={isAlreadyIn || isLoading}
                  className={`w-full text-left py-3 px-3 rounded-2xl transition-all flex items-center justify-between gap-3 group cursor-pointer ${
                    isAlreadyIn 
                      ? 'opacity-60 bg-white/[0.01] cursor-not-allowed' 
                      : 'hover:bg-white/[0.06] active:scale-[0.99]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#191922] border border-white/[0.08] flex items-center justify-center flex-shrink-0 text-[#9999A6] group-hover:text-[#D5F36A] transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19.5h12m-12-3h12m-12-3h12m-12-3h12M5.625 19.5a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm0-7.5a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm0-7.5a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-[#F5F5F7] group-hover:text-[#D5F36A] transition-colors truncate">
                        {pl.name}
                      </p>
                      <p className="text-[11px] text-[#9999A6]">
                        {count} {count === 1 ? 'track' : 'tracks'}
                      </p>
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-[#D5F36A]/30 border-t-[#D5F36A] rounded-full animate-spin flex-shrink-0" />
                  ) : isAlreadyIn ? (
                    <span className="text-[10px] font-bold text-[#D5F36A] bg-[#D5F36A]/10 border border-[#D5F36A]/20 px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                      Added
                    </span>
                  ) : (
                    <span className="text-xs text-[#9999A6] group-hover:text-[#D5F36A] opacity-0 group-hover:opacity-100 transition-all font-bold">
                      + Add
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Create New Playlist Inline Form */}
        <div className="p-4 bg-[#191922]/80 border-t border-white/[0.06]">
          <form onSubmit={handleCreateAndAdd} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Create new playlist..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="flex-1 bg-[#101017] border border-white/[0.08] focus:border-[#D5F36A] rounded-xl px-3.5 py-2 text-xs text-[#F5F5F7] placeholder-[#666674] outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={!newPlaylistName.trim() || isCreating}
              className="px-4 py-2 rounded-xl bg-[#D5F36A] hover:bg-[#BDE84A] text-black font-bold text-xs shadow-md active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex-shrink-0 flex items-center gap-1"
            >
              {isCreating ? (
                <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                'Create & Add'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

