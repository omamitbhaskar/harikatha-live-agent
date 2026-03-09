import os
import json
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

api_key = os.getenv("GOOGLE_API_KEY")
project_id = os.getenv("GCP_PROJECT_ID", "harikatha-live-agent")

if not api_key:
    print("❌ No API key in .env")
    exit(1)

print("🌸 Seeding Firestore with harikatha corpus...")
print(f"   Project: {project_id}")

# Load corpus file
corpus_path = Path(__file__).parent.parent / "corpus" / "segments" / "sample-001.json"

if not corpus_path.exists():
    print(f"❌ Corpus file not found: {corpus_path}")
    exit(1)

with open(corpus_path, "r", encoding="utf-8") as f:
    corpus = json.load(f)

print(f"   Source: {corpus['source']['title']}")
print(f"   Segments: {len(corpus['segments'])}")
print(f"   QA pairs: {len(corpus['qa_pairs'])}")
print()

# Generate embeddings using Gemini
from google import genai

client = genai.Client(api_key=api_key)

def get_embedding(text: str) -> list:
    """Generate embedding for text using Gemini."""
    result = client.models.embed_content(
        model="models/gemini-embedding-001",
        contents=text
    )
    return result.embeddings[0].values

# Connect to Firestore
from google.cloud import firestore
import google.auth

# Use API key approach for Firestore
os.environ["GOOGLE_CLOUD_PROJECT"] = project_id

try:
    db = firestore.Client(project=project_id)
except Exception as e:
    print(f"❌ Firestore connection failed: {e}")
    print("Make sure you are logged in: gcloud auth application-default login")
    exit(1)

# Seed segments
print("📚 Loading segments...")
source_info = corpus["source"]

for segment in corpus["segments"]:
    seg_id = segment["id"]
    
    # Build searchable text
    search_text = f"{segment['transcript']} Topics: {', '.join(segment['topics'])} Concepts: {', '.join(segment['key_concepts'])}"
    
    # Generate embedding
    print(f"   Embedding {seg_id}...", end=" ")
    try:
        embedding = get_embedding(search_text)
        print(f"✅ ({len(embedding)} dims)")
    except Exception as e:
        print(f"❌ {e}")
        continue
    
    # Store in Firestore
    doc_data = {
        "id": seg_id,
        "source_title": source_info["title"],
        "source_filename": source_info["filename"],
        "speaker": source_info["speaker"],
        "start_time": segment["start_time"],
        "end_time": segment["end_time"],
        "transcript": segment["transcript"],
        "topics": segment["topics"],
        "key_concepts": segment["key_concepts"],
        "search_text": search_text,
        "embedding": embedding,
        "language": source_info.get("language", "English"),
        "tags": source_info.get("tags", [])
    }
    
    db.collection("harikatha_segments").document(seg_id).set(doc_data)
    print(f"   ✅ Loaded {seg_id}: {segment['start_time']} - {segment['end_time']}")

# Seed QA pairs
print()
print("💬 Loading QA pairs...")

for qa in corpus["qa_pairs"]:
    qa_id = qa["id"]
    
    # Embed all natural questions together
    questions_text = " ".join(qa["natural_questions"])
    
    print(f"   Embedding {qa_id}...", end=" ")
    try:
        embedding = get_embedding(questions_text)
        print(f"✅")
    except Exception as e:
        print(f"❌ {e}")
        continue
    
    doc_data = {
        "id": qa_id,
        "natural_questions": qa["natural_questions"],
        "answer_segment": qa["answer_segment"],
        "answer_timestamp": qa["answer_timestamp"],
        "answer_summary": qa["answer_summary"],
        "embedding": embedding,
        "questions_text": questions_text
    }
    
    db.collection("harikatha_qa").document(qa_id).set(doc_data)
    print(f"   ✅ Loaded {qa_id}: {qa['natural_questions'][0][:50]}...")

print()
print("🎉 Firestore seeding complete!")
print(f"   ✅ {len(corpus['segments'])} segments loaded")
print(f"   ✅ {len(corpus['qa_pairs'])} QA pairs loaded")
print()
print("Next step: python tests/test_search.py")