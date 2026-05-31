// Replace these with the real values from your Google Cloud Console when you have them.
export const API_KEY = "YOUR_API_KEY_HERE";
export const PROJECT_ID = "YOUR_PROJECT_ID_HERE";
export const CLIENT_ID = "450824632282-bvjvdivr2tk39144olho4hr15jk9tajn.apps.googleusercontent.com";

/**
 * Exchanges a Google ID Token for a Firebase Auth Token
 */
export async function signInWithGoogleToken(googleIdToken) {
  if (API_KEY === "YOUR_API_KEY_HERE") {
    console.warn("API Key is missing. Cannot sign in to Firebase.");
    return null;
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      postBody: `id_token=${googleIdToken}&providerId=google.com`,
      requestUri: 'http://localhost:5173',
      returnIdpCredential: true,
      returnSecureToken: true
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Failed to authenticate with Firebase");
  }

  return response.json();
}

/**
 * Fetches user data (playlists and liked songs) from Firestore via REST API
 */
export async function fetchUserData(uid, firebaseIdToken) {
  if (PROJECT_ID === "YOUR_PROJECT_ID_HERE") return null;

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${firebaseIdToken}`
    }
  });

  if (response.status === 404) {
    // User document doesn't exist yet, return defaults
    return { playlists: [], queue: [] }; 
  }

  if (!response.ok) {
    console.error("Failed to fetch user data from Firestore");
    return null;
  }

  const data = await response.json();
  
  // Parse the Firestore document format
  // Firestore stores JSON as specific typed objects (e.g. { stringValue: "..." })
  try {
    const playlistsStr = data.fields?.playlists?.stringValue || "[]";
    const queueStr = data.fields?.queue?.stringValue || "[]";
    
    return {
      playlists: JSON.parse(playlistsStr),
      queue: JSON.parse(queueStr)
    };
  } catch (e) {
    console.error("Error parsing Firestore data", e);
    return { playlists: [], queue: [] };
  }
}

/**
 * Saves user data (playlists and liked songs) to Firestore via REST API
 */
export async function saveUserData(uid, firebaseIdToken, playlists, queue) {
  if (PROJECT_ID === "YOUR_PROJECT_ID_HERE") return;

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`;
  
  const payload = {
    fields: {
      playlists: { stringValue: JSON.stringify(playlists) },
      queue: { stringValue: JSON.stringify(queue) }
    }
  };

  const response = await fetch(url, {
    method: 'PATCH', // PATCH creates if doesn't exist in Firestore REST
    headers: {
      'Authorization': `Bearer ${firebaseIdToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    console.error("Failed to save user data to Firestore");
  }
}
