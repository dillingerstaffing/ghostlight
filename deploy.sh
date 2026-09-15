#!/bin/bash
# GHOSTLIGHT deploy: hash-bust CSS/JS references (GitHub Pages caches 600s),
# then commit and push. Usage: ./deploy.sh "commit message"
set -e
cd "$(dirname "$0")"
CSSV=$(md5sum assets/site.css | cut -c1-8)
JSV=$(md5sum assets/site.js | cut -c1-8)
for f in $(git ls-files '*.html'); do
  python3 - "$f" "$CSSV" "$JSV" <<'EOF'
import re, sys
f, cssv, jsv = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(f).read()
s = re.sub(r'assets/site\.css(\?v=[a-f0-9]+)?', 'assets/site.css?v=' + cssv, s)
s = re.sub(r'assets/site\.js(\?v=[a-f0-9]+)?', 'assets/site.js?v=' + jsv, s)
open(f, 'w').write(s)
EOF
done
node --check assets/site.js
git add -A
git -c user.name="dillingerstaffing" -c user.email="dillingerstaffing@users.noreply.github.com" \
  commit -q -m "${1:-Update site}" && git push -q
echo "deployed css?v=$CSSV js?v=$JSV"
