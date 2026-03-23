#!/bin/bash
set -euo pipefail

python3 -m pip install --upgrade pip
python3 -m pip install -r backend/requirements.txt

cd frontend
npm install
NEXT_TELEMETRY_DISABLED=1 npm run build
