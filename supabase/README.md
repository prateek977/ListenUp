# ListenUp — Supabase Setup & Migration Guide

This directory contains the database schema, Row-Level Security (RLS) policies, authentication triggers, and seed catalogs for ListenUp.

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create a free project.
2. Under **Project Settings > API**, copy:
   - **Project URL** (e.g. `https://xyzcompany.supabase.co`)
   - **anon / public key** (safe for client-side usage)
   - **JWT Secret** (keep this secret; only used by backend for token verification)

## 2. Apply the Database Migration

Open the **SQL Editor** in your Supabase Dashboard:
1. Copy the contents of `supabase/migrations/20261026_init_schema.sql`.
2. Paste it into a new query window.
3. Click **Run**.

This will automatically create:
- `profiles` table with automatic signup trigger `on_auth_user_created`
- `genres`, `artists`, `languages` catalogs pre-seeded with Bollywood, Hip-Hop, Punjabi, EDM, Arijit Singh, Diljit Dosanjh, Drake, Taylor Swift, etc.
- `user_genres`, `user_favorite_artists`, `user_languages`, `user_listening_preferences` tables with foreign keys and cascade deletion
- `user_favorites` and `user_playlists` cloud sync tables
- High-performance indexes
- Strict Row-Level Security (RLS) policies enforcing that users can only view and mutate their own preferences.

## 3. Configure Authentication in Supabase

1. Go to **Authentication > Providers**:
   - **Email**: Ensure Email provider is enabled.
   - (Optional) Toggle "Confirm email" based on your preference (development can have it disabled for instantaneous sign-in).
   - (Optional) Enable **Google OAuth** if client credentials are available.
2. In **Authentication > URL Configuration**:
   - Set Site URL to `http://localhost:5173` (for development) and your production domain (e.g. `https://listenup-web.vercel.app`).
   - Add Redirect URLs: `http://localhost:5173/**`, `https://listenup-web.vercel.app/**`.

## 4. Environment Variables

In `listenup-web/.env` or `.env.local`:
```bash
VITE_API_URL=http://localhost:5001
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

In `backend/.env`:
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret-from-dashboard
```
