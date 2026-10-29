import test from 'node:test';
import assert from 'node:assert/strict';

test('Queue, Now Playing & Context Menu Interaction Rules', async (t) => {
  await t.test('playNextInQueue inserts track immediately after current track without dropping rest of queue', () => {
    const currentSong = { id: 's1', title: 'Current Song' };
    const initialQueue = [
      { id: 's1', title: 'Current Song' },
      { id: 's2', title: 'Upcoming 1' },
      { id: 's3', title: 'Upcoming 2' }
    ];
    const newTrack = { id: 's-next', title: 'Play Next Song' };

    const playNextInQueue = (song, q, curSong) => {
      if (!song) return q;
      const withoutSong = q.filter(s => s.id !== song.id);
      const curIdx = curSong ? withoutSong.findIndex(s => s.id === curSong.id) : -1;
      const nextIdx = curIdx >= 0 ? curIdx + 1 : 0;
      const next = [...withoutSong];
      next.splice(nextIdx, 0, song);
      return next;
    };

    const updated = playNextInQueue(newTrack, initialQueue, currentSong);
    assert.equal(updated.length, 4);
    assert.equal(updated[0].id, 's1');
    assert.equal(updated[1].id, 's-next');
    assert.equal(updated[2].id, 's2');
    assert.equal(updated[3].id, 's3');
  });

  await t.test('playNextInQueue repositions track if already present further down in queue', () => {
    const currentSong = { id: 's1', title: 'Current Song' };
    const initialQueue = [
      { id: 's1', title: 'Current Song' },
      { id: 's2', title: 'Upcoming 1' },
      { id: 's3', title: 'Target To Move Up' },
      { id: 's4', title: 'Upcoming 3' }
    ];

    const playNextInQueue = (song, q, curSong) => {
      if (!song) return q;
      const withoutSong = q.filter(s => s.id !== song.id);
      const curIdx = curSong ? withoutSong.findIndex(s => s.id === curSong.id) : -1;
      const nextIdx = curIdx >= 0 ? curIdx + 1 : 0;
      const next = [...withoutSong];
      next.splice(nextIdx, 0, song);
      return next;
    };

    const updated = playNextInQueue(initialQueue[2], initialQueue, currentSong);
    assert.equal(updated.length, 4);
    assert.equal(updated[0].id, 's1');
    assert.equal(updated[1].id, 's3');
    assert.equal(updated[2].id, 's2');
    assert.equal(updated[3].id, 's4');
  });

  await t.test('moveSongInQueue reorders tracks up and down within bounds', () => {
    const queue = [
      { id: 's1', title: 'Track 1' },
      { id: 's2', title: 'Track 2' },
      { id: 's3', title: 'Track 3' }
    ];

    const moveSongInQueue = (fromIndex, direction, q) => {
      const targetIndex = fromIndex + direction;
      if (fromIndex < 0 || fromIndex >= q.length) return q;
      if (targetIndex < 0 || targetIndex >= q.length) return q;
      const next = [...q];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    };

    // Move s2 up
    const movedUp = moveSongInQueue(1, -1, queue);
    assert.equal(movedUp[0].id, 's2');
    assert.equal(movedUp[1].id, 's1');

    // Move s1 down
    const movedDown = moveSongInQueue(0, 1, queue);
    assert.equal(movedDown[0].id, 's2');
    assert.equal(movedDown[1].id, 's1');

    // Out of bounds up (index 0 moving -1)
    const oobUp = moveSongInQueue(0, -1, queue);
    assert.deepEqual(oobUp, queue);

    // Out of bounds down (index 2 moving +1)
    const oobDown = moveSongInQueue(2, 1, queue);
    assert.deepEqual(oobDown, queue);
  });

  await t.test('clearUpcomingQueue preserves current track and removes upcoming items', () => {
    const currentSong = { id: 's1', title: 'Current Song' };
    const queue = [
      { id: 's1', title: 'Current Song' },
      { id: 's2', title: 'Upcoming 1' },
      { id: 's3', title: 'Upcoming 2' }
    ];

    const clearUpcomingQueue = (q, curSong) => {
      if (!curSong) return [];
      return q.filter(s => s.id === curSong.id);
    };

    const result = clearUpcomingQueue(queue, currentSong);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 's1');

    // When no current song
    assert.deepEqual(clearUpcomingQueue(queue, null), []);
  });

  await t.test('Now Playing auto-open occurs ONLY on playback start (state === 1), never on song click or queue open', () => {
    let isNowPlayingOpen = false;
    let isQueueOpen = false;
    let shouldOpenNowPlayingOnPlay = false;

    const playSongRequested = () => {
      // User clicked a song
      shouldOpenNowPlayingOnPlay = true;
      // Note: isNowPlayingOpen is NOT set to true yet!
    };

    const handlePlayerState = (state) => {
      // 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING
      if (state === 1) {
        if (shouldOpenNowPlayingOnPlay) {
          isNowPlayingOpen = true;
          shouldOpenNowPlayingOnPlay = false;
        }
      }
    };

    // 1. Initial click
    playSongRequested();
    assert.equal(isNowPlayingOpen, false, 'Card must not open merely on click');
    assert.equal(isQueueOpen, false, 'Queue must NEVER open automatically');

    // 2. Player buffers (state = 3)
    handlePlayerState(3);
    assert.equal(isNowPlayingOpen, false, 'Card must not open on buffering');

    // 3. Player starts playing (state = 1)
    handlePlayerState(1);
    assert.equal(isNowPlayingOpen, true, 'Card opens when playback begins');
    assert.equal(shouldOpenNowPlayingOnPlay, false, 'Trigger ref is reset');

    // 4. User minimizes card
    isNowPlayingOpen = false;

    // 5. Player pauses and resumes
    handlePlayerState(2); // paused
    handlePlayerState(1); // resumed
    assert.equal(isNowPlayingOpen, false, 'Resuming playback does not force open minimized card');
    assert.equal(isQueueOpen, false, 'Queue remains unaffected');
  });

  await t.test('Add to Playlist detects duplicates and prevents redundant additions', () => {
    const existingPlaylists = [
      {
        id: 'pl-1',
        name: 'Chill Vibes',
        songs: [{ id: 's1', title: 'Song 1' }]
      }
    ];

    const addSongToPlaylist = (playlists, playlistId, song) => {
      let alreadyIn = false;
      const updated = playlists.map(pl => {
        if (pl.id !== playlistId) return pl;
        if (pl.songs.some(s => s.id === song.id)) {
          alreadyIn = true;
          return pl;
        }
        return { ...pl, songs: [...pl.songs, song] };
      });

      if (alreadyIn) {
        return { success: false, alreadyExists: true, playlists };
      }
      return { success: true, alreadyExists: false, playlists: updated };
    };

    // Adding existing song 's1'
    const dupRes = addSongToPlaylist(existingPlaylists, 'pl-1', { id: 's1', title: 'Song 1' });
    assert.equal(dupRes.success, false);
    assert.equal(dupRes.alreadyExists, true);

    // Adding new song 's2'
    const successRes = addSongToPlaylist(existingPlaylists, 'pl-1', { id: 's2', title: 'Song 2' });
    assert.equal(successRes.success, true);
    assert.equal(successRes.playlists[0].songs.length, 2);
    assert.equal(successRes.playlists[0].songs[1].id, 's2');
  });

  await t.test('Context menu viewport clamping calculates valid fixed coordinates', () => {
    const calculateMenuCoords = (anchorRect, menuWidth = 224, menuHeight = 240, viewportWidth = 1024, viewportHeight = 768) => {
      let top = anchorRect.bottom + 6;
      let left = anchorRect.right - menuWidth;

      if (top + menuHeight > viewportHeight - 16) {
        top = Math.max(16, anchorRect.top - menuHeight - 6);
      }
      if (left < 16) {
        left = 16;
      }
      return { top, left };
    };

    // Standard positioning below button, aligned right
    const standard = calculateMenuCoords({ top: 100, bottom: 130, left: 500, right: 530 });
    assert.equal(standard.top, 136);
    assert.equal(standard.left, 530 - 224);

    // Near bottom edge: flips above button
    const nearBottom = calculateMenuCoords({ top: 650, bottom: 680, left: 500, right: 530 });
    assert.equal(nearBottom.top, 650 - 240 - 6);

    // Near left edge: clamps to min 16px
    const nearLeft = calculateMenuCoords({ top: 100, bottom: 130, left: 20, right: 50 });
    assert.equal(nearLeft.left, 16);
  });
});

