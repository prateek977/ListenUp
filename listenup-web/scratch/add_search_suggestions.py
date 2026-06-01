import re

with open('src/App.jsx', 'r') as f:
    content = f.read()

# 1. Add states
state_addition = """  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);"""
content = content.replace("  const [searchLoading, setSearchLoading] = useState(false);", state_addition)

# 2. Add useEffect
effect_addition = """  useEffect(() => {
    if (!searchQuery.trim() || activeTab !== 'search') {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (data.results) {
          setSearchSuggestions(data.results.slice(0, 5));
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  const handleSearchSubmit = async (e) => {"""
content = content.replace("  const handleSearchSubmit = async (e) => {", effect_addition)

# 3. Update input props
input_target = """                <input
                  type="text"
                  placeholder="Search songs, artists, Lofi mixes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full glass-input px-5 py-4 pl-12 rounded-2xl text-slate-100 placeholder-slate-500 shadow-inner"
                />"""
input_replacement = """                <input
                  type="text"
                  placeholder="Search songs, artists, Lofi mixes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => { if (searchSuggestions.length > 0) setShowSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="w-full glass-input px-5 py-4 pl-12 rounded-2xl text-slate-100 placeholder-slate-500 shadow-inner"
                />"""
content = content.replace(input_target, input_replacement)

# 4. Add dropdown
dropdown_target = """                </svg>
              </div>
              <button
                type="submit"
                disabled={searchLoading}"""
dropdown_replacement = """                </svg>
                
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
              </div>
              <button
                type="submit"
                disabled={searchLoading}"""
content = content.replace(dropdown_target, dropdown_replacement)

with open('src/App.jsx', 'w') as f:
    f.write(content)
