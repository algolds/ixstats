#!/usr/bin/env python3
import sys
import re
from collections import Counter, defaultdict

if len(sys.argv) < 2:
    print("Usage: parse_tsc_log.py <logfile>")
    sys.exit(2)

path_re = re.compile(r"^([\S]+?\.(?:ts|tsx))(?:(?:\(|:))")
errcode_re = re.compile(r"error TS(\d+)")

counts = Counter()
codes = Counter()
per_file_codes = defaultdict(Counter)

with open(sys.argv[1], 'r', errors='ignore') as f:
    for line in f:
        if 'error TS' in line:
            m = path_re.search(line)
            if m:
                p = m.group(1)
                counts[p] += 1
                c = errcode_re.search(line)
                if c:
                    codes[c.group(1)] += 1
                    per_file_codes[p][c.group(1)] += 1

print('# Top files by error count')
for i,(p,n) in enumerate(counts.most_common(30), start=1):
    top_codes = ', '.join(f"TS{code}({cnt})" for code,cnt in per_file_codes[p].most_common(5))
    print(f"{i:2d}. {p}: {n} errors — top codes: {top_codes}")

print('\n# Top TS error codes')
for code, n in codes.most_common(20):
    print(f"TS{code}: {n}")

print('\n# Summary')
print(f"Unique files with errors: {len(counts)}")
print(f"Total parsed error lines: {sum(counts.values())}")

