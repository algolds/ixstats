#!/usr/bin/env bash
set -euxo pipefail

export NODE_OPTIONS="--max-old-space-size=6144"

time /usr/bin/time -v \
node ./node_modules/typescript/bin/tsc \
--noEmit \
-p "$1"
