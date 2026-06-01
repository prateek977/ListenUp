import re

file_path = "/Users/prateekjaiswal/vibe-tunes/listenup/listenup-web/src/App.jsx"

with open(file_path, "r") as f:
    content = f.read()

# 1. Add aria-label based on title attributes
# Pattern matches <button ... title="Something" ...>
# We will use re.sub with a function to add aria-label="Something" if it doesn't exist
def add_aria_from_title(match):
    full_match = match.group(0)
    title_val = match.group(1)
    
    # If aria-label is already there, ignore
    if 'aria-label=' in full_match:
        return full_match
        
    # We will insert aria-label right after title
    return full_match.replace(f'title="{title_val}"', f'title="{title_val}" aria-label="{title_val}"')

content = re.sub(r'<button[^>]+title="([^"]+)"[^>]*>', add_aria_from_title, content)
content = re.sub(r'<a[^>]+title="([^"]+)"[^>]*>', add_aria_from_title, content)

# 2. Add specific aria labels for known player buttons that use expressions in title or don't have titles
# Shuffle button
content = content.replace(
    'title="Shuffle"',
    'title="Shuffle" aria-label="Shuffle"'
)
# Previous
content = content.replace(
    'title="Previous"',
    'title="Previous" aria-label="Previous track"'
)
# Next
content = content.replace(
    'title="Next"',
    'title="Next" aria-label="Next track"'
)
# Heart / Favorite
content = content.replace(
    'onClick={() => toggleFavorite(currentSong)}',
    'onClick={() => toggleFavorite(currentSong)}\n                aria-label={favorites.some(s => s.id === currentSong.id) ? "Remove from favorites" : "Add to favorites"}'
)
# Close Sidebar
content = content.replace(
    'onClick={() => setIsMobileMenuOpen(false)}\n            className="p-2 -mr-2 text-slate-400',
    'onClick={() => setIsMobileMenuOpen(false)}\n            aria-label="Close menu"\n            className="p-2 -mr-2 text-slate-400'
)
# Play/Pause
content = content.replace(
    "title={isPlaying ? 'Pause' : 'Play'}",
    "title={isPlaying ? 'Pause' : 'Play'} aria-label={isPlaying ? 'Pause' : 'Play'}"
)
# Repeat
content = content.replace(
    "title={`Repeat: ${repeat}`}",
    "title={`Repeat: ${repeat}`} aria-label={`Repeat: ${repeat}`}"
)

# 3. Insert visually hidden SEO content
seo_block = """
        {/* SEO Visually Hidden Content */}
        <section className="sr-only">
          <h2>What is ListenUp?</h2>
          <p>ListenUp is a premium, real-time collaborative music streaming platform. Search and stream an unlimited library of music directly from YouTube.</p>
          <h3>Main Features</h3>
          <ul>
            <li>Real-Time Music Rooms: Create a room, invite friends, and listen together in perfect sync using WebSockets.</li>
            <li>Unlimited Search: Find any song, artist, or album using our powerful yt-dlp integrated search.</li>
            <li>Play Queue & Favorites: Curate your perfect playlist and save your favorite tracks locally.</li>
          </ul>
          <h3>Technology Stack</h3>
          <p>Built with React, Vite, Tailwind CSS, Python, Flask, Flask-SocketIO, and the YouTube Iframe Player API.</p>
        </section>
"""

# Insert right after <main className="flex-1 flex flex-col h-full overflow-y-auto pb-32 md:pb-28 px-4 md:px-8 py-4 md:py-6 z-10">
content = content.replace(
    '<main className="flex-1 flex flex-col h-full overflow-y-auto pb-32 md:pb-28 px-4 md:px-8 py-4 md:py-6 z-10">',
    '<main className="flex-1 flex flex-col h-full overflow-y-auto pb-32 md:pb-28 px-4 md:px-8 py-4 md:py-6 z-10">\n' + seo_block
)

with open(file_path, "w") as f:
    f.write(content)

print("Accessibility and SEO updates applied to App.jsx!")
