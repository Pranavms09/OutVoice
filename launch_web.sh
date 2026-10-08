#!/usr/bin/env bash
# ==============================================================================
# TOUCHCALL // SOVEREIGN LOCAL AI WEB INTERFACE LAUNCHER
# Zero Cloud · Pure Silicon
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=================================================="
echo "      TOUCHCALL // LOCAL AI INTERFACE             "
echo "         ZERO CLOUD · PURE SILICON                "
echo "=================================================="

# Check virtual environment
if [ -f ".venv/bin/python" ]; then
    PYTHON=".venv/bin/python"
else
    PYTHON="python3"
fi

PORT="${PORT:-8080}"
echo "[*] Using Python: $($PYTHON --version)"
echo "[*] Launching TouchCall Web UI on http://127.0.0.1:$PORT"
echo "[*] Press Ctrl+C to terminate."
echo ""

exec "$PYTHON" web/server.py
