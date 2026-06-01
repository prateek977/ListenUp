import re

with open('src/App.jsx', 'r') as f:
    app_content = f.read()

replacements = {
    # Remove gradients from buttons
    r'bg-gradient-to-r from-cyan-600 to-cyan-600 hover:from-cyan-500 hover:to-cyan-500': 'bg-cyan-600 hover:bg-cyan-500',
    r'bg-gradient-to-r from-cyan-900 to-cyan-950': 'bg-cyan-950 hover:bg-cyan-900',
    r'bg-gradient-to-br from-cyan-900 to-cyan-950': 'bg-cyan-950 hover:bg-cyan-900',
    r'bg-gradient-to-b from-cyan-950 to-cyan-950': 'bg-cyan-950',
    r'bg-gradient-to-[a-z]+ from-[a-z0-9-]+ via-[a-z0-9-/]+ to-transparent': 'bg-cyan-950',
    
    # Remaining glass classes
    r'hover:bg-white/3': 'hover:bg-[#1a1a1a]',
    r'hover:bg-cyan-600/20': 'hover:bg-[#0a2e36]',
    r'bg-cyan-500/20': 'bg-[#0a2e36]',
    r'bg-cyan-500/25': 'bg-[#0a2e36]',
    r'border-cyan-500/30': 'border-[#0d3f4a]',
    r'bg-slate-800/40': 'bg-slate-800',
    r'bg-slate-900/30': 'bg-slate-900',
    r'hover:bg-red-500/10': 'hover:bg-[#2a0e10]',
    r'bg-red-500/10': 'bg-[#2a0e10]',
    r'border-red-500/20': 'border-[#3e1316]',
    r'bg-red-950/20': 'bg-[#2a0e10]',
    r'hover:bg-red-900/20': 'hover:bg-[#3e1316]',
    r'border-red-950/50': 'border-[#3e1316]',
    r'bg-slate-800/80': 'bg-slate-800',
    
    # Also fix any remaining shadow opacities on cards if needed, but not strictly required
    # Just replacing the core classes requested
}

for pattern, replacement in replacements.items():
    app_content = re.sub(pattern, replacement, app_content)

with open('src/App.jsx', 'w') as f:
    f.write(app_content)
