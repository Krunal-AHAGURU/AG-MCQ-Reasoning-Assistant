import json
import requests
import base64
import argparse
import os

def download_image_to_base64(url):
    """
    Download an image from a URL and return its base64 string with data URI prefix.
    Returns None if download or conversion fails.
    """
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        content_type = response.headers.get('Content-Type', 'image/png')
        # If content_type is not specific, assume png
        if 'image' not in content_type:
            content_type = 'image/png'
        b64_data = base64.b64encode(response.content).decode('utf-8')
        return f"data:{content_type};base64,{b64_data}"
    except Exception as e:
        print(f"  Failed to download image from {url}: {e}")
        return None

def extract_solution_content(content_array):
    """
    Process solution content_array.
    Returns:
        solution_text (str): concatenated text from content_type 1 or 4.
        image_urls (list): URLs of images (content_type 2).
    """
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

def process_json_data(data):
    """Process loaded JSON and return structured list with base64 images."""
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

                # Download images and convert to base64
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
    print(f"\nProcessed {total_slides} slides.")
    return results

def main():
    parser = argparse.ArgumentParser(description="Extract Q&A with base64 images from a JSON file.")
    parser.add_argument("input_file", help="Path to the input JSON (or txt) file")
    args = parser.parse_args()

    input_path = args.input_file

    # Read input file
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
    except FileNotFoundError:
        print(f"Error: File not found - {input_path}")
        return
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in file - {e}")
        return

    print(f"\nLoaded data from: {input_path}")
    print("\nStarting extraction and image download (this may take a while)...")
    structured_output = process_json_data(json_data)

    # Preview first item
    if structured_output:
        print("\n" + "="*60)
        print("PREVIEW OF FIRST ITEM:")
        print("="*60)
        first = structured_output[0]
        print(f"ID: {first['id']}")
        print(f"Correct Answer: {first['correct_answer']}")
        print(f"Number of Options: {first['no_of_options']}")
        print(f"\nQuestion Text (first 300 chars):\n{first['question_text'][:300]}...")
        print(f"\nSolution Text (first 200 chars):\n{first['solution_text'][:200]}...")
        print(f"\nImage URLs found: {len(first['solution_image_urls'])}")
        print(f"Base64 images obtained: {len(first['solution_images_base64'])}")
        if first['solution_images_base64']:
            print("  (First base64 string length:", len(first['solution_images_base64'][0]), ")")
        print("="*60)

    # Determine output path (same directory as input file)
    input_dir = os.path.dirname(os.path.abspath(input_path))
    output_filename = "structured_qa_with_base64.json"
    output_path = os.path.join(input_dir, output_filename)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(structured_output, f, indent=2, ensure_ascii=False)

    print(f"\nOutput saved to: {output_path}")
    print("✅ Done! The JSON file with base64 images has been saved.")

if __name__ == "__main__":
    main()