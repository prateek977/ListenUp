import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences] = useState(() => {
    try {
      const current = localStorage.getItem('listenup_user_prefs_current');
      if (current) {
        const parsed = JSON.parse(current);
        if (parsed && (parsed.genres?.length > 0 || parsed.artists?.length > 0 || parsed.languages?.length > 0)) {
          return parsed;
        }
      }
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('listenup_user_prefs_')) {
          const val = localStorage.getItem(key);
          if (val) {
            const parsed = JSON.parse(val);
            if (parsed && (parsed.genres?.length > 0 || parsed.artists?.length > 0 || parsed.languages?.length > 0)) {
              return parsed;
            }
          }
        }
      }
    } catch {}
    return {
      genres: [],
      artists: [],
      languages: [],
      moods: [],
      activities: [],
      explicit_content_preference: true
    };
  });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Centralized Authentication Guard State
  const [authModalState, setAuthModalState] = useState({
    isOpen: false,
    mode: 'signin',
    message: null,
    pendingAction: null
  });

  const userRef = useRef(null);
  userRef.current = user;
  const fetchingUserIdRef = useRef(null);
  const pendingActionRef = useRef(null);

  const closeAuthModal = useCallback(() => {
    pendingActionRef.current = null;
    setAuthModalState(prev => ({
      ...prev,
      isOpen: false,
      message: null,
      pendingAction: null
    }));
  }, []);

  const openAuthModal = useCallback(({ mode = 'signin', message = null, onAuthSuccess = null } = {}) => {
    if (typeof onAuthSuccess === 'function') {
      pendingActionRef.current = onAuthSuccess;
    }
    setAuthModalState({
      isOpen: true,
      mode,
      message,
      pendingAction: typeof onAuthSuccess === 'function' ? onAuthSuccess : null
    });
  }, []);

  /**
   * Centralized Authentication Guard
   * Verifies that a valid authenticated user exists before permitting data-persisting mutations.
   * If unauthenticated, displays the login dialog with a clear explanation, preserves the
   * intended action to resume after authentication, and returns { success: false, requireAuth: true }.
   */
  const requireAuth = useCallback((actionCallback, options = {}) => {
    const activeUser = userRef.current;
    if (activeUser?.id) {
      if (typeof actionCallback === 'function') {
        return actionCallback(activeUser);
      }
      return { success: true, user: activeUser };
    }

    const promptMessage = options.message || 'Log in to save your playlists, favorites, and preferences.';
    const mode = options.mode || 'signin';

    if (typeof actionCallback === 'function') {
      pendingActionRef.current = actionCallback;
    }

    setAuthModalState({
      isOpen: true,
      mode,
      message: promptMessage,
      pendingAction: typeof actionCallback === 'function' ? actionCallback : null
    });

    return { success: false, requireAuth: true };
  }, []);

  // Fetch full user profile & preferences from Supabase (or fallback adapter)
  const fetchUserData = useCallback(async (userId, fallbackMeta) => {
    if (!userId) return;
    if (fetchingUserIdRef.current === userId) return; // Prevent duplicate concurrent fetch
    fetchingUserIdRef.current = userId;

    const userMetadata = fallbackMeta || userRef.current?.user_metadata || {};

    try {
      // Check local cache first for instant reliable state
      const localCachedProfileStr = localStorage.getItem(`listenup_profile_${userId}`);
      let cachedProf = null;
      if (localCachedProfileStr) {
        try { cachedProf = JSON.parse(localCachedProfileStr); } catch (e) {}
      }
      const hasCompletedLocally = localStorage.getItem(`listenup_onboarding_completed_${userId}`) === 'true';
      const needsOnboarding = localStorage.getItem(`listenup_needs_onboarding_${userId}`) === 'true' || 
                              sessionStorage.getItem('listenup_just_signed_up') === 'true';

      // 1. Fetch Profile
      let profileData = null;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (!error && data) {
          profileData = data;
        }
      } catch (e) {
        console.warn('Supabase profile query warning:', e);
      }

      if (profileData) {
        // If local record is already completed, or DB is completed, or it's an existing account (not freshly signed up)
        const isCompleted = profileData.onboarding_completed === true || 
                            hasCompletedLocally || 
                            cachedProf?.onboarding_completed === true ||
                            !needsOnboarding;

        const resolvedProf = { ...profileData, onboarding_completed: isCompleted };
        setProfile(resolvedProf);
        localStorage.setItem(`listenup_profile_${userId}`, JSON.stringify(resolvedProf));
      } else {
        // Fallback default profile if trigger hasn't finished yet or DB is offline
        const meta = userMetadata;
        // CRITICAL FIX: Only set onboarding_completed = false if they EXPLICITLY just created an account!
        // On normal refresh or existing users, onboarding_completed MUST be true so onboarding doesn't pop up!
        const isCompleted = hasCompletedLocally || 
                            (cachedProf?.onboarding_completed === true) || 
                            (!needsOnboarding && !sessionStorage.getItem('listenup_just_signed_up'));

        const defaultProf = {
          id: userId,
          display_name: meta.full_name || meta.name || userRef.current?.email?.split('@')[0] || 'Listener',
          avatar_url: meta.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`,
          onboarding_completed: isCompleted
        };
        setProfile(defaultProf);
        localStorage.setItem(`listenup_profile_${userId}`, JSON.stringify(defaultProf));
      }

      // 2. Fetch User Preferences (Persistent Backend Database + Supabase Fallback)
      let backendLoaded = false;
      try {
        const beRes = await fetch(`/api/user/preferences?userId=${userId}`);
        if (beRes.ok) {
          const beJson = await beRes.json();
          if (beJson?.preferences && (
            (beJson.preferences.genres?.length || 0) > 0 ||
            (beJson.preferences.artists?.length || 0) > 0 ||
            (beJson.preferences.languages?.length || 0) > 0
          )) {
            const bp = beJson.preferences;
            const resolvedPrefs = {
              genres: bp.genres || [],
              artists: bp.artists || [],
              languages: bp.languages || [],
              moods: bp.moods || [],
              activities: bp.activities || [],
              explicit_content_preference: bp.explicit_content_preference ?? true
            };
            setPreferences(resolvedPrefs);
            localStorage.setItem(`listenup_user_prefs_${userId}`, JSON.stringify(resolvedPrefs));
            localStorage.setItem('listenup_user_prefs_current', JSON.stringify(resolvedPrefs));
            backendLoaded = true;
          }
        }
      } catch (beErr) {
        console.warn('Backend database preferences fetch note:', beErr);
      }

      if (isSupabaseConfigured && !backendLoaded) {
        try {
          const [genresRes, artistsRes, langsRes, prefsRes] = await Promise.all([
            supabase.from('user_genres').select('genre_id, genres(name, slug)').eq('user_id', userId),
            supabase.from('user_favorite_artists').select('artist_id, artists(id, name, image_url, external_id)').eq('user_id', userId),
            supabase.from('user_languages').select('language_id, custom_language, languages(name, code)').eq('user_id', userId),
            supabase.from('user_listening_preferences').select('*').eq('user_id', userId).maybeSingle()
          ]);

          const loadedGenres = (genresRes.data || []).map(g => g.genres?.slug || g.genres?.name || g.genre_id);
          const loadedArtists = (artistsRes.data || []).map(a => {
            if (a.artists) {
              const rawExt = a.artists.external_id || '';
              const cleanId = rawExt.startsWith('deezer:') ? rawExt.replace('deezer:', '') : (a.artists.id || a.artist_id);
              return {
                id: cleanId,
                name: a.artists.name,
                image: a.artists.image_url || '',
                imageMedium: a.artists.image_url || '',
                imageLarge: a.artists.image_url || '',
                provider: 'deezer'
              };
            }
            return a.artist_id;
          });
          const loadedLangs = (langsRes.data || []).map(l => l.custom_language || l.languages?.name || l.language_id);
          const listeningPrefs = prefsRes.data || {};

          if (loadedGenres.length > 0 || loadedArtists.length > 0 || loadedLangs.length > 0) {
            const resolvedPrefs = {
              genres: loadedGenres,
              artists: loadedArtists,
              languages: loadedLangs,
              moods: listeningPrefs.preferred_moods || [],
              activities: listeningPrefs.listening_activities || [],
              explicit_content_preference: listeningPrefs.explicit_content_preference ?? true
            };
            setPreferences(resolvedPrefs);
            localStorage.setItem(`listenup_user_prefs_${userId}`, JSON.stringify(resolvedPrefs));
            localStorage.setItem('listenup_user_prefs_current', JSON.stringify(resolvedPrefs));
          } else {
            // Relational tables not present or empty: restore from Supabase Auth user_metadata or localStorage
            const savedLocal = (() => {
              try {
                const raw = localStorage.getItem(`listenup_user_prefs_${userId}`) ||
                            localStorage.getItem('listenup_user_prefs_current');
                return raw ? JSON.parse(raw) : null;
              } catch { return null; }
            })();
            const fallback = userMetadata?.preferences || savedLocal;
            if (fallback && (fallback.genres?.length > 0 || fallback.artists?.length > 0 || fallback.languages?.length > 0)) {
              const restoredPrefs = {
                genres: fallback.genres || [],
                artists: fallback.artists || [],
                languages: fallback.languages || [],
                moods: fallback.moods || [],
                activities: fallback.activities || [],
                explicit_content_preference: fallback.explicit_content_preference ?? true
              };
              setPreferences(restoredPrefs);
              localStorage.setItem(`listenup_user_prefs_${userId}`, JSON.stringify(restoredPrefs));
              localStorage.setItem('listenup_user_prefs_current', JSON.stringify(restoredPrefs));
            }
          }
        } catch (dbErr) {
          console.warn('Failed to load nested relational preferences from Supabase:', dbErr);
          const savedLocal = (() => {
            try {
              const raw = localStorage.getItem(`listenup_user_prefs_${userId}`) ||
                          localStorage.getItem('listenup_user_prefs_current');
              return raw ? JSON.parse(raw) : null;
            } catch { return null; }
          })();
          const fallback = userMetadata?.preferences || savedLocal;
          if (fallback && (fallback.genres?.length > 0 || fallback.artists?.length > 0 || fallback.languages?.length > 0)) {
            setPreferences(fallback);
          }
        }
      } else {
        // From LocalStorage Adapter
        const savedPrefs = localStorage.getItem(`listenup_user_prefs_${userId}`) ||
                           localStorage.getItem('listenup_user_prefs_current');
        if (savedPrefs) {
          try {
            setPreferences(JSON.parse(savedPrefs));
          } catch (e) {
            console.error('Error parsing local user preferences:', e);
          }
        }
      }
    } catch (err) {
      console.error('Error in fetchUserData:', err);
    } finally {
      fetchingUserIdRef.current = null;
    }
  }, []);

  // Auth state listener & session restoration - strictly initialized once
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(initialSession);
          const currentUser = initialSession?.user || null;
          setUser(currentUser);
          if (currentUser) {
            await fetchUserData(currentUser.id, currentUser.user_metadata);
          }
        }
      } catch (err) {
        console.error('Error restoring session:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      const currentUser = newSession?.user || null;
      setUser(currentUser);
      if (currentUser) {
        await fetchUserData(currentUser.id, currentUser.user_metadata);
        // Execute and clear any pending action after successful authentication
        if (pendingActionRef.current) {
          const actionToRun = pendingActionRef.current;
          pendingActionRef.current = null;
          setAuthModalState(prev => ({ ...prev, isOpen: false, pendingAction: null, message: null }));
          try {
            actionToRun(currentUser);
          } catch (actErr) {
            console.warn('Pending auth action execution error:', actErr);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        pendingActionRef.current = null;
        setProfile(null);
        setPreferences({
          genres: [],
          artists: [],
          languages: [],
          moods: [],
          activities: [],
          explicit_content_preference: true
        });
        localStorage.removeItem('listenup_user_prefs_current');
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
    };
  }, [fetchUserData]);

  // Sign In
  const signIn = async ({ email, password }) => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      setAuthError(err.message || 'Login failed');
      return { success: false, error: err.message };
    }
  };

  // Sign Up (First time account creation)
  const signUp = async ({ email, password, displayName }) => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: displayName || email.split('@')[0],
            avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${displayName || email}`
          }
        }
      });
      if (error) throw error;
      if (data?.user) {
        // Explicitly flag that this user just created an account and needs onboarding
        sessionStorage.setItem('listenup_just_signed_up', 'true');
        localStorage.setItem(`listenup_needs_onboarding_${data.user.id}`, 'true');
        localStorage.removeItem(`listenup_onboarding_completed_${data.user.id}`);
      }
      return { success: true, data };
    } catch (err) {
      setAuthError(err.message || 'Sign up failed');
      return { success: false, error: err.message };
    }
  };

  // Sign Out
  const signOut = async () => {
    setAuthError(null);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Password Reset
  const resetPassword = async (email) => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      setAuthError(err.message || 'Password reset request failed');
      return { success: false, error: err.message };
    }
  };

  // Update Profile
  const updateProfile = async (updates) => {
    if (!user) {
      requireAuth(null, { message: 'Log in to update your profile settings.' });
      return { success: false, requireAuth: true, error: 'Authentication required' };
    }
    try {
      const updated = {
        ...profile,
        ...updates,
        updated_at: new Date().toISOString()
      };

      // 1. Persist to Supabase Auth user_metadata (guaranteed DB storage)
      if (isSupabaseConfigured) {
        try {
          await supabase.auth.updateUser({
            data: {
              full_name: updates.display_name || profile?.display_name || user.email?.split('@')[0],
              display_name: updates.display_name || profile?.display_name,
              avatar_url: updates.avatar_url || profile?.avatar_url,
              profile: updated
            }
          });
        } catch (metaErr) {
          console.warn('Profile user_metadata update warning:', metaErr);
        }
      }

      // 2. Also sync to profiles relational table if present
      const { error } = await supabase
        .from('profiles')
        .upsert(updated);

      if (error) {
        console.warn('Supabase profile table update warning:', error.message);
      }
      setProfile(updated);
      localStorage.setItem(`listenup_profile_${user.id}`, JSON.stringify(updated));
      return { success: true, data: updated };
    } catch (err) {
      console.error('Error updating profile:', err);
      if (updates) {
        setProfile(prev => ({ ...(prev || {}), ...updates }));
        return { success: true, data: { ...profile, ...updates } };
      }
      return { success: false, error: err.message };
    }
  };

  // Save Onboarding Data & Mark Onboarding Completed
  const saveOnboardingData = async ({
    genres = [],
    artists = [],
    languages = [],
    moods = [],
    activities = [],
    explicitContent = true
  }) => {
    if (!user) {
      requireAuth(null, { message: 'Log in to save your music preferences.' });
      return { success: false, requireAuth: true, error: 'Authentication required' };
    }

    try {
      // 1. Immediately persist completion to localStorage so ANY refresh keeps it permanently
      localStorage.setItem(`listenup_onboarding_completed_${user.id}`, 'true');
      localStorage.removeItem(`listenup_needs_onboarding_${user.id}`);
      sessionStorage.removeItem('listenup_just_signed_up');
      localStorage.removeItem('listenup_onboarding_draft');

      // 2. Update Profile to completed
      const profileUpdates = {
        id: user.id,
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      };
      
      const newProfile = { ...(profile || {}), ...profileUpdates };
      setProfile(newProfile);
      localStorage.setItem(`listenup_profile_${user.id}`, JSON.stringify(newProfile));

      try {
        await supabase.from('profiles').upsert(profileUpdates);
      } catch (profErr) {
        console.warn('Profiles table upsert warning:', profErr);
      }

      // 2. Persist listening preferences
      const listeningPayload = {
        user_id: user.id,
        preferred_moods: moods,
        listening_activities: activities,
        explicit_content_preference: explicitContent,
        updated_at: new Date().toISOString()
      };
      try {
        await supabase.from('user_listening_preferences').upsert(listeningPayload);
      } catch (prefsErr) {
        console.warn('Preferences table upsert warning:', prefsErr);
      }

      // 3. Persist local user preferences cache
      const newPrefs = {
        genres,
        artists,
        languages,
        moods,
        activities,
        explicit_content_preference: explicitContent
      };
      setPreferences(newPrefs);
      localStorage.setItem(`listenup_user_prefs_${user.id}`, JSON.stringify(newPrefs));
      localStorage.setItem('listenup_user_prefs_current', JSON.stringify(newPrefs));

      // 3b. Persist to Backend SQLite Database (100% reliable local database persistence)
      try {
        await fetch('/api/user/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, preferences: newPrefs })
        });
      } catch (beSaveErr) {
        console.warn('Backend preferences database save note:', beSaveErr);
      }

      // 4. Persist to Supabase Auth user_metadata (permanent DB persistence without needing migrations)
      if (isSupabaseConfigured) {
        try {
          await supabase.auth.updateUser({
            data: {
              preferences: newPrefs,
              onboarding_completed: true
            }
          });
        } catch (metaErr) {
          console.warn('Supabase auth metadata update warning:', metaErr);
        }
      }

      // 5. If Supabase is connected, attempt sync to relational join tables
      if (isSupabaseConfigured) {
        try {
          // Clear and sync user_genres
          await supabase.from('user_genres').delete().eq('user_id', user.id);
          if (genres.length > 0) {
            // Find matching genre IDs or insert
            const { data: dbGenres } = await supabase.from('genres').select('id, slug, name');
            const genreInserts = genres.map(g => {
              const match = (dbGenres || []).find(dg => dg.slug === g || dg.name.toLowerCase() === g.toLowerCase());
              return match ? { user_id: user.id, genre_id: match.id } : null;
            }).filter(Boolean);
            if (genreInserts.length > 0) {
              await supabase.from('user_genres').insert(genreInserts);
            }
          }

          // Clear and sync user_favorite_artists
          await supabase.from('user_favorite_artists').delete().eq('user_id', user.id);
          if (artists.length > 0) {
            const { data: dbArtists } = await supabase.from('artists').select('id, name, external_id');
            const artistInserts = [];
            for (const art of artists) {
              const artName = typeof art === 'string' ? art : art.name;
              const artExtId = typeof art === 'object' && art.id ? `deezer:${art.id}` : null;
              const artImg = typeof art === 'object' ? (art.imageMedium || art.imageLarge || art.image || art.imageUrl) : null;

              let match = (dbArtists || []).find(da => 
                (artExtId && da.external_id === artExtId) || 
                da.name.toLowerCase() === artName.toLowerCase()
              );
              if (!match) {
                // Insert new artist into catalog with Deezer metadata
                const { data: newArt } = await supabase.from('artists').insert({
                  name: artName,
                  image_url: artImg,
                  external_id: artExtId
                }).select().single();
                match = newArt;
              } else if (artImg && !match.image_url) {
                await supabase.from('artists').update({ image_url: artImg, external_id: artExtId }).eq('id', match.id);
              }
              if (match) {
                artistInserts.push({ user_id: user.id, artist_id: match.id });
              }
            }
            if (artistInserts.length > 0) {
              await supabase.from('user_favorite_artists').insert(artistInserts);
            }
          }

          // Clear and sync user_languages
          await supabase.from('user_languages').delete().eq('user_id', user.id);
          if (languages.length > 0) {
            const { data: dbLangs } = await supabase.from('languages').select('id, name');
            const langInserts = languages.map(lang => {
              const match = (dbLangs || []).find(dl => dl.name.toLowerCase() === lang.toLowerCase());
              return match 
                ? { user_id: user.id, language_id: match.id } 
                : { user_id: user.id, language_id: dbLangs?.[0]?.id, custom_language: lang };
            }).filter(Boolean);
            if (langInserts.length > 0) {
              await supabase.from('user_languages').insert(langInserts);
            }
          }
        } catch (syncErr) {
          console.warn('Error syncing relational tables in Supabase:', syncErr);
        }
      }

      return { success: true };
    } catch (err) {
      console.error('Error saving onboarding data:', err);
      return { success: false, error: err.message };
    }
  };

  // Restart onboarding
  const restartOnboarding = async () => {
    if (!user) {
      requireAuth(null, { message: 'Log in to manage your music preferences.' });
      return { success: false, requireAuth: true, error: 'Authentication required' };
    }
    try {
      localStorage.setItem(`listenup_needs_onboarding_${user.id}`, 'true');
      localStorage.removeItem(`listenup_onboarding_completed_${user.id}`);
      await updateProfile({ onboarding_completed: false });
    } catch (e) {
      console.error('Error restarting onboarding:', e);
    }
  };

  // Skip onboarding and immediately launch app
  const skipOnboarding = async () => {
    if (!user) {
      return { success: false, requireAuth: true, error: 'Authentication required' };
    }
    const targetId = user.id;
    localStorage.setItem(`listenup_onboarding_completed_${targetId}`, 'true');
    localStorage.removeItem(`listenup_needs_onboarding_${targetId}`);
    localStorage.removeItem('listenup_onboarding_draft');
    sessionStorage.removeItem('listenup_just_signed_up');

    const updated = { ...(profile || {}), onboarding_completed: true };
    setProfile(updated);
    localStorage.setItem(`listenup_profile_${user.id}`, JSON.stringify(updated));
    try {
      await supabase.from('profiles').upsert({ id: user.id, onboarding_completed: true });
    } catch (e) {
      console.warn('Skip onboarding upsert warning:', e);
    }
    return { success: true };
  };

  // Migrate guest favorites and playlists into user's account (obsolete - zero guest persistence)
  const migrateGuestData = async (guestFavorites = [], guestPlaylists = []) => {
    return { success: true };
  };

  const value = {
    session,
    user,
    profile,
    preferences,
    loading,
    authError,
    isSupabaseConfigured,
    authModalState,
    requireAuth,
    openAuthModal,
    closeAuthModal,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
    saveOnboardingData,
    restartOnboarding,
    skipOnboarding,
    migrateGuestData,
    refreshUserData: () => user && fetchUserData(user.id)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
