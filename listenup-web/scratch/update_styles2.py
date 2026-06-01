import re

with open('src/App.jsx', 'r') as f:
    c = f.read()

# 1. Update `renderPlaylistDropdown` div class
c = c.replace('<div className="flex items-center gap-2 relative">', '<div className="relative">')

# 2. Remove the toggleFavorite button from inside `renderPlaylistDropdown`
c = re.sub(r'<button[^>]*?onClick={\(e\) => \{\s*e\.stopPropagation\(\);\s*toggleFavorite\(song\);\s*\}}[^>]*>.*?</button>\s*(<button[^>]*?playlist-dropdown-trigger)', r'\1', c, flags=re.DOTALL)

# 3. Add 'Add to Queue' to the dropdown menu
queue_btn = """                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    appendToQueue(song);
                    setActiveDropdownSong(null);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors border-t border-slate-800/50 mt-1"
                >
                  Add to Queue
                </button>\n"""
c = c.replace('                  Cancel\n                </button>\n              </div>', queue_btn + '                  Cancel\n                </button>\n              </div>')

# 4. Remove the wrapper div and Add to Queue button from the Home cards
c = re.sub(r'<div className="flex items-center gap-0\.5">\s*<button[^>]*?onClick={\(\) => appendToQueue\(song\)}[^>]*>.*?</button>\s*(\{renderPlaylistDropdown\(song, \'up\'\)\})\s*</div>', r'\1', c, flags=re.DOTALL)

# 5. Remove the standalone Add to Queue buttons from the Search and Favorites lists
c = re.sub(r'<button[^>]*?onClick={\(\) => appendToQueue\(song\)}[^>]*>.*?</button>\s*(\{renderPlaylistDropdown\(song, \'down\'\)\})', r'\1', c, flags=re.DOTALL)

# 6. Change justify-between to justify-end gap-1 on the Home cards to push buttons to the right
c = c.replace('className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/5"', 'className="flex items-center justify-end gap-1 mt-2.5 pt-2 border-t border-white/5"')

with open('src/App.jsx', 'w') as f:
    f.write(c)
