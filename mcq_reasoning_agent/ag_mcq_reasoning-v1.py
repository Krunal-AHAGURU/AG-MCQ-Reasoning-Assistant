#!/usr/bin/env python3
"""
MCQ Processing + AI Explanation Generator

Reads a JSON file containing MCQ slides (the original "quiz_data_extractor" output),
generates concept-based explanations for every option via a chosen AI provider,
and saves the enriched JSON alongside a checkpoint file.

Usage example (Google Gemini):
    python mcq_explain.py --input input.json --provider gemini --model gemini-2.0-flash

Usage example (OpenRouter):
    python mcq_explain.py --input input.json --provider openrouter --model google/gemini-2.0-flash-001

The API key can be provided via the --api-key argument or, preferably,
by setting the environment variables GEMINI_API_KEY or OPENROUTER_API_KEY.
"""

import json
import time
import requests
import base64
import os
import argparse
from typing import Optional, Dict, Any
from dotenv import load_dotenv
load_dotenv()


# ----------------------------------------------------------------------
# 1. Helper functions (unchanged from the original script)
# ----------------------------------------------------------------------
def download_image_to_base64(url: str) -> Optional[str]:
    """Download an image and return its data URI base64 string."""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        content_type = response.headers.get('Content-Type', 'image/png')
        if 'image' not in content_type:
            content_type = 'image/png'
        b64_data = base64.b64encode(response.content).decode('utf-8')
        return f"data:{content_type};base64,{b64_data}"
    except Exception as e:
        print(f"  Failed to download {url}: {e}")
        return None


def extract_solution_content(content_array: list) -> tuple[str, list[str]]:
    """Extract text and image URLs from a solution content array."""
    text_parts = []
    image_urls = []
    for item in content_array:
        ct = item.get("content_type")
        content = item.get("content", "").strip()
        if ct in (1, 4):
            if content:
                text_parts.append(content)
        elif ct == 2:
            if content:
                image_urls.append(content)
    return "\n".join(text_parts), image_urls


def process_json_data(data: list) -> list[Dict[str, Any]]:
    """
    Convert the raw JSON (with slides) into a flat list of questions.
    Each question dict contains:
      - id, question_text, solution_text, solution_image_urls,
        solution_images_base64, correct_answer, no_of_options
    """
    results = []
    total_slides = 0
    for item in data:
        if isinstance(item, dict) and "data" in item:
            test_data = item["data"]
            slides = test_data.get("slides", [])
            for slide in slides:
                if slide.get("slide_type") != 1:
                    continue
                total_slides += 1
                slide_main = slide.get("slide_main", {})

                # Question text
                q_text_array = slide_main.get("questiontext", {}).get("content_array", [])
                question_text = "\n".join(
                    item["content"] for item in q_text_array
                    if item.get("content_type") in (1, 4) and item.get("content")
                )

                # Solution content
                sol_array = slide_main.get("solution", {}).get("content_array", [])
                solution_text, image_urls = extract_solution_content(sol_array)

                # Download images
                images_base64 = []
                for idx, url in enumerate(image_urls):
                    print(f"  Downloading image {idx+1}/{len(image_urls)} for slide ID {slide.get('id')} ...")
                    b64 = download_image_to_base64(url)
                    if b64:
                        images_base64.append(b64)

                results.append({
                    "id": slide.get("id"),
                    "question_text": question_text,
                    "solution_text": solution_text,
                    "solution_image_urls": image_urls,
                    "solution_images_base64": images_base64,
                    "correct_answer": slide_main.get("questiontext", {}).get("correct_answer"),
                    "no_of_options": slide_main.get("questiontext", {}).get("no_of_options")
                })
    print(f"\n✅ Extracted {total_slides} slides.")
    return results


