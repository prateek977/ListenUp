import React, { useState, useEffect, useRef, useCallback } from 'react';
import { searchArtists, formatFanCount, getArtistInitials } from '../../lib/artistClient';
import { STARTER_ARTISTS } from '../../lib/starterCatalog';

export default function Step2Artists({ selectedArtists = [], onToggleArtist, onAddCustomArtist }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextIndex, setNextIndex] = useState(null);
  const [customInput, setCustomInput] = useState('');
  const [brokenImages, setBrokenImages] = useState({});

  const abortControllerRef = useRef(null);

  // Debounce search query input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch artists whenever debouncedQuery changes
  const fetchArtists = useCallback(async (query, isLoadMore = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const offset = isLoadMore ? (nextIndex || 0) : 0;
      const data = await searchArtists({
        query,
        limit: 20,
        index: offset,
        signal: controller.signal
      });

      setArtists(prev => {
        if (!isLoadMore) return data.artists || [];
        // Deduplicate appending items
        const existingIds = new Set(prev.map(a => String(a.id)));
        const newOnes = (data.artists || []).filter(a => !existingIds.has(String(a.id)));
        return [...prev, ...newOnes];
      });

      setHasMore(Boolean(data.hasMore));
      setNextIndex(data.nextIndex ?? null);
      setError(null);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Deezer artist discovery error:', err);
        setError(err.message || 'Failed to search artists');
        // Fallback to starter catalog only if initial list is completely empty
        if (!isLoadMore && artists.length === 0) {
          const fallback = STARTER_ARTISTS.map(sa => ({
            id: sa.id,
            name: sa.name,
            image: sa.imageUrl,
            imageMedium: sa.imageUrl,
            imageLarge: sa.imageUrl,
            provider: 'starter',
            genre: sa.genre,
            fanCount: 0
          }));
          setArtists(fallback);
        }
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [nextIndex, artists.length]);

  // Initial load & search query response
  useEffect(() => {
    fetchArtists(debouncedQuery, false);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedQuery]);

  const handleRetry = () => {
    fetchArtists(debouncedQuery, false);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchArtists(debouncedQuery, true);
    }
  };

  const handleAddCustom = (e) => {
    e.preventDefault();
    const raw = (customInput || searchQuery).trim();
    if (!raw) return;
    const cleanId = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const customArtist = {
      id: cleanId,
      name: raw,
      image: '',
      imageMedium: '',
      imageLarge: '',
      provider: 'custom',
      genre: 'Custom Favorite',
      fanCount: 0
    };
    onAddCustomArtist?.(customArtist) || onToggleArtist?.(customArtist);
    setCustomInput('');
    setSearchQuery('');
  };

  const handleImageError = (artistId) => {
    setBrokenImages(prev => ({ ...prev, [artistId]: true }));
  };

  const isArtistSelected = (artist) => {
    return selectedArtists.some(a => {
      if (typeof a === 'string') {
        return a.toLowerCase() === artist.name.toLowerCase();
      }
      return String(a.id) === String(artist.id) || a.name.toLowerCase() === artist.name.toLowerCase();
    });
  };

  const count = selectedArtists.length;
  const isRequirementMet = count >= 3;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Info */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#D5F36A] bg-[#D5F36A]/10 px-3 py-1 rounded-full border border-[#D5F36A]/20">
          Step 2 • Favourite Artists
        </span>
        <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight">
          Which artists do you love listening to?
        </h2>
        <p className="text-sm text-[#9999A6]">
          Search your favourite musical icons. Powered dynamically by the Deezer artist catalog.
        </p>

        {/* Counter Badge */}
        <div className="inline-flex items-center gap-2 mt-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
          <span className={`w-2 h-2 rounded-full ${isRequirementMet ? 'bg-[#D5F36A] animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-xs font-mono font-medium text-slate-300">
            <strong className={isRequirementMet ? 'text-[#D5F36A] font-bold' : 'text-amber-400 font-bold'}>
              {count}
            </strong> of 3 minimum selected
          </span>
        </div>
      </div>

      {/* Persistent Selected Artists Pill Section */}
      {selectedArtists.length > 0 && (
        <div className="max-w-2xl mx-auto bg-[#14141E] border border-white/[0.08] rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase font-mono tracking-wider text-[#9999A6]">
              Selected Artists ({selectedArtists.length})
            </span>
            <span className="text-[10px] text-slate-500">Tap ✕ to remove</span>
          </div>

          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar pr-1">
            {selectedArtists.map((art) => {
              const artName = typeof art === 'string' ? art : art.name;
              const artId = typeof art === 'string' ? art : (art.id || art.name);
              const artImg = typeof art === 'object' ? (art.imageMedium || art.image) : null;

              return (
                <div
                  key={`selected-${artId}`}
                  className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-white/[0.06] border border-[#D5F36A]/30 text-white text-xs font-medium group hover:border-[#D5F36A] transition-all"
                >
                  <div className="w-5 h-5 rounded-full overflow-hidden bg-gradient-to-tr from-cyan-600 to-[#D5F36A] flex items-center justify-center text-[9px] font-bold text-black flex-shrink-0">
                    {artImg && !brokenImages[`sel-${artId}`] ? (
                      <img
                        src={artImg}
                        alt={artName}
                        className="w-full h-full object-cover"
                        onError={() => setBrokenImages(prev => ({ ...prev, [`sel-${artId}`]: true }))}
                      />
                    ) : (
                      getArtistInitials(artName)
                    )}
                  </div>
                  <span className="max-w-[120px] truncate">{artName}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleArtist(art);
                    }}
                    title={`Remove ${artName}`}
                    className="p-0.5 rounded-full hover:bg-white/20 text-[#9999A6] hover:text-white transition-colors cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search Bar with Debounce Indicator */}
      <div className="flex flex-col sm:flex-row gap-2.5 max-w-xl mx-auto">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search artists via Deezer (e.g. Arijit Singh, Taylor Swift, Diljit)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 pl-10 pr-10 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-[#D5F36A] focus:outline-none text-white text-sm placeholder:text-[#666674] transition-all"
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9999A6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9999A6] hover:text-white p-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {searchQuery && (
          <form onSubmit={handleAddCustom} className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-[#D5F36A] hover:bg-[#BDE84A] text-black font-extrabold text-xs whitespace-nowrap cursor-pointer transition-all shadow-md active:scale-95"
            >
              + Add "{searchQuery.slice(0, 16)}"
            </button>
          </form>
        )}
      </div>

      {/* Error / Retry Banner */}
      {error && (
        <div className="max-w-xl mx-auto p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={handleRetry}
            className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-white font-bold cursor-pointer transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Artists Cards Grid */}
      <div className="max-h-[50vh] overflow-y-auto custom-scrollbar p-1">
        {loading && artists.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {[...Array(10)].map((_, i) => (
              <div key={`skeleton-${i}`} className="rounded-2xl p-3 bg-white/[0.03] border border-white/[0.06] flex flex-col items-center animate-pulse space-y-3">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/[0.06]" />
                <div className="w-20 h-3 rounded bg-white/[0.06]" />
                <div className="w-14 h-2 rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        ) : artists.length === 0 ? (
          <div className="text-center py-12 px-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/[0.08] max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center text-[#9999A6] mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <p className="text-sm font-bold text-white mb-1">No artists found for "{searchQuery}"</p>
            <p className="text-xs text-[#9999A6] mb-4">You can add this artist manually or try searching a different name.</p>
            <button
              type="button"
              onClick={handleAddCustom}
              className="px-4 py-2 rounded-xl bg-[#D5F36A] hover:bg-[#BDE84A] text-black font-extrabold text-xs cursor-pointer shadow-md"
            >
              + Add as Custom Artist
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {artists.map((artist) => {
                const isSelected = isArtistSelected(artist);
                const hasPhoto = Boolean(artist.image && !brokenImages[artist.id]);

                return (
                  <div
                    key={`${artist.provider || 'art'}-${artist.id}`}
                    onClick={() => onToggleArtist(artist)}
                    className={`relative rounded-2xl p-3 border transition-all duration-200 cursor-pointer flex flex-col items-center text-center group ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#191922] to-[#101017] border-[#D5F36A] shadow-lg shadow-[#D5F36A]/15 scale-[1.02]'
                        : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] hover:border-white/[0.2]'
                    }`}
                  >
                    {/* Checkmark indicator */}
                    <div className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center border transition-all z-10 ${
                      isSelected 
                        ? 'bg-[#D5F36A] border-[#D5F36A] text-black shadow-sm' 
                        : 'border-white/20 bg-black/40'
                    }`}>
                      {isSelected && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    {/* Artist Portrait Photo or Fallback Avatar */}
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden mb-3 border border-white/[0.08] group-hover:border-[#D5F36A]/50 transition-colors shadow-md bg-[#191922] flex items-center justify-center">
                      {hasPhoto ? (
                        <img
                          src={artist.imageMedium || artist.image}
                          alt={artist.name}
                          loading="lazy"
                          onError={() => handleImageError(artist.id)}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-[#191922] to-slate-800 flex flex-col items-center justify-center text-slate-300">
                          <span className="font-heading font-black text-lg tracking-wider text-[#D5F36A]">
                            {getArtistInitials(artist.name)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Artist Name */}
                    <h4 className="font-heading font-bold text-white text-xs sm:text-sm truncate w-full" title={artist.name}>
                      {artist.name}
                    </h4>

                    {/* Extra Identifying Metadata (Fan count or Genre) */}
                    <p className="text-[10px] text-[#9999A6] truncate w-full mt-0.5">
                      {artist.fanCount > 0 
                        ? formatFanCount(artist.fanCount)
                        : (artist.genre || 'Deezer Artist')}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-5 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-bold text-white transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {loadingMore ? 'Loading more artists...' : 'Load More Artists'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Provider Attribution & Validation Notice */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-white/[0.06] text-center sm:text-left">
        <span className="text-[11px] text-[#666674] flex items-center gap-1.5 mx-auto sm:mx-0">
          <svg className="w-3.5 h-3.5 text-[#9999A6]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
          Artist discovery powered by <strong className="text-[#9999A6]">Deezer API</strong>
        </span>

        {!isRequirementMet && (
          <span className="text-xs text-amber-400 font-medium mx-auto sm:mx-0">
            Please select at least <strong>{3 - count} more artist{3 - count > 1 ? 's' : ''}</strong>
          </span>
        )}
      </div>
    </div>
  );
}
