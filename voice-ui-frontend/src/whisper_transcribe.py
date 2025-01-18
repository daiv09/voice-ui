import whisper

# Load the model
model = whisper.load_model("base")

# Transcribe the audio file
result = model.transcribe("path/to/audio.mp3")
print("Transcript:", result["text"])
