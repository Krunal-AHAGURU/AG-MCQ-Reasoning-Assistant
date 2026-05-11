#!/usr/bin/env python3
"""
MCQ Explanation Generator – append per‑provider explanations

Reads a flat JSON list of MCQ questions (the new format) and generates
concept‑based explanations for every option via a chosen AI provider.
The explanation is stored under a key “{provider}_{model}” (with slashes
replaced by hyphens) inside a new “explanations” field of each question.

You can run the script many times with different providers/models to
accumulate explanations side by side.

Usage example (Google Gemini):
    python mcq_explain.py --input questions.json --provider gemini --model gemini-flash-latest --api-key YOUR_KEY

Usage example (OpenRouter):
    python mcq_explain.py --input questions.json --provider openrouter --model google/gemini-2.0-flash-001 --api-key YOUR_KEY

The API key can also be set via environment variables GEMINI_API_KEY or OPENROUTER_API_KEY.
"""

import argparse, base64, json, os, sys, time
from typing import Optional, Dict, Any
from dotenv import load_dotenv
load_dotenv()


# --------------------------------------------------------------------
# 1. Helper: download image (not needed anymore, kept for reference)
# --------------------------------------------------------------------
def download_image_to_base64(url: str) -> Optional[str]:
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        ct = r.headers.get('Content-Type', 'image/png')
        if 'image' not in ct:
            ct = 'image/png'
        return f"data:{ct};base64,{base64.b64encode(r.content).decode()}"
    except Exception as e:
        print(f"  [!] Failed to download {url}: {e}")
        return None


# --------------------------------------------------------------------
# 2. Prompt template (unchanged)
# --------------------------------------------------------------------
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


# --------------------------------------------------------------------
# 3. AI Provider Handlers
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
        "X-Title": "MCQ Explanation Generator"
    }
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 4096
    }
    r = requests.post("https://openrouter.ai/api/v1/chat/completions",
                      headers=headers, json=payload, timeout=60)
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
# 4. Main processing
# --------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Add AI MCQ explanations to a flat JSON file.")
    parser.add_argument("--input", required=True, help="Path to the input JSON file (list of questions).")
    parser.add_argument("--provider", default="gemini", choices=["gemini", "openrouter"])
    parser.add_argument("--model", default=None)
    parser.add_argument("--api-key", default=None)
    parser.add_argument("--output", default=None,
                        help="Output JSON file (default: <input>_with_explanations.json)")
    args = parser.parse_args()

    # Resolve API key
    if args.api_key:
        api_key = args.api_key
    else:
        env_var = f"{args.provider.upper()}_API_KEY"
        api_key = os.environ.get(env_var)
        if not api_key:
            print(f"Error: No API key. Provide --api-key or set {env_var}.")
            return

    # Resolve model
    if args.model:
        model = args.model
    else:
        if args.provider == "gemini":
            model = "gemini-flash-latest"
        elif args.provider == "openrouter":
            model = "google/gemini-2.0-flash-001"
        else:
            model = "gemini-flash-latest"

    input_path = args.input
    if not os.path.isfile(input_path):
        print(f"Error: Input file not found: {input_path}")
        return
    if os.path.getsize(input_path) == 0:
        print(f"Error: File is empty: {input_path}")
        return

    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            questions = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON file - {e}")
        return

    if not isinstance(questions, list):
        print("Error: Input JSON must be a list of question objects.")
        return

    output_path = args.output or os.path.splitext(input_path)[0] + "_with_explanations.json"
    print(f"📁 Loaded {len(questions)} questions from {input_path}")
    print(f"🤖 Provider: {args.provider}, Model: {model}")
    print(f"📤 Output will be written to {output_path}")

    # Build the explanation key (replace slashes for filesystem safety)
    exp_key = f"{args.provider}_{model.replace('/', '-')}"

    # Load existing output if exists (allow incremental addition)
    if os.path.exists(output_path):
        try:
            with open(output_path, 'r', encoding='utf-8') as f:
                current = json.load(f)
            if not isinstance(current, list):
                print("Warning: Existing output is not a list. Starting fresh.")
                current = []
        except:
            print("Warning: Could not read existing output. Starting fresh.")
            current = []
    else:
        current = []

    # Create a lookup by id for existing questions
    existing_map = {q['id']: q for q in current}
    # Merge input questions into existing map (preserving any explanations already there)
    for q_in in questions:
        qid = q_in['id']
        if qid not in existing_map:
            existing_map[qid] = q_in.copy()
            existing_map[qid].setdefault('explanations', {})
        else:
            # Update fields from input if needed (preserving explanations)
            existing = existing_map[qid]
            for key in q_in:
                if key != 'explanations':
                    existing[key] = q_in[key]
            existing.setdefault('explanations', {})

    # Process each question: if explanation missing for current provider/model, generate it
    updated_list = []
    for qid, q in existing_map.items():
        explanations = q.setdefault('explanations', {})
        if exp_key in explanations:
            print(f"⏩ Skipping Q-No {qid} (already has explanation for {exp_key})")
            updated_list.append(q)
            continue

        print(f"\n🔹 Processing Q-No {qid}")

        # Build prompt for AI – include first solution image if available as base64
        prompt_data = {
            "id": qid,
            "question_text": q['question_text'],
            "correct_answer": q['correct_answer'],
            "no_of_options": q['no_of_options'],
            "solution_text": q.get('solution_text', '')
        }
        if q.get('solution_images_base64') and len(q['solution_images_base64']) > 0:
            prompt_data["figure_base64"] = q['solution_images_base64'][0]

        user_prompt = BASE_PROMPT + "\n" + json.dumps(prompt_data, ensure_ascii=False)

        try:
            resp = generate_explanation(args.provider, model, api_key, user_prompt)
            explanation = json.loads(resp)
        except Exception as e:
            print(f"❌ Failed for Q-No {qid}: {e}")
            # Save progress up to this point before continuing
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(updated_list, f, indent=2, ensure_ascii=False)
            continue

        # Store explanation
        explanations[exp_key] = explanation
        updated_list.append(q)
        print(f"✅ Added explanation for Q-No {qid}")

        # Preview a snippet
        preview = json.dumps(explanation, indent=2, ensure_ascii=False)
        print(preview[:500] + ("..." if len(preview) > 500 else ""))

        # Save progress after each question
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(updated_list, f, indent=2, ensure_ascii=False)
        time.sleep(1)

    print(f"\n🎉 Done. {len(updated_list)} questions processed.")
    print(f"📥 Final output saved to {output_path}")


if __name__ == "__main__":
    main()