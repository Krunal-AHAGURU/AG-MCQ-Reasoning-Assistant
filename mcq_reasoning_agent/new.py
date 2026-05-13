#!/usr/bin/env python3
"""
MCQ Explanation Generator – versioned output

Reads a flat JSON list of MCQ questions and generates concept‑based
explanations for every option via a chosen AI provider.
The explanation is stored under a key “{provider}_{model}” (with slashes
replaced by hyphens) inside an “explanations” field of each question.

By default, the output filename includes the provider, model, and a timestamp.
This ensures every run produces a new file – perfect for tracking different
models or runs separately.

Usage example (Google Gemini):
    python mcq_explain.py --input questions.json --provider gemini --model gemini-flash-latest --api-key YOUR_KEY

Usage example (OpenRouter):
    python mcq_explain.py --input questions.json --provider openrouter --model google/gemini-2.0-flash-001 --api-key YOUR_KEY

You can set API keys via environment variables: GEMINI_API_KEY or OPENROUTER_API_KEY.
"""

import argparse
import base64
import json
import os
import sys
import time
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


# --------------------------------------------------------------------
# Helper: safe filename from model name (replace problematic chars)
# --------------------------------------------------------------------
def sanitize_model_name(model: str) -> str:
    """Replace slashes with hyphens and spaces with underscores."""
    safe = model.replace('/', '-').replace(' ', '_')
    # Remove any other potentially unsafe characters (keep alnum, dot, hyphen, underscore)
    safe = ''.join(c for c in safe if c.isalnum() or c in '.-_')
    return safe


def versioned_output_path(input_path: str, provider: str, model: str) -> str:
    """
    Generate a unique output filename:
    <input_basename>_<provider>_<sanitized_model>_YYYYMMDD_HHMMSS.json
    """
    base_name = os.path.splitext(os.path.basename(input_path))[0]
    safe_model = sanitize_model_name(model)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = os.path.dirname(input_path) or '.'
    output_filename = f"{base_name}_{provider}_{safe_model}_{timestamp}.json"
    return os.path.join(output_dir, output_filename)


# --------------------------------------------------------------------
# Prompt template (unchanged – your current BASE_PROMPT)
# --------------------------------------------------------------------
BASE_PROMPT = """
You are an expert teacher with 15+ years of experience teaching students from Class 8 to JEE & NEET level across subjects.

Your teaching style:
- Clear, conceptual, and student-friendly
- Focused on WHY an option is correct or wrong
- Focused on common student misconceptions
- No unnecessary theory
- Language suitable for CBSE level
- Tone should feel supportive, encouraging, and natural — like a teacher sitting next to the student

I will provide you with multiple-choice questions in JSON format.

YOUR TASK:
Identify the correct option using the given "Correct Ans".

For each option (A, B, C, D), write the following in simple, student-friendly language:
- correctFlag : true or false
- explanation : short reason based on the science concept

- why_right :
  If the option is incorrect, write ONE natural, friendly sentence explaining why a student might still feel this option is correct.

  Use tones like:
  - “It’s tempting to choose this because…”
  - “You might feel this is right because…”
  - “A common mistake here is to think that…”
  - “This option looks correct at first because…”
  - “It may seem correct because…”
  - “I guess you thought this because…”
  - “You probably connected this with…”
  - “This feels logical at first because…”

  IMPORTANT:
  - Make it sound personal and relatable to the student
  - Do NOT sound robotic or judgmental
  - Do NOT directly say “student thinks”
  - Make it feel like a teacher gently understanding the student's thinking

  If the option is correct, use encouraging tones like:
  - “Yes, this is the correct choice!”
  - “Great job — this matches the concept correctly.”
  - “That’s right! You understood the idea well.”
  - “Correct — this follows the actual concept.”

- misconception :
  Write the misconception in a natural student-friendly way.

  GOOD examples:
  - “You may be assuming force depends only on charge size.”
  - “Looks like distance effect was missed here.”
  - “You probably mixed up speed and acceleration.”
  - “This usually happens when current and voltage get confused.”
  - “You may be thinking heavier objects fall faster.”

  BAD examples:
  - “Student thinks electric field depends only on charge.”
  - “Student is confused.”
  - “Wrong understanding.”

  IMPORTANT:
  - Keep it short
  - Keep it human-like
  - Make it feel understandable to the student
  - Avoid formal psychology-style wording

  If the option is correct, set misconception as null.

- core_concept : the key idea in just a few words

- next_step :
  One small practical thing the student can do next time to avoid this mistake.

  Examples:
  - “Check how distance affects the formula.”
  - “Focus on unit differences carefully.”
  - “Compare force and energy definitions once.”
  - “Revise the direction rules for electric field.”

Keep the tone helpful, supportive, and encouraging.

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
    "misconception": "string or null",
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
- Every wrong option MUST contain a meaningful misconception
- Misconceptions should feel natural and relatable
- Avoid robotic phrases like “student thinks”
- Keep wording varied and human-like
- Ensure valid JSON (no trailing commas, no extra keys)

Now process the following input JSON:
"""


# --------------------------------------------------------------------
# AI Provider Handlers
# --------------------------------------------------------------------
def call_gemini(model: str, api_key: str, prompt: str) -> str:
    from google import genai

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(model=model, contents=prompt)
    return response.text.strip()


