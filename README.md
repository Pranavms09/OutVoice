# TouchCall (OutVoice)

A fully local AI voice assistant pipeline: **Whisper → Qwen → Piper**.

TouchCall listens to your voice, transcribes it locally using Faster-Whisper, processes conversational context through Qwen (via `llama.cpp`), and speaks responses back aloud with Piper TTS.

## Features

- **Local Speech-to-Text**: Fast on-device transcription with `faster-whisper`.
- **Local LLM Inference**: Fast text generation using `llama.cpp` and `Qwen/Qwen2.5-3B-Instruct-GGUF`.
- **Natural Voice Synthesis**: Offline neural text-to-speech with Piper TTS (`en_US-ryan-medium`).
- **Voice Activity Detection (VAD)**: RMS energy-based voice activity detection with automatic speech start/stop detection.
- **Multi-Turn Memory**: Maintains conversational session context while keeping responses concise and voice-friendly.

## Architecture & Flow

```
Microphone (VAD) 
      ↓
 Faster-Whisper (STT) 
      ↓
 llama.cpp / Qwen 2.5 (LLM) 
      ↓
 Piper TTS (Audio Synthesis) 
      ↓
 Speaker (aplay)
```

## Setup & Installation

### 1. Prerequisites
- Python 3.10+
- Linux audio utilities (`alsa-utils` for `aplay`, PortAudio for `pyaudio`)
- `llama.cpp` compiled locally:
  ```bash
  git clone https://github.com/ggerganov/llama.cpp
  cd llama.cpp && cmake -B build && cmake --build build --config Release
  ```

### 2. Python Dependencies
Create and activate a virtual environment, then install requirements:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Piper Voice Model
Download the Piper ONNX model and config:
- `en_US-ryan-medium.onnx`
- `en_US-ryan-medium.onnx.json`

## Usage

Run the main voice agent:
```bash
python touchcall.py
```
Press **ENTER** and start speaking. Recording stops automatically when you pause, and TouchCall will respond aloud.
