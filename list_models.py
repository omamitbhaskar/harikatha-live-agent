from google import genai

client = genai.Client(api_key="AQ.Ab8RN6KU3pcGyKGAKoBDkKnkjvRciCD_o1lsFhBnP208JTPinA")

for m in client.models.list():
    if "gemini" in m.name.lower():
        print(m.name)