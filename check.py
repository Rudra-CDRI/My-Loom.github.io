import os
import re

def check_brackets(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return
        
    open_braces = content.count('{')
    close_braces = content.count('}')
    if open_braces != close_braces:
        print(f'{file_path}: Mismatch! {{: {open_braces}, }}: {close_braces}')
    else:
        print(f'{file_path}: OK')

files = [
    'src/js/app.js',
    'src/js/store.js',
    'src/js/modules/tasks.js',
    'src/js/modules/library.js',
    'src/js/modules/internships.js',
    'src/js/modules/dashboard.js',
    'src/js/modules/vault.js'
]

for f in files:
    check_brackets(f)
