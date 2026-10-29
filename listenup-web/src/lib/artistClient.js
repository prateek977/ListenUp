/**
 * Deezer Artist Discovery Client
 * Interacts with backend /api/artists/search proxy to dynamically search and paginate Deezer artists.
 */

export async function searchArtists({ query = '', limit = 20, index = 0, signal = null }) {
  const params = new URLSearchParams({
    q: (query || '').trim(),
    limit: String(limit),
    index: String(index)
  });

  const res = await fetch(`/api/artists/search?${params.toString()}`, {
    signal,
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    let errMsg = `Request failed with status ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.error) errMsg = errJson.error;
    } catch {
      // ignore json parse errors
    }
    throw new Error(errMsg);
  }

  return await res.json();
}

/**
 * Format fan count for display disambiguation (e.g. 233619 -> "234K fans")
 */
export function formatFanCount(count) {
  if (!count || isNaN(count) || count <= 0) return '';
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M fans`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K fans`;
  }
  return `${count} fans`;
}

/**
 * Extract artist initials for fallback avatar when photo is missing or broken (e.g. "Arijit Singh" -> "AS")
 */
export function getArtistInitials(name = '') {
  if (!name || typeof name !== 'string') return '♪';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '♪';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
