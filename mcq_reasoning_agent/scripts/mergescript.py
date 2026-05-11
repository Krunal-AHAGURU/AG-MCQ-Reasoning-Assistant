import json
import argparse
from pathlib import Path

def merge_json_files(folder_path: str, output_file: str = "qns_ans_json_merge.json"):
    folder = Path(folder_path)
    
    if not folder.exists():
        print(f"❌ Error: Folder not found: {folder_path}")
        return False
    
    json_files = list(folder.glob("*.json"))
    
    if not json_files:
        print(f"❌ No JSON files found in {folder_path}")
        return False
    
    # Display found files
    print(f"\n📁 Found {len(json_files)} JSON file(s) in '{folder_path}':")
    for i, f in enumerate(json_files, 1):
        print(f"   {i}. {f.name}")
    
    # Ask for confirmation
    print(f"\n📄 Output will be saved as: {output_file}")
    confirm = input("\nDo you want to proceed with merging? (yes/no): ").strip().lower()
    
    if confirm not in ['yes', 'y']:
        print("❌ Merge cancelled.")
        return False
    
    # Dictionary to store merged data per question ID
    questions_map = {}
    
    for file_path in json_files:
        print(f"   Processing: {file_path.name}")
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            print(f"   ⚠️  Error reading {file_path.name}: {e}")
            continue
        
        for question in data:
            qid = question.get("id")
            if qid is None:
                continue
            
            if qid not in questions_map:
                # First occurrence: copy entire question structure
                questions_map[qid] = question.copy()
                # Ensure explanations field exists
                if "explanations" not in questions_map[qid]:
                    questions_map[qid]["explanations"] = {}
            else:
                # Merge explanations from subsequent occurrences
                existing_expl = questions_map[qid].get("explanations", {})
                new_expl = question.get("explanations", {})
                # Avoid duplicates: new_expl overwrites existing keys if any
                existing_expl.update(new_expl)
                questions_map[qid]["explanations"] = existing_expl
    
    # Convert to list and sort by ID
    merged_list = sorted(questions_map.values(), key=lambda x: x.get("id", 0))
    
    # Write output
    output_path = folder / output_file
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(merged_list, f, indent=2, ensure_ascii=False)
        print(f"\n✅ Success! Merged {len(json_files)} files → {output_path}")
        print(f"   Total questions in merged file: {len(merged_list)}")
        return True
    except Exception as e:
        print(f"❌ Error writing output file: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Merge JSON files containing question-answer data with explanations from multiple models.")
    parser.add_argument("folder_path", help="Path to the folder containing JSON files to merge")
    parser.add_argument("-o", "--output", default="qns_ans_json_merge.json", 
                        help="Output filename (default: qns_ans_json_merge.json)")
    
    args = parser.parse_args()
    merge_json_files(args.folder_path, args.output)