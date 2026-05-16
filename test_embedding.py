"""Quick test to find working embedding models with our API key."""
import os
from dotenv import load_dotenv
load_dotenv("functions/.env")

from google import genai

api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

# List all available models that support embedContent
print("Listing models that support embedContent...")
for model in client.models.list():
    for method in model.supported_actions:
        if "embed" in method.lower():
            print(f"  Model: {model.name}  -> supports: {method}")
            break