# ----------------------------------------------------------------------
# 2. The exact prompt template (unchanged)
# ----------------------------------------------------------------------
BASE_PROMPT = """
You are an expert teacher with 15+ years of experience teaching students from Class 8 to JEE & NEET level across subjects.

Your teaching style:
- Clear, conceptual, and student-friendly
- Focused on WHY an option is correct or wrong
- No unnecessary theory
- Language suitable for CBSE level

I will provide you with multiple-choice questions in JSON format.

YOUR TASK:
Identify the correct option using the given "Correct Ans".
For each option (A, B, C, D), write the following in simple, student‑friendly language:
- correctFlag : true or false
- explanation : short reason based on the science concept
- why_right : if the option is incorrect, write ONE natural, friendly sentence that explains why a student might still think it’s correct. 
              Use phrases like “It’s tempting to choose this because…”, “You might feel this is right because…”, “A common mistake here is to think that…”, etc.
              Vary your wording from option to option – never use the same phrase twice.
              If the option is correct, simply say something reassuring like “Yes, this is the correct choice!” or “This is the right answer – well done!” – again, mix it up.
- core_concept : the key idea in just a few words
- next_step : one practical thing the student can do to avoid this mistake next time
Keep the tone helpful, not judgmental — like you're sitting next to them.

OUTPUT RULES:
- Output ONLY valid JSON
- Do NOT add any text outside JSON
- Do NOT change question text, options, or any existing fields
- Only populate: "Explnation ( JSON )"

STRICT OUTPUT FORMAT:
{
  "A": {
    "correctFlag": true/false,
    "explanation": "string",
    "why_right": "string",
    "core_concept": "string",
    "next_step": "string"
  },
  "B": { ... },
  "C": { ... },
  "D": { ... }
}

RULES:
- Keep all fields short, clear, and easy to understand
- Explanation must be concept-based, not just answer-based
- For wrong options: clearly highlight the mistake, still explain why students might think it's correct
- Ensure valid JSON (no trailing commas, no extra keys)

Now process the following input JSON:
"""


# ----------------------------------------------------------------------
# 3. AI Provider Handlers
# ----------------------------------------------------------------------
def call_gemini(model: str, api_key: str, prompt: str) -> str:
    """
    Call Google Gemini (latest API via google-genai package).
    Returns the response text (must be valid JSON for our use case).
    """
    # Import here so the script can be run even if google-genai is missing
    # (only required when using Gemini)
    from google import genai

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model,
        contents=prompt
    )
    return response.text.strip()


def call_openrouter(model: str, api_key: str, prompt: str) -> str:
    """
    Call OpenRouter API (standard chat completions endpoint).
    Returns the assistant's message content.
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",   # optional; can be your app URL
        "X-Title": "MCQ Explanation Generator"
    }
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,          # deterministic for structured output
        "max_tokens": 4096
    }

    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers=headers,
        json=payload,
        timeout=60
    )
    response.raise_for_status()
    data = response.json()
    # Extract text from the first choice
    return data["choices"][0]["message"]["content"].strip()


# ----------------------------------------------------------------------
# 4. Master function: choose provider based on argument
# ----------------------------------------------------------------------
def generate_explanation(provider: str, model: str, api_key: str, prompt: str) -> str:
    """
    Route the prompt to the correct provider and return the AI's text.
    Raises ValueError if provider is unknown.
    """
    provider = provider.lower()
    if provider == "gemini":
        return call_gemini(model, api_key, prompt)
    elif provider == "openrouter":
        return call_openrouter(model, api_key, prompt)
    else:
        raise ValueError(f"Unsupported provider: {provider}")


# ----------------------------------------------------------------------
# 5. Main processing logic
# ----------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Generate AI explanations for MCQ questions extracted from a JSON file."
    )
    parser.add_argument(
        "--input", required=True,
        help="Path to the input JSON file (containing slides data)."
    )
    parser.add_argument(
        "--provider", default="gemini", choices=["gemini", "openrouter"],
        help="AI provider to use (default: gemini)."
    )
    parser.add_argument(
        "--model", default=None,
        help="Model name (default depends on provider: gemini -> 'gemini-2.0-flash', "
             "openrouter -> 'google/gemini-2.0-flash-001')."
    )
    parser.add_argument(
        "--api-key", default=None,
        help="API key for the chosen provider. If not given, the script looks for "
             "GEMINI_API_KEY or OPENROUTER_API_KEY environment variables."
    )
    args = parser.parse_args()

    # -------------- Resolve API key --------------
    if args.api_key:
        api_key = args.api_key
    else:
        env_var = f"{args.provider.upper()}_API_KEY"
        api_key = os.environ.get(env_var)
        if not api_key:
            print(f"Error: No API key provided. Either set --api-key or define "
                  f"the environment variable {env_var}.")
            return

    # -------------- Resolve model name --------------
    if args.model:
        model = args.model
    else:
        # Sensible defaults
        if args.provider == "gemini":
            model = "gemini-flash-latest"          # Fast and good for JSON
        elif args.provider == "openrouter":
            model = "google/gemini-2.0-flash-001"
        else:
            model = "gemini-flash-latest"          # fallback

    # -------------- Load input JSON --------------
    input_path = args.input
    if not os.path.isfile(input_path):
        print(f"Error: File not found - {input_path}")
        return
    if os.path.getsize(input_path) == 0:
        print(f"Error: File is empty - {input_path}")
        return

    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            raw_json = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON file - {e}")
        return

    print(f"📁 Loaded input: {input_path}")
    print(f"🤖 Using provider: {args.provider}, model: {model}")

    # -------------- Extract questions --------------
    print("\n🔄 Extracting questions and downloading images...")
    questions = process_json_data(raw_json)
    if not questions:
        print("No questions found! Exiting.")
        return

    # -------------- Setup checkpoint --------------
    input_dir = os.path.dirname(os.path.abspath(input_path))
    checkpoint_file = os.path.join(input_dir, "mcq_explanations_partial.json")
    final_file = os.path.join(input_dir, "complete_mcq_with_explanations.json")

    final_output = []
    processed_ids = set()

    # Load previous progress if exists
    if os.path.exists(checkpoint_file):
        try:
            with open(checkpoint_file, 'r', encoding='utf-8') as f:
                final_output = json.load(f)
                processed_ids = {item['id'] for item in final_output}
                print(f"📌 Resuming from checkpoint. Already processed {len(processed_ids)} questions.")
        except Exception:
            print("⚠️  Could not read checkpoint file. Starting fresh.")
            final_output = []
            processed_ids = set()
    else:
        print("📌 Starting fresh. No checkpoint found.")

    # -------------- Process each question --------------
    for idx, q in enumerate(questions, start=1):
        qid = q['id']
        if qid in processed_ids:
            print(f"⏩ Skipping Q-No {qid} (already processed)")
            continue

        print(f"\n🔹 Processing Q-No {qid} ({idx}/{len(questions)})")

        # Prepare a clean dict for the AI prompt
        qn_for_prompt = {
            "id": qid,
            "question_text": q['question_text'],
            "correct_answer": q['correct_answer'],
            "no_of_options": q['no_of_options'],
            "solution_text": q.get('solution_text', '')
        }
        # Attach the first base64 image if available (Gemini can handle inline)
        if q.get('solution_images_base64') and len(q['solution_images_base64']) > 0:
            qn_for_prompt["figure_base64"] = q['solution_images_base64'][0]

        user_prompt = BASE_PROMPT + "\n" + json.dumps(qn_for_prompt, ensure_ascii=False)

        # Call the AI
        try:
            response_text = generate_explanation(args.provider, model, api_key, user_prompt)
            # The response should be a JSON object with keys A,B,C,D
            explanation = json.loads(response_text)
        except Exception as e:
            print(f"❌ Error for Q-No {qid}: {e}")
            # Save current progress before continuing
            with open(checkpoint_file, 'w', encoding='utf-8') as f:
                json.dump(final_output, f, indent=2, ensure_ascii=False)
            continue

        # Merge the AI explanation into the question dict
        q["Explnation ( JSON )"] = explanation
        final_output.append(q)
        processed_ids.add(qid)

        # Save checkpoint after every successful question
        with open(checkpoint_file, 'w', encoding='utf-8') as f:
            json.dump(final_output, f, indent=2, ensure_ascii=False)

        print(f"✅ Explanation added for Q-No {qid}")
        # Optional preview
        preview = json.dumps(explanation, indent=2, ensure_ascii=False)
        print(preview[:500] + ("..." if len(preview) > 500 else ""))

        # Be polite to the API rate limits
        time.sleep(1)

    # -------------- Final output with model info --------------
    # Add a wrapper field to record the model used
    output_payload = {
        "model_used": {
            "provider": args.provider,
            "model": model
        },
        "questions": final_output
    }

    with open(final_file, 'w', encoding='utf-8') as f:
        json.dump(output_payload, f, indent=2, ensure_ascii=False)

    print(f"\n🎉 Successfully processed {len(final_output)} questions.")
    print(f"📥 Final file saved: {final_file}")
    print(f"📥 Checkpoint file: {checkpoint_file}")


if __name__ == "__main__":
    main()