# TouchCall (OutVoice)

A private voice assistant that runs entirely on your own Linux machine: **Whisper → Qwen 2.5 → Piper**.

TouchCall listens to you, transcribes speech with Faster-Whisper, reasons with Qwen 2.5 3B through `llama.cpp`, and answers out loud with Piper TTS. After the models are downloaded once, nothing leaves your computer: no cloud API, no account, no telemetry.

## Features

- **Web app** (`./launch_web.sh` → http://127.0.0.1:8080) with three views:
  - **Overview**: landing page with live CPU/RAM and model status.
  - **Terminal**: streaming chat with Qwen. Stop generation mid-reply, copy or read any answer aloud with Piper, dictate with the mic (Whisper), see tokens/s and time-to-first-token.
  - **Voice Call**: hands-free conversation. Browser voice-activity detection ends your turn when you pause, then TouchCall transcribes, replies and speaks, and listens again. Push-to-talk mode, mute, barge-in (tap to interrupt), mic sensitivity and a live transcript. Call turns also appear in the Terminal history.
- **Settings panel** (gear icon): persona presets, custom system prompt, temperature / max tokens / top-p.
- **CLI agent** (`python touchcall.py`) for a terminal-only voice loop.
- **Offline by design**: speech-to-text, LLM and text-to-speech all run locally on CPU. No GPU required.

## How it works

```
Browser mic ──► /api/transcribe ──► Faster-Whisper (small)
                                          │ text
                                          ▼
                /api/chat (SSE) ──► llama-server :8088 ── Qwen 2.5 3B Instruct (GGUF Q4_K_M)
                                          │ reply
                                          ▼
Browser audio ◄── /api/synthesize ◄── Piper (en_US-ryan-medium)
```

The FastAPI server (`web/server.py`) starts `llama-server` automatically and serves the UI from `web/static/`.

| Endpoint | Purpose |
|---|---|
| `GET /api/telemetry` | Model, llama-server status, Whisper/Piper readiness, CPU and RAM |
| `POST /api/chat` | Chat completion; `stream: true` returns server-sent events |
| `POST /api/transcribe` | Upload audio (webm/ogg/wav) and get text from Whisper |
| `POST /api/synthesize` | Text in, WAV audio out from Piper |

## Requirements

- Linux, Python 3.10+
- ~8 GB RAM recommended
- Build tools for `llama.cpp` (`cmake`, a C/C++ compiler)
- For the CLI agent only: `alsa-utils` (`aplay`) and PortAudio (`sudo apt install portaudio19-dev` before installing `pyaudio`)
- A modern browser (Chrome, Edge or Firefox) for the web app's microphone features

## Setup

### 1. Clone and install Python packages

```bash
git clone https://github.com/Pranavms09/OutVoice.git
cd OutVoice
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Build llama.cpp inside the project

```bash
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp && cmake -B build && cmake --build build --config Release -j
cd ..
```

This produces `llama.cpp/build/bin/llama-server` (used by the web app) and `llama-completion` (used by the CLI).

### 3. Download the Piper voice

Put both files in the project root:

```bash
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx.json
```

### 4. First run (needs internet once)

```bash
./launch_web.sh
```

On the first start, `llama-server` downloads Qwen 2.5 3B (about 2 GB) and Faster-Whisper downloads its `small` model the first time you use the mic. Both are cached in `~/.cache/huggingface`. Every run after that works fully offline.

Open **http://127.0.0.1:8080**. To use a different port: `PORT=9000 ./launch_web.sh`.

## Usage

**Web app:** pick **Terminal** to chat or **Voice Call** to talk. Allow microphone access when the browser asks. Links can open a view directly: `/#chat`, `/#voice`, `/#landing`.

**CLI agent:**

```bash
python touchcall.py
```

Press **Enter** and speak. Recording stops when you pause, and TouchCall answers aloud. The CLI uses Whisper `medium` for higher accuracy.

## Project layout

```
touchcall.py          CLI voice agent (mic → Whisper → Qwen → Piper → aplay)
launch_web.sh         Starts the web app
web/server.py         FastAPI backend, llama-server lifecycle, API endpoints
web/static/           Web UI (index.html, style.css, app.js, brand assets)
llama.cpp/            Local llama.cpp build (not committed)
en_US-ryan-medium.*   Piper voice files (not committed)
```

## Troubleshooting

- **"Could not reach the local model"**: llama-server is still loading or failed to start. Check the terminal running `./launch_web.sh` and confirm `llama.cpp/build/bin/llama-server` exists.
- **No voice output**: make sure both Piper files are in the project root; the Overview shows Piper status.
- **Mic not working**: the browser only allows the microphone on `localhost`/`127.0.0.1` or HTTPS. Use `http://127.0.0.1:8080`, not your LAN IP.
- **Voice Call ends turns too early or never**: adjust **Mic sensitivity** on the Voice Call screen, or switch to **Push-to-talk**.
