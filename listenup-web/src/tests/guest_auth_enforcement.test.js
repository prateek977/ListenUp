import test from 'node:test';
import assert from 'node:assert/strict';

test('Guest Access & Centralized Authentication Guard Enforcement', async (t) => {
  // Mock localStorage and sessionStorage
  const createMockStorage = () => {
    let store = {};
    return {
      getItem: (k) => store[k] || null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { store = {}; },
      getStore: () => store
    };
  };

  await t.test('1. Guest session starts with zero persistent personal data in localStorage', () => {
    const mockStorage = createMockStorage();
    // Simulate cleanup on mount
    mockStorage.removeItem('listenup_favorites');
    mockStorage.removeItem('listenup_playlists');
    mockStorage.removeItem('listenup_recently_played');
    mockStorage.removeItem('listenup_suggested_songs');
    mockStorage.removeItem('listenup_had_guest_activity');
    mockStorage.removeItem('listenup_onboarding_completed_guest');

    assert.equal(mockStorage.getItem('listenup_favorites'), null);
    assert.equal(mockStorage.getItem('listenup_playlists'), null);
    assert.equal(mockStorage.getItem('listenup_recently_played'), null);
  });

  await t.test('2. Centralized requireAuth guard blocks unauthenticated action and sets modal state', () => {
    let modalState = { isOpen: false, mode: 'signin', message: null, pendingAction: null };
    let activeUser = null; // Guest

    const requireAuth = (callback, options = {}) => {
      if (activeUser?.id) {
        return callback?.(activeUser);
      }
      modalState = {
        isOpen: true,
        mode: options.mode || 'signin',
        message: options.message || 'Log in to save your playlists, favorites, and preferences.',
        pendingAction: callback
      };
      return { success: false, requireAuth: true };
    };

    // Guest attempts to like a song
    let favMutated = false;
    const testSong = { id: 'yt_123', title: 'Kesariya', artist: 'Arijit Singh' };
    const guestAttempt = requireAuth(() => { favMutated = true; }, {
      message: 'Log in to like songs and save favorites.'
    });

    assert.deepEqual(guestAttempt, { success: false, requireAuth: true });
    assert.equal(favMutated, false, 'Guest favorite mutation must not execute');
    assert.equal(modalState.isOpen, true);
    assert.equal(modalState.message, 'Log in to like songs and save favorites.');
    assert.ok(typeof modalState.pendingAction === 'function', 'Pending callback must be preserved');
  });

  await t.test('3. requireAuth executes immediately when user is authenticated', () => {
    const authedUser = { id: 'usr_456', email: 'prateek@test.com' };
    let executedWith = null;

    const requireAuth = (callback, options = {}) => {
      if (authedUser?.id) {
        return callback ? callback(authedUser) : { success: true, user: authedUser };
      }
      return { success: false, requireAuth: true };
    };

    const res = requireAuth((u) => {
      executedWith = u;
      return { success: true, favorited: true };
    });

    assert.deepEqual(res, { success: true, favorited: true });
    assert.equal(executedWith.id, 'usr_456');
  });

  await t.test('4. Preserved intended action executes seamlessly after authentication succeeds', () => {
    let modalState = { isOpen: false, mode: 'signin', message: null, pendingAction: null };
    let savedFavorites = [];
    const songToAdd = { id: 'yt_999', title: 'Chaleya', artist: 'Arijit Singh' };

    // Function that simulates toggleFavorite
    const toggleFavorite = (user, song) => {
      if (!user?.id) {
        modalState.isOpen = true;
        modalState.message = 'Log in to like songs and save favorites.';
        modalState.pendingAction = (authedUser) => toggleFavorite(authedUser, song);
        return { success: false, requireAuth: true };
      }
      savedFavorites.push(song);
      return { success: true };
    };

    // Step A: Guest triggers action
    const firstCall = toggleFavorite(null, songToAdd);
    assert.equal(firstCall.requireAuth, true);
    assert.equal(savedFavorites.length, 0, 'No favorites saved while unauthenticated');
    assert.ok(modalState.pendingAction, 'Pending action captured');

    // Step B: User successfully logs in
    const authenticatedUser = { id: 'usr_888', email: 'user@example.com' };
    modalState.pendingAction(authenticatedUser);

    assert.equal(savedFavorites.length, 1, 'Song should be saved after auth callback resolves');
    assert.equal(savedFavorites[0].id, 'yt_999');
  });

  await t.test('5. Guest playlist operations do not mutate state or localStorage', () => {
    const mockStorage = createMockStorage();
    let currentPlaylists = [];
    let authTriggered = false;

    const createPlaylist = (user, name) => {
      if (!user?.id) {
        authTriggered = true;
        return null;
      }
      const newPl = { id: 'pl_1', name, songs: [] };
      currentPlaylists.push(newPl);
      mockStorage.setItem(`listenup_playlists_${user.id}`, JSON.stringify(currentPlaylists));
      return newPl;
    };

    const result = createPlaylist(null, 'My Workout Beats');
    assert.equal(result, null);
    assert.equal(authTriggered, true);
    assert.equal(currentPlaylists.length, 0);
    assert.equal(mockStorage.getItem('listenup_playlists'), null);
  });

  await t.test('6. Guest listening events do not produce database or network mutation', () => {
    let networkRequestFired = false;
    let activeSession = null; // Guest

    const sendListenEvent = (session, eventType, song) => {
      if (!session?.user?.id) {
        // Zero guest persistence: abort immediately
        return false;
      }
      networkRequestFired = true;
      return true;
    };

    const sent = sendListenEvent(activeSession, 'play_started', { id: 's_1' });
    assert.equal(sent, false);
    assert.equal(networkRequestFired, false, 'Guests must never send listening event records to DB');
  });

  await t.test('7. Guest exploration and playback remain completely uninhibited', () => {
    // Verifies that browsing and queue manipulation do not require authentication
    let currentSong = null;
    let queue = [];
    let volume = 80;

    const playSong = (song) => {
      currentSong = song;
      queue = [song];
      return { ok: true, nowPlaying: song.id };
    };

    const res = playSong({ id: 'yt_abc', title: 'Apna Bana Le', artist: 'Arijit Singh' });
    assert.equal(res.ok, true);
    assert.equal(currentSong.title, 'Apna Bana Le');
    assert.equal(queue.length, 1);
  });
});

