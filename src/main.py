from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(
    title="Harikatha Live Agent",
    description="As It Is — Real Voice, Real Wisdom, Real-Time",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "project": "Harikatha Live Agent",
        "status": "running",
        "message": "As It Is — Real Voice, Real Wisdom, Real-Time",
        "track": "Gemini Live Agent Challenge 2026"
    }

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/search")
def search_stub(q: str = "uttama bhakti"):
    return {
        "query": q,
        "status": "search engine coming soon",
        "corpus": "Srila Bhaktivedanta Narayana Goswami Maharaja"
    }