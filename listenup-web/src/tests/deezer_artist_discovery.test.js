import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFanCount, getArtistInitials } from '../lib/artistClient.js';

test('Deezer Artist Discovery & Client Utilities', async (t) => {
  await t.test('formatFanCount handles edge cases and large numbers', () => {
    assert.equal(formatFanCount(null), '');
    assert.equal(formatFanCount(undefined), '');
    assert.equal(formatFanCount(0), '');
    assert.equal(formatFanCount(-50), '');
    assert.equal(formatFanCount('not a number'), '');

    assert.equal(formatFanCount(500), '500 fans');
    assert.equal(formatFanCount(1000), '1K fans');
    assert.equal(formatFanCount(1500), '1.5K fans');
    assert.equal(formatFanCount(233619), '233.6K fans');
    assert.equal(formatFanCount(1000000), '1M fans');
    assert.equal(formatFanCount(12400000), '12.4M fans');
    assert.equal(formatFanCount(12000000), '12M fans');
  });

  await t.test('getArtistInitials extracts correct initials for avatars', () => {
    assert.equal(getArtistInitials(''), '♪');
    assert.equal(getArtistInitials('   '), '♪');
    assert.equal(getArtistInitials(null), '♪');
    assert.equal(getArtistInitials('Adele'), 'AD');
    assert.equal(getArtistInitials('Arijit Singh'), 'AS');
    assert.equal(getArtistInitials('The Black Keys'), 'TK');
    assert.equal(getArtistInitials('Taylor Swift'), 'TS');
    assert.equal(getArtistInitials('dua lipa'), 'DL');
  });

  await t.test('Artist selection state retains previously selected artists across query changes', () => {
    // Simulated selected artists state (as in Step2Artists.jsx / ProfileSettingsModal.jsx)
    let selectedArtists = [];

    const toggleArtist = (artist) => {
      const isSelected = selectedArtists.some(
        (a) => (a.id && artist.id && String(a.id) === String(artist.id)) ||
               (a.name && artist.name && a.name.toLowerCase() === artist.name.toLowerCase())
      );

      if (isSelected) {
        selectedArtists = selectedArtists.filter(
          (a) => !((a.id && artist.id && String(a.id) === String(artist.id)) ||
                   (a.name && artist.name && a.name.toLowerCase() === artist.name.toLowerCase()))
        );
      } else {
        selectedArtists = [...selectedArtists, artist];
      }
    };

    // User searches for "arijit" and selects Arijit Singh
    const arijit = {
      id: 1152015,
      name: 'Arijit Singh',
      image: 'https://e-cdns-images.dzcdn.net/images/artist/arijit/250x250-000000-80-0-0.jpg',
      imageMedium: 'https://e-cdns-images.dzcdn.net/images/artist/arijit/250x250-000000-80-0-0.jpg',
      imageLarge: 'https://e-cdns-images.dzcdn.net/images/artist/arijit/500x500-000000-80-0-0.jpg',
      deezerUrl: 'https://www.deezer.com/artist/1152015',
      provider: 'deezer',
      fanCount: 233619
    };
    toggleArtist(arijit);
    assert.equal(selectedArtists.length, 1);
    assert.equal(selectedArtists[0].name, 'Arijit Singh');

    // User changes search query to "taylor" and selects Taylor Swift
    const taylor = {
      id: 12246,
      name: 'Taylor Swift',
      image: 'https://e-cdns-images.dzcdn.net/images/artist/taylor/250x250.jpg',
      imageMedium: 'https://e-cdns-images.dzcdn.net/images/artist/taylor/250x250.jpg',
      imageLarge: 'https://e-cdns-images.dzcdn.net/images/artist/taylor/500x500.jpg',
      deezerUrl: 'https://www.deezer.com/artist/12246',
      provider: 'deezer',
      fanCount: 15400000
    };
    toggleArtist(taylor);
    // Prior selection (Arijit) MUST be preserved
    assert.equal(selectedArtists.length, 2);
    assert.deepEqual(selectedArtists.map(a => a.name), ['Arijit Singh', 'Taylor Swift']);

    // Toggling Taylor Swift again removes her while keeping Arijit
    toggleArtist(taylor);
    assert.equal(selectedArtists.length, 1);
    assert.equal(selectedArtists[0].name, 'Arijit Singh');
  });

  await t.test('Artist deduplication handles matching by id or name', () => {
    const list = [
      { id: 100, name: 'Coldplay', provider: 'deezer' },
      { id: '100', name: 'Coldplay Live', provider: 'deezer' }, // same id
      { id: 200, name: 'coldplay', provider: 'deezer' }         // same case-insensitive name
    ];

    const deduplicated = [];
    for (const item of list) {
      const exists = deduplicated.some(
        d => (d.id && item.id && String(d.id) === String(item.id)) ||
             (d.name && item.name && d.name.toLowerCase() === item.name.toLowerCase())
      );
      if (!exists) deduplicated.push(item);
    }

    assert.equal(deduplicated.length, 1);
    assert.equal(deduplicated[0].name, 'Coldplay');
  });

  await t.test('Deezer artist normalization preserves required schema attributes', () => {
    const rawDeezerResponse = {
      data: [
        {
          id: 1152015,
          name: 'Arijit Singh',
          link: 'https://www.deezer.com/artist/1152015',
          picture: 'https://e-cdns-images.dzcdn.net/images/artist/abc/56x56-000000-80-0-0.jpg',
          picture_medium: 'https://e-cdns-images.dzcdn.net/images/artist/abc/250x250-000000-80-0-0.jpg',
          picture_big: 'https://e-cdns-images.dzcdn.net/images/artist/abc/500x500-000000-80-0-0.jpg',
          nb_album: 48,
          nb_fan: 233619
        }
      ],
      total: 1,
      next: null
    };

    const normalized = rawDeezerResponse.data.map(item => ({
      id: item.id,
      name: item.name,
      image: item.picture_medium || item.picture,
      imageMedium: item.picture_medium,
      imageLarge: item.picture_big,
      deezerUrl: item.link,
      provider: 'deezer',
      fanCount: item.nb_fan,
      albumCount: item.nb_album
    }));

    assert.equal(normalized.length, 1);
    assert.equal(normalized[0].id, 1152015);
    assert.equal(normalized[0].name, 'Arijit Singh');
    assert.equal(normalized[0].provider, 'deezer');
    assert.equal(normalized[0].imageMedium, 'https://e-cdns-images.dzcdn.net/images/artist/abc/250x250-000000-80-0-0.jpg');
    assert.equal(normalized[0].fanCount, 233619);
  });
});

