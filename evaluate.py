import os
import re
import json
from app.catalog import CatalogEngine
from app.agent import RecommenderAgent

def parse_trace_file(file_path: str) -> dict:
    """
    Parses a markdown trace file to extract:
    - user_turns: list of user query strings
    - expected_urls: set of expected test URLs in the final shortlist
    """
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Extract user inputs
    # They are in format:
    # **User**
    #
    # > We need a solution for senior leadership.
    user_turns = []
    user_blocks = re.findall(r"\*\*User\*\*\s*\n+\s*>\s*(.+?)(?=\n+\*\*|\n+###|\n+_\n*|$)", content, re.DOTALL)
    for block in user_blocks:
        # Clean up blockquote formatting
        lines = [line.strip().lstrip(">").strip() for line in block.strip().split("\n")]
        text = " ".join([l for l in lines if l])
        user_turns.append(text)
        
    # Split by Turn headings to locate the last turn block containing the final table
    turns = re.split(r"###\s*Turn\s*\d+", content)
    last_turn = turns[-1] if turns else content
    
    # Extract URLs in the final markdown table (the last turn's table)
    table_urls = re.findall(r"\|\s*<([^>]+)>", last_turn)
    
    # We unique them but preserve order if possible (expected URLs)
    expected_urls = []
    for url in table_urls:
        url_clean = url.strip()
        if url_clean not in expected_urls:
            expected_urls.append(url_clean)
            
    return {
        "user_turns": user_turns,
        "expected_urls": expected_urls
    }

def run_evaluation():
    print("=" * 60)
    print("SHL Conversational Recommender - Local Evaluation Suite")
    print("=" * 60)
    
    # 1. Initialize engine and agent
    catalog = CatalogEngine()
    agent = RecommenderAgent(catalog)
    
    traces_dir = "GenAI_SampleConversations"
    trace_files = sorted([f for f in os.listdir(traces_dir) if f.endswith(".md")], key=lambda x: int(re.search(r"\d+", x).group()))
    
    total_recall = 0.0
    passed_traces = 0
    total_traces = len(trace_files)
    
    # Pre-index catalog URLs for validation
    catalog_urls = {item["link"].strip().lower() for item in catalog.catalog}
    
    print(f"\nFound {total_traces} trace files for replay simulation.\n")
    
    for filename in trace_files:
        path = os.path.join(traces_dir, filename)
        trace_data = parse_trace_file(path)
        
        user_turns = trace_data["user_turns"]
        expected_urls = trace_data["expected_urls"]
        
        print(f"Replaying {filename} ({len(user_turns)} turns)...")
        print(f"  Target expected shortlist size: {len(expected_urls)}")
        
        # Simulate stateless conversation
        messages = []
        final_recs = []
        is_schema_ok = True
        schema_errors = []
        
        for turn_idx, user_text in enumerate(user_turns):
            messages.append({"role": "user", "content": user_text})
            
            # Call agent handle
            try:
                response = agent.handle(messages)
            except Exception as e:
                print(f"    [ERROR] Turn {turn_idx+1} failed: {e}")
                is_schema_ok = False
                schema_errors.append(f"Exception: {e}")
                break
                
            # Verify strict schema compliance
            if not isinstance(response, dict):
                is_schema_ok = False
                schema_errors.append("Response is not a dictionary.")
                break
                
            if "reply" not in response or "recommendations" not in response or "end_of_conversation" not in response:
                is_schema_ok = False
                schema_errors.append("Missing required keys ('reply', 'recommendations', 'end_of_conversation').")
                
            recs = response.get("recommendations", [])
            for r in recs:
                if not isinstance(r, dict) or "name" not in r or "url" not in r or "test_type" not in r:
                    is_schema_ok = False
                    schema_errors.append("Invalid recommendation item structure (must have name, url, test_type).")
                else:
                    url = r["url"].strip().lower()
                    if url not in catalog_urls:
                        is_schema_ok = False
                        schema_errors.append(f"URL not in catalog: {r['url']}")
            
            # Save the assistant response for the next stateless turn
            messages.append({"role": "assistant", "content": response.get("reply", "")})
            
            # If it is the last turn or end_of_conversation is True, capture final recommendations
            if turn_idx == len(user_turns) - 1 or response.get("end_of_conversation"):
                final_recs = recs
                
        # Calculate Recall@10 for this trace
        rec_urls = [r["url"].strip().lower() for r in final_recs]
        target_urls_lower = [u.lower() for u in expected_urls]
        
        # Recall@10 is fraction of relevant assessments in top 10
        relevant_in_top_10 = 0
        for url in rec_urls[:10]:
            if url in target_urls_lower:
                relevant_in_top_10 += 1
                
        recall = 0.0
        if len(expected_urls) > 0:
            recall = relevant_in_top_10 / len(expected_urls)
            
        total_recall += recall
        
        # Output results for this trace
        status = "PASSED" if is_schema_ok and recall >= 0.8 else "FAILED"
        if status == "PASSED":
            passed_traces += 1
            
        print(f"  Result: {status}")
        print(f"  Recall@10: {recall:.2f} ({relevant_in_top_10}/{len(expected_urls)} matched)")
        if not is_schema_ok:
            print(f"  Schema Errors: {schema_errors}")
        print("-" * 50)
        
    mean_recall = total_recall / total_traces if total_traces > 0 else 0.0
    pass_rate = (passed_traces / total_traces) * 100 if total_traces > 0 else 0.0
    
    print("\n" + "=" * 60)
    print(f"EVALUATION COMPLETE")
    print(f"Pass Rate: {pass_rate:.1f}% ({passed_traces}/{total_traces} traces)")
    print(f"Mean Recall@10: {mean_recall:.4f}")
    print("=" * 60)
    
if __name__ == "__main__":
    run_evaluation()