def call_openrouter(model: str, api_key: str, prompt: str) -> str:
    import requests

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",
        "X-Title": "MCQ Explanation Generator",
    }
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 4096,
    }
    r = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers=headers,
        json=payload,
        timeout=60,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"].strip()


def generate_explanation(provider: str, model: str, api_key: str, prompt: str) -> str:
    provider = provider.lower()
    if provider == "gemini":
        return call_gemini(model, api_key, prompt)
    elif provider == "openrouter":
        return call_openrouter(model, api_key, prompt)
    else:
        raise ValueError(f"Unsupported provider: {provider}")


# --------------------------------------------------------------------
# Main processing
# --------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Add AI MCQ explanations to a flat JSON file – always creates a new, versioned output file."
    )
    parser.add_argument("--input", required=True, help="Path to the input JSON file (list of questions).")
    parser.add_argument("--provider", default="gemini", choices=["gemini", "openrouter"])
    parser.add_argument("--model", default=None, help="Model name (auto-selected if not provided).")
    parser.add_argument("--api-key", default=None, help="API key (or set env var GEMINI_API_KEY / OPENROUTER_API_KEY).")
    parser.add_argument(
        "--output",
        default=None,
        help="Custom output path (if given, no automatic versioning is added).",
    )
    args = parser.parse_args()

    # ---------- API key ----------
    if args.api_key:
        api_key = args.api_key
    else:
        env_var = f"{args.provider.upper()}_API_KEY"
        api_key = os.environ.get(env_var)
        if not api_key:
            print(f"Error: No API key. Provide --api-key or set {env_var}.")
            return

    # ---------- Model resolution ----------
    if args.model:
        model = args.model
    else:
        if args.provider == "gemini":
            model = "gemini-flash-latest"
        elif args.provider == "openrouter":
            model = "google/gemini-2.0-flash-001"
        else:
            model = "gemini-flash-latest"

    # ---------- Input validation ----------
    input_path = args.input
    if not os.path.isfile(input_path):
        print(f"Error: Input file not found: {input_path}")
        return
    if os.path.getsize(input_path) == 0:
        print(f"Error: Input file is empty: {input_path}")
        return

    try:
        with open(input_path, "r", encoding="utf-8") as f:
            questions = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON file - {e}")
        return

    if not isinstance(questions, list):
        print("Error: Input JSON must be a list of question objects.")
        return

    # ---------- Output path ----------
    if args.output:
        output_path = args.output
        print(f"📝 Using user-specified output: {output_path}")
    else:
        output_path = versioned_output_path(input_path, args.provider, model)
        print(f"🔖 Versioned output (timestamp + model): {output_path}")

    # ---------- Prepare data ----------
    # Make a deep copy of input questions – each run is independent.
    # Each question gets an empty 'explanations' dict if not present.
    output_data = []
    for q in questions:
        q_copy = q.copy()
        if "explanations" not in q_copy:
            q_copy["explanations"] = {}
        output_data.append(q_copy)

    exp_key = f"{args.provider}_{model.replace('/', '-')}"

    print(f"📁 Loaded {len(questions)} questions from {input_path}")
    print(f"🤖 Provider: {args.provider}, Model: {model}")
    print(f"📤 Output will be written to {output_path}")
    print(f"🏷️  Explanation key: {exp_key}")

    # ---------- Process each question ----------
    processed_count = 0
    for idx, q in enumerate(output_data):
        qid = q.get("id", idx)  # fallback to index if no id
        explanations = q["explanations"]

        # Skip if this provider/model already has an explanation (unlikely in fresh run)
        if exp_key in explanations:
            print(f"⏩ Skipping Q-No {qid} (already has explanation for {exp_key})")
            continue

        print(f"\n🔹 Processing Q-No {qid}")

        # Build prompt data (include base64 image if available)
        prompt_data = {
            "id": qid,
            "question_text": q.get("question_text", ""),
            "correct_answer": q.get("correct_answer", ""),
            "no_of_options": q.get("no_of_options", 4),
            "solution_text": q.get("solution_text", ""),
        }
        if q.get("solution_images_base64") and len(q["solution_images_base64"]) > 0:
            prompt_data["figure_base64"] = q["solution_images_base64"][0]

        user_prompt = BASE_PROMPT + "\n" + json.dumps(prompt_data, ensure_ascii=False)

        try:
            resp = generate_explanation(args.provider, model, api_key, user_prompt)
            explanation = json.loads(resp)
        except Exception as e:
            print(f"❌ Failed for Q-No {qid}: {e}")
            # Save what we have so far, then continue to next question
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            continue

        # Store the explanation
        explanations[exp_key] = explanation
        processed_count += 1
        print(f"✅ Added explanation for Q-No {qid}")

        # Preview snippet
        preview = json.dumps(explanation, indent=2, ensure_ascii=False)
        print(preview[:500] + ("..." if len(preview) > 500 else ""))

        # Save after each question (incremental save)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)

        time.sleep(1)  # Polite delay

    print(f"\n🎉 Done. Processed {processed_count} out of {len(questions)} questions.")
    print(f"📥 Final output saved to {output_path}")


if __name__ == "__main__":
    main()