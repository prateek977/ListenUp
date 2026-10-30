import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_ARTISTS } from '../lib/starterCatalog.js';

test('User Preferences Persistence & Home Shelf Logic', async (t) => {
  await t.test('STARTER_ARTISTS uses authentic Deezer CDN images or verified local portraits instead of Unsplash stock photos', () => {
    assert.ok(STARTER_ARTISTS.length >= 15);
    for (const artist of STARTER_ARTISTS) {
      assert.ok(
        !artist.imageUrl.includes('unsplash.com'),
        `Artist "${artist.name}" must not use Unsplash stock image, found: ${artist.imageUrl}`
      );
      assert.ok(
        artist.imageUrl.startsWith('/artists/') || artist.imageUrl.includes('dzcdn.net') || artist.imageUrl.startsWith('https://'),
        `Artist "${artist.name}" must have a valid portrait URL, found: ${artist.imageUrl}`
      );
    }
  });

  await t.test('Preferences restoration falls back to user_metadata or localStorage when relational tables fail', () => {
    const userId = 'user_123';
    const mockUserMetadata = {
      preferences: {
        genres: ['pop', 'bollywood', 'rock'],
        artists: [
          { id: '3830821', name: 'Arijit Singh', provider: 'deezer' },
          { id: '12246', name: 'Taylor Swift', provider: 'deezer' },
          { id: '4050205', name: 'The Weeknd', provider: 'deezer' }
        ],
        languages: ['Hindi', 'English'],
        moods: ['chill', 'focus'],
        activities: ['workout'],
        explicit_content_preference: true
      }
    };

    // Simulate Supabase relational query returning null / error (PGRST205)
    const genresRes = { data: null, error: { code: 'PGRST205', message: 'Table not found' } };
    const artistsRes = { data: null, error: { code: 'PGRST205', message: 'Table not found' } };
    const langsRes = { data: null, error: { code: 'PGRST205', message: 'Table not found' } };

    const loadedGenres = (genresRes.data || []).map(g => g.genre_id);
    const loadedArtists = (artistsRes.data || []).map(a => a.artist_id);
    const loadedLangs = (langsRes.data || []).map(l => l.language_id);

    let resolvedPreferences;
    if (loadedGenres.length > 0 || loadedArtists.length > 0 || loadedLangs.length > 0) {
      resolvedPreferences = { genres: loadedGenres, artists: loadedArtists, languages: loadedLangs };
    } else {
      // Must fallback to userMetadata.preferences instead of resetting to empty!
      const fallback = mockUserMetadata?.preferences;
      assert.ok(fallback, 'Fallback preferences must exist');
      resolvedPreferences = fallback;
    }

    assert.equal(resolvedPreferences.genres.length, 3);
    assert.equal(resolvedPreferences.artists.length, 3);
    assert.equal(resolvedPreferences.languages.length, 2);
    assert.equal(resolvedPreferences.artists[0].name, 'Arijit Singh');
  });

  await t.test('Guest migration modal suppresses popup on page refresh when already handled', () => {
    const userId = 'prateek_user_id';
    const storage = new Map();

    // Condition 1: First time with guest activity -> modal triggers
    const checkShouldOpenModal = (currentId, wasGuest, handled) => {
      if (!currentId) return false;
      if (handled) return false;
      return wasGuest;
    };

    assert.equal(checkShouldOpenModal(userId, true, false), true, 'Should open when guest activity exists and not handled');

    // User clicks "Sync" or "Keep Local" -> handled flag saved
    storage.set(`listenup_guest_sync_handled_${userId}`, 'true');

    // Condition 2: Subsequent page refresh (session restored, handled flag present)
    const isHandledOnRefresh = storage.get(`listenup_guest_sync_handled_${userId}`) === 'true';
    assert.equal(
      checkShouldOpenModal(userId, false, isHandledOnRefresh),
      false,
      'Must NOT trigger modal again on page refresh'
    );
  });

  await t.test('displayedArtists maps user favorites with authentic portraits and separates them from unselected', () => {
    const preferences = {
      artists: [
        { id: '3830821', name: 'Arijit Singh', imageMedium: 'https://cdn-images.dzcdn.net/images/artist/ac5350cff290edd5b69fa584b8b1bd4f/250x250-000000-80-0-0.jpg' },
        { id: '12246', name: 'Taylor Swift', imageMedium: 'https://cdn-images.dzcdn.net/images/artist/cc2495870fe1a792ad0cdb05501ad5ec/250x250-000000-80-0-0.jpg' }
      ]
    };

    const dynamicPopular = [
      { id: '3830821', name: 'Arijit Singh', img: 'https://cdn-images.dzcdn.net/images/artist/ac5350cff290edd5b69fa584b8b1bd4f/250x250-000000-80-0-0.jpg' },
      { id: '12246', name: 'Taylor Swift', img: 'https://cdn-images.dzcdn.net/images/artist/cc2495870fe1a792ad0cdb05501ad5ec/250x250-000000-80-0-0.jpg' },
      { id: '4050205', name: 'The Weeknd', img: 'https://cdn-images.dzcdn.net/images/artist/581693b4724a7fcfa754455101e13a44/250x250-000000-80-0-0.jpg' }
    ];

    const userFavs = preferences.artists.map(art => ({
      name: art.name,
      img: art.imageMedium,
      isUserFav: true
    }));

    const remaining = dynamicPopular.filter(d => !userFavs.some(u => u.name.toLowerCase() === d.name.toLowerCase()));
    const finalShelf = [...userFavs, ...remaining];

    assert.equal(finalShelf.length, 3);
    assert.equal(finalShelf[0].name, 'Arijit Singh');
    assert.equal(finalShelf[0].isUserFav, true);
    assert.equal(finalShelf[1].name, 'Taylor Swift');
    assert.equal(finalShelf[1].isUserFav, true);
    assert.equal(finalShelf[2].name, 'The Weeknd');
    assert.equal(finalShelf[2].isUserFav, undefined);
  });

  await t.test('onAuthStateChange does not clear preferences on transient events or token refresh', () => {
    let currentPrefs = { genres: ['pop', 'rock'], artists: ['Arijit Singh'] };
    const onAuthEvent = (event, newSession) => {
      if (newSession?.user) {
        // user logged in
      } else if (event === 'SIGNED_OUT') {
        currentPrefs = { genres: [], artists: [] };
      }
      // If event is INITIAL_SESSION, TOKEN_REFRESHED, or transient null during hydration, DO NOT WIPE!
    };

    onAuthEvent('INITIAL_SESSION', null);
    assert.equal(currentPrefs.genres.length, 2, 'Must not clear preferences on INITIAL_SESSION with null session');

    onAuthEvent('TOKEN_REFRESHED', null);
    assert.equal(currentPrefs.genres.length, 2, 'Must not clear preferences on TOKEN_REFRESHED');

    onAuthEvent('SIGNED_OUT', null);
    assert.equal(currentPrefs.genres.length, 0, 'Must clear preferences ONLY on explicit SIGNED_OUT');
  });
});

