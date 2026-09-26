#!/usr/bin/env python3
"""Fail-loud internal-reference audit for the GHOSTLIGHT static site.

Run before every deploy from the deploy root:
    python3 scripts/link-audit.py
Exit 0: every internal href/src resolves to a real file. Exit 1: broken
references printed, deploy must stop until they are fixed.
"""
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def main():
    broken = []
    checked = 0
    for root, _dirs, files in os.walk(BASE):
        for fn in files:
            if not fn.endswith('.html'):
                continue
            path = os.path.join(root, fn)
            text = open(path).read()
            for url in re.findall(
                r'(?:src|href)="(?!https?://|data:|#|mailto:)([^"]+)"', text
            ):
                url = url.split('#')[0].split('?')[0]
                if not url or url == 'index.html':
                    continue
                checked += 1
                target = os.path.normpath(os.path.join(root, url))
                if os.path.isdir(target):
                    target = os.path.join(target, 'index.html')
                if not os.path.isfile(target):
                    broken.append(
                        '%s <- %s'
                        % (os.path.relpath(target, BASE),
                           os.path.relpath(path, BASE))
                    )
    if broken:
        print('BROKEN INTERNAL REFERENCES: %d of %d' % (len(set(broken)), checked))
        for b in sorted(set(broken)):
            print(' ', b)
        return 1
    print('OK: %d internal references, none broken' % checked)
    return 0

if __name__ == '__main__':
    sys.exit(main())
