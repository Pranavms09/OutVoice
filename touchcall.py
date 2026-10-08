import subprocess
import struct
import time
import wave

import numpy as np
import pyaudio

from faster_whisper import WhisperModel
from piper import PiperVoice

# ==========================================
# CONFIGURATION
# ==========================================

AUDIO_FILE = "input.wav"
OUTPUT_AUDIO = "response.wav"

WHISPER_MODEL = "medium"
PIPER_MODEL = "./en_US-ryan-medium.onnx"

LLAMA_CLI = "./llama.cpp/build/bin/llama-completion"
QWEN_MODEL = "Qwen/Qwen2.5-3B-Instruct-GGUF:Q4_K_M"

# --- VAD / Recording Parameters ---
SAMPLE_RATE = 16000               # 16 kHz mono – ideal for Whisper
CHANNELS = 1
SAMPLE_WIDTH = 2                  # 16-bit (paInt16)
CHUNK_DURATION_MS = 30            # Read audio in 30 ms chunks
CHUNK_SIZE = int(SAMPLE_RATE * CHUNK_DURATION_MS / 1000)  # 480 samples

SILENCE_THRESHOLD_RMS = 300       # RMS below this = silence (tunable)
SILENCE_DURATION = 1.0            # Seconds of continuous silence → stop
MAX_RECORD_SECONDS = 30           # Hard safety limit
NO_SPEECH_TIMEOUT = 6.0           # If no speech detected at all, give up


# ==========================================
# VAD-BASED RECORDING
# ==========================================

