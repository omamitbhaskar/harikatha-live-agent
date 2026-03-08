"""
Harikatha Live Agent — Tracer Bullet Test
==========================================
Run this to verify your Gemini API key works.

Usage:
    pip install google-genai
    python test_gemini.py YOUR_API_KEY_HERE
"""

import sys
from google import genai

def main():
    if len(sys.argv) < 2:
        print("Usage: python test_gemini.py YOUR_API_KEY")
        print("  Example: python test_gemini.py AIzaSy...")
        sys.exit(1)

    api_key = sys.argv[1]

    # Initialize the client
    client = genai.Client(api_key=api_key)

    # Test 1: Basic text generation
    print("=" * 60)
    print("TEST 1: Basic Gemini Connection")
    print("=" * 60)

    response = client.models.generate_content(
        model="gemini-3.1-pro-preview",
        contents="In one sentence, what is Uttama Bhakti according to Rupa Goswami?"
    )
    print(f"Response: {response.text}")
    print()

    # Test 2: Test with a system instruction (this is how our agent will work)
    print("=" * 60)
    print("TEST 2: Agent-style with System Instruction")
    print("=" * 60)

    response = client.models.generate_content(
        model="gemini-3.1-pro-preview",
        config={
            "system_instruction": (
                "You are a search assistant for a harikatha corpus. "
                "When given a spiritual question, identify the key concepts "
                "and return them as a JSON object with fields: "
                "query_intent, sanskrit_terms, suggested_search_keywords. "
                "Respond ONLY with JSON, no other text."
            ),
        },
        contents="Why do I have so many problems in life?"
    )
    print(f"Response: {response.text}")
    print()

    # Test 3: List available models
    print("=" * 60)
    print("TEST 3: Available Gemini Models")
    print("=" * 60)

    for model in client.models.list():
        if "gemini" in model.name.lower() and "live" in model.name.lower():
            print(f"  LIVE MODEL: {model.name}")
        elif "gemini-3" in model.name.lower() or "gemini-2" in model.name.lower():
            print(f"  {model.name}")

    print()
    print("=" * 60)
    print("ALL TESTS PASSED — Mridanga is singing!")
    print("Your API key works. Ready to build the Live Agent.")
    print("=" * 60)


if __name__ == "__main__":
    main()
