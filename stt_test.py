from faster_whisper import WhisperModel

print("Loading Whisper Medium...")

model = WhisperModel(
    "medium",
    device="cpu",
    compute_type="int8"
)

print("Model loaded.")
print("Transcribing audio...")

segments, info = model.transcribe(
    "test.wav",
    language="en",
    beam_size=5
)

print("\nYou said:")
for segment in segments:
    print(segment.text)
