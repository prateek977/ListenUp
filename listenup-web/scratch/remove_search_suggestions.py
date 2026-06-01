import re

with open('src/App.jsx', 'r') as f:
    content = f.read()

# 1. Remove states
content = content.replace("  const [searchSuggestions, setSearchSuggestions] = useState([]);\n", "")
content = content.replace("  const [showSuggestions, setShowSuggestions] = useState(false);\n", "")

# 2. Revert input
input_target = """                <input
                  type="text"
                  placeholder="Search songs, artists, Lofi mixes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => { if (searchSuggestions.length > 0) setShowSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="w-full glass-input px-5 py-4 pl-12 rounded-2xl text-slate-100 placeholder-slate-500 shadow-inner"
                />"""
input_replacement = """                <input
                  type="text"
                  placeholder="Search songs, artists, Lofi mixes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full glass-input px-5 py-4 pl-12 rounded-2xl text-slate-100 placeholder-slate-500 shadow-inner"
                />"""
content = content.replace(input_target, input_replacement)

# 3. Remove dropdown
dropdown_target = """                </svg>
                
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                    {searchSuggestions.map((song) => (
                      <div
                        key={`sugg-${song.id}`}
                        className="flex items-center gap-3 p-3 hover:bg-[#222222] cursor-pointer transition-colors"
                        onClick={() => {
                          setSearchQuery(song.title);
                          setShowSuggestions(false);
                          playSong(song);
                        }}
                      >
                        <img src={song.thumbnailUrl} alt={song.title} className="w-10 h-10 rounded-md object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-100 font-semibold truncate">{song.title}</p>
                          <p className="text-xs text-slate-400 truncate">{song.artist}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>"""

dropdown_replacement = """                </svg>
              </div>"""
content = content.replace(dropdown_target, dropdown_replacement)

with open('src/App.jsx', 'w') as f:
    f.write(content)
