import os
import re

base_dir = r"d:\TPC\admin panel\physical-therapy-project-Admin-Panel\src\app\features\receptionist"

pattern = re.compile(r" \|\s*default:\s*['\"].*?['\"]")

for root, dirs, files in os.walk(base_dir):
    for file in files:
        if file.endswith('.html'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = pattern.sub('', content)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Fixed {filepath}")

print("Done fixing default pipes.")