def record_with_vad(filename):
    """Record from the microphone and stop automatically when the user
    finishes speaking, using RMS energy-based voice activity detection.

    States:
      WAITING  – mic is open, waiting for the user to start talking.
      SPEAKING – speech detected; recording continues.
      TRAILING – speech ended; accumulating silence to confirm end.

    Returns True if speech was captured, False if the user never spoke.
    """

    pa = pyaudio.PyAudio()
    stream = pa.open(
        format=pyaudio.paInt16,
        channels=CHANNELS,
        rate=SAMPLE_RATE,
        input=True,
        frames_per_buffer=CHUNK_SIZE,
    )

    frames = []
    speech_detected = False
    silence_start = None
    recording_start = time.monotonic()

    try:
        while True:
            elapsed = time.monotonic() - recording_start

            # --- Hard safety limit ---
            if elapsed >= MAX_RECORD_SECONDS:
                print("   (max recording time reached)")
                break

            # --- Read one chunk ---
            data = stream.read(CHUNK_SIZE, exception_on_overflow=False)
            frames.append(data)

            # --- Compute RMS energy ---
            samples = np.frombuffer(data, dtype=np.int16).astype(np.float64)
            rms = np.sqrt(np.mean(samples ** 2)) if len(samples) > 0 else 0.0

            is_speech = rms >= SILENCE_THRESHOLD_RMS

            if is_speech:
                speech_detected = True
                silence_start = None          # reset silence timer
            else:
                # Silence chunk
                if speech_detected:
                    # We were speaking and now it's silent
                    if silence_start is None:
                        silence_start = time.monotonic()
                    elif time.monotonic() - silence_start >= SILENCE_DURATION:
                        # Enough continuous silence after speech → done
                        break
                else:
                    # Still waiting for user to start speaking
                    if elapsed >= NO_SPEECH_TIMEOUT:
                        print("   (no speech detected – timed out)")
                        break

    finally:
        stream.stop_stream()
        stream.close()
        pa.terminate()

    # --- Write captured audio to WAV ---
    with wave.open(filename, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(SAMPLE_WIDTH)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(b"".join(frames))

    duration = len(frames) * CHUNK_DURATION_MS / 1000.0
    print(f"   (recorded {duration:.1f}s)")

    return speech_detected


# ==========================================
# TOUCHCALL SYSTEM PROMPT
# ==========================================

SYSTEM_PROMPT = """
You are TouchCall, a friendly AI voice assistant.

Your purpose is to help the user spend more time outdoors and less time
staring at screens.

Keep responses very short, natural, friendly, and suitable for being
spoken aloud over a phone call.

Do not give long explanations.
Do not use markdown.
Do not use emojis.

Always adapt naturally when the user corrects you or specifies constraints. If the user asks for things to do at home or indoors, suggest screen-free home activities and exercises instead of pushing them to go outside.
"""

# ==========================================
# CONVERSATION MEMORY
# ==========================================

# Session-level conversational memory (resets when touchcall.py restarts)
conversation_history = []
MAX_HISTORY_MESSAGES = 10


# ==========================================
# LOAD WHISPER
# ==========================================

print("Loading Whisper Medium...")

whisper = WhisperModel(
    WHISPER_MODEL,
    device="cpu",
    compute_type="int8"
)

print("Whisper loaded.")

print("Loading Piper...")

piper_voice = PiperVoice.load(PIPER_MODEL)

print("Piper loaded.")

# ==========================================
# ASK QWEN
# ==========================================

def ask_qwen(user_text, history=None):
    global conversation_history
    if history is None:
        history = conversation_history

    # Keep conversation context reasonably small (last 6-10 messages)
    recent_history = history[-MAX_HISTORY_MESSAGES:] if len(history) > MAX_HISTORY_MESSAGES else history

    # Build prompt: 1. System prompt, 2. Previous session messages, 3. Newest user message
    prompt_parts = [f"<|im_start|>system\n{SYSTEM_PROMPT.strip()}<|im_end|>"]
    for msg in recent_history:
        role = msg.get("role", "user")
        content = msg.get("content", "").strip()
        prompt_parts.append(f"<|im_start|>{role}\n{content}<|im_end|>")
    prompt_parts.append(f"<|im_start|>user\n{user_text.strip()}<|im_end|>")
    prompt_parts.append("<|im_start|>assistant\n")

    full_prompt = "\n".join(prompt_parts)

    result = subprocess.run(
        [
            LLAMA_CLI,
            "-hf",
            QWEN_MODEL,
            "--simple-io",
            "-no-cnv",
            "-p",
            full_prompt,
            "-n",
            "120",
            "-st",
            "--no-display-prompt",
            "--no-warmup",
            "--no-perf",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    if result.returncode != 0:
        print("\nQwen error:")
        print(result.stderr)
        return "Sorry, I couldn't think of a response."

    raw = result.stdout

    # Strip the "[end of text]" marker that llama-completion appends
    response = raw.replace("[end of text]", "")

    # Remove any stray ChatML tokens that might leak through
    for tag in ("<|im_start|>", "<|im_end|>", "<|endoftext|>"):
        response = response.replace(tag, "")

    # Remove any llama.cpp interactive commands that should never appear
    cleaned_lines = []
    for line in response.splitlines():
        stripped = line.strip()
        # Skip lines that are llama.cpp CLI commands or diagnostics
        if stripped.startswith("/") and any(
            stripped.startswith(cmd)
            for cmd in ("/glob", "/help", "/load", "/exit",
                        "/read", "/image", "/audio", "/video",
                        "/regen", "/clear")
        ):
            continue
        # Skip llama.cpp statistics lines
        if stripped.startswith("llama_") or stripped.startswith("ggml_"):
            continue
        cleaned_lines.append(line)

    response = "\n".join(cleaned_lines).strip()

    if not response:
        response = "Sorry, I couldn't think of a response."

    # Update conversation history with the user's message and assistant's response
    history.append({"role": "user", "content": user_text.strip()})
    history.append({"role": "assistant", "content": response})

    # Prune history to keep within MAX_HISTORY_MESSAGES
    if len(history) > MAX_HISTORY_MESSAGES:
        del history[:-MAX_HISTORY_MESSAGES]

    return response


# ==========================================
# TEXT TO SPEECH
# ==========================================
def speak(text):

    if not text or not text.strip():
        return

    print("🔊 Speaking...")

    # Synthesize to a temporary WAV first
    tmp_audio = "response_raw.wav"
    with wave.open(tmp_audio, "wb") as wav_file:
        piper_voice.synthesize_wav(text, wav_file)

    # Read the raw Piper output
    with wave.open(tmp_audio, "rb") as src:
        sample_rate = src.getframerate()    # 22050
        n_channels = src.getnchannels()     # 1 (mono)
        sample_width = src.getsampwidth()   # 2 (16-bit)
        audio_frames = src.readframes(src.getnframes())

    # Create ~150 ms of silence (zero samples) as leading padding
    silence_seconds = 0.15
    n_silence_samples = int(sample_rate * silence_seconds) * n_channels
    silence_bytes = struct.pack(f"<{n_silence_samples}h", *([0] * n_silence_samples))

    # Write final WAV: silence + original Piper audio
    with wave.open(OUTPUT_AUDIO, "wb") as out:
        out.setnchannels(n_channels)
        out.setsampwidth(sample_width)
        out.setframerate(sample_rate)
        out.writeframes(silence_bytes + audio_frames)

    subprocess.run(
        ["aplay", OUTPUT_AUDIO],
        check=True
    )
def main():
    print("\n================================")
    print("          TOUCHCALL")
    print("================================")
    print("Local AI Voice Agent")
    print()
    print("Speak → Whisper → Qwen → Piper")
    print()
    print("Press ENTER and speak.")
    print("Press Ctrl+C to exit.")
    print("================================\n")

    try:
        while True:

            # --------------------------------------
            # WAIT FOR USER
            # --------------------------------------

            input("Press ENTER to talk...")

            # --------------------------------------
            # RECORD AUDIO (with automatic stop)
            # --------------------------------------

            print("🎙️ Listening... (speak now, recording stops when you finish)")

            speech_found = record_with_vad(AUDIO_FILE)

            if not speech_found:
                print("Didn't hear anything.\n")
                continue

            # --------------------------------------
            # SPEECH TO TEXT
            # --------------------------------------

            print("🧠 Transcribing...")

            segments, info = whisper.transcribe(
                AUDIO_FILE,
                language="en",
                beam_size=5
            )

            user_text = " ".join(
                segment.text for segment in segments
            ).strip()

            print(f"\nYou: {user_text}")

            # --------------------------------------
            # EMPTY AUDIO CHECK
            # --------------------------------------

            if not user_text:

                print("Didn't hear anything.\n")

                continue

            # --------------------------------------
            # ASK QWEN
            # --------------------------------------

            print("🤖 Thinking...")

            response = ask_qwen(user_text)

            print(f"\nTouchCall: {response}\n")

            # --------------------------------------
            # PIPER TTS
            # --------------------------------------

            speak(response)

            print()

    except KeyboardInterrupt:

        print("\n\nTouchCall stopped.")
        print("Goodbye!")


if __name__ == "__main__":
    main()
