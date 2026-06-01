import sys

with open('src/App.jsx', 'r') as f:
    content = f.read()

# 1. Replace main background
content = content.replace('bg-[#0b0813]', 'bg-black')

# 2. Replace modal background
content = content.replace('bg-[#161224]', 'bg-[#111111]')

# 3. Replace text-glow-purple with text-glow-cyan
content = content.replace('text-glow-purple', 'text-glow-cyan')

# 4. Replace purple and indigo with cyan
for num in ['400', '500', '600', '800', '900', '950']:
    content = content.replace(f'purple-{num}', f'cyan-{num}')
    content = content.replace(f'indigo-{num}', f'cyan-{num}')

# 5. Remove the background neon gradients
import re
content = re.sub(r'{/\* Background Neon Gradients \*/}.*?pointer-events-none"></div>', '', content, flags=re.DOTALL)

with open('src/App.jsx', 'w') as f:
    f.write(content)
