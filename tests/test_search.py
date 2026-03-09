import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, str(Path(__file__).parent.parent))

api_key = os.getenv("GOOGLE_API_KEY")
project_id = os.getenv("GCP_PROJECT_ID", "harikatha-live-agent")

if not api_key:
    print("❌ No API key in .env")
    exit(1)

from google import genai
from google.cloud import firestore
import numpy as np

client = genai.Client(api_key=api_key)
db = firestore.Client(project=project_id)

def get_embedding(text: str) -> list:
    result = client.models.embed_content(
        model="models/gemini-embedding-001",
        contents=text
    )
    return result.embeddings[0].values

def cosine_similarity(a, b):
    a, b = np.array(a), np.array(b)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def search(query: str, top_k: int = 3):
    print(f"\n🔍 Query: \"{query}\"")
    
    # Get query embedding
    query_embedding = get_embedding(query)
    
    # Search QA pairs first
    qa_docs = db.collection("harikatha_qa").stream()
    
    results = []
    for doc in qa_docs:
        data = doc.to_dict()
        score = cosine_similarity(query_embedding, data["embedding"])
        results.append({
            "qa_id": data["id"],
            "segment_id": data["answer_segment"],
            "timestamp": data["answer_timestamp"],
            "summary": data["answer_summary"],
            "question": data["natural_questions"][0],
            "score": float(score)
        })
    
    results.sort(key=lambda x: x["score"], reverse=True)
    top = results[:top_k]
    
    # Get segment details for top result
    best = top[0]
    seg_doc = db.collection("harikatha_segments").document(best["segment_id"]).get()
    
    if seg_doc.exists:
        seg = seg_doc.to_dict()
        print(f"✅ Match found: {best['segment_id']}")
        print(f"   File:      {seg['source_filename']}")
        print(f"   Time:      {seg['start_time']} - {seg['end_time']}")
        print(f"   Score:     {best['score']:.2f}")
        print(f"   Summary:   {best['summary']}")
        print(f"   Transcript: {seg['transcript'][:100]}...")
    
    return top

# Test queries
test_queries = [
    "Why do I have so many problems in life?",
    "What is saranagati?",
    "How can I chant like Haridas Thakur?",
    "Who is responsible for my suffering?",
    "What is the solution in Kali Yuga?"
]

print("=" * 60)
print("🌸 Harikatha Search Engine Test")
print("=" * 60)

for query in test_queries:
    search(query)
    print()

print("=" * 60)
print("✅ Search test complete")