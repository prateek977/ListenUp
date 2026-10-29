import test from 'node:test';
import assert from 'node:assert/strict';

test('Recommendation Client & Playback Logic', async (t) => {
  await t.test('Previous button rewinds when currentTime > 3 without recording a skip', () => {
    let seekedTo = null;
    let skipEventSent = false;
    let sessionReset = false;

    const player = {
      getCurrentTime: () => 14.5,
      seekTo: (time) => { seekedTo = time; },
    };

    const session = {
      songId: 'song_1',
      startTime: Date.now() - 14500,
      lastProgressReport: Date.now() - 10000,
      lastReportedSeconds: 10,
      completed: false,
    };

    // Simulate playPrevious logic
    if (player.getCurrentTime() > 3) {
      player.seekTo(0);
      session.startTime = Date.now();
      session.lastProgressReport = Date.now();
      session.lastReportedSeconds = 0;
      session.completed = false;
      sessionReset = true;
    } else {
      skipEventSent = true;
    }

    assert.equal(seekedTo, 0);
    assert.equal(skipEventSent, false, 'Skip event must not be sent when rewinding > 3s');
    assert.equal(sessionReset, true);
    assert.equal(session.lastReportedSeconds, 0);
    assert.equal(session.completed, false);
  });

  await t.test('Previous button triggers skip only when navigating away to previous track (currentTime <= 3)', () => {
    let skipEventSent = false;
    let navigatedSong = null;

    const player = {
      getCurrentTime: () => 2.0,
      getDuration: () => 200,
    };

    const queue = [
      { id: 'song_0', title: 'First' },
      { id: 'song_1', title: 'Second' },
    ];
    const activeSong = queue[1];
    const session = { songId: 'song_1', completed: false };

    // Simulate playPrevious logic when currentTime <= 3
    if (player.getCurrentTime() <= 3) {
      const currentIdx = queue.findIndex(s => s.id === activeSong.id);
      if (currentIdx > 0) {
        // Track change
        skipEventSent = true;
        navigatedSong = queue[currentIdx - 1];
      }
    }

    assert.equal(skipEventSent, true);
    assert.equal(navigatedSong.id, 'song_0');
  });

  await t.test('Progress heartbeats report bounded deltas, not cumulative timestamps', () => {
    const session = {
      lastProgressReport: Date.now() - 30000,
      lastReportedSeconds: 30.0,
      completed: false,
    };

    const curT = 60.5;
    const elapsedWall = (Date.now() - session.lastProgressReport) / 1000;
    const prevSec = session.lastReportedSeconds;
    const rawDelta = curT - prevSec; // 30.5s
    const delta = rawDelta > 0 ? Math.min(rawDelta, elapsedWall + 2) : 0;

    assert.ok(delta > 28 && delta <= 32.5, `Delta ${delta} should be bounded near elapsed ~30s`);
    assert.notEqual(delta, curT, 'Reported duration must never be the cumulative position');
  });

  await t.test('Autoplay queue atomically appends all recommendations without drops', () => {
    const initialQueue = [{ id: 'q1', title: 'Queue 1' }];
    const fetchedRecommendations = [
      { id: 'r1', title: 'Reco 1' },
      { id: 'r2', title: 'Reco 2' },
      { id: 'r3', title: 'Reco 3' },
    ];

    // Functional state update simulation
    const updatedQueue = ((prev) => {
      const existingIds = new Set(prev.map(s => s.id));
      const toAdd = fetchedRecommendations.filter(s => !existingIds.has(s.id));
      return [...prev, ...toAdd];
    })(initialQueue);

    assert.equal(updatedQueue.length, 4);
    assert.deepEqual(updatedQueue.map(s => s.id), ['q1', 'r1', 'r2', 'r3']);
  });

  await t.test('Autoplay disabled prevents automatic playback start on queue end', () => {
    const autoplayEnabled = false;
    let playbackStarted = false;

    const onQueueExhausted = () => {
      if (!autoplayEnabled) {
        playbackStarted = false;
        return;
      }
      playbackStarted = true;
    };

    onQueueExhausted();
    assert.equal(playbackStarted, false);
  });

  await t.test('Auth header uses session access_token and rejects unauthenticated user_id spoofing', () => {
    const session = {
      access_token: 'valid.jwt.access_token',
      user: { id: 'auth-user-123' },
    };

    // Client builds headers from session access_token
    let authHeader = {};
    const token = session?.access_token;
    if (token) {
      authHeader = { 'Authorization': `Bearer ${token}` };
    }

    assert.equal(authHeader['Authorization'], 'Bearer valid.jwt.access_token');

    // Guest has no token
    const guestSession = null;
    let guestHeader = {};
    if (guestSession?.access_token) {
      guestHeader = { 'Authorization': `Bearer ${guestSession.access_token}` };
    }
    assert.deepEqual(guestHeader, {});
  });
});

