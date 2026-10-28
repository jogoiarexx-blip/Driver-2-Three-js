#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
printf 'Abra http://localhost:8000/chicago-original-preview.html\n'
python3 -m http.server 8000
