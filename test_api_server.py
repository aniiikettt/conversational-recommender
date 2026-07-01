import os
import re
import json
import urllib.request

def parse_trace_file(file_path: str) -> dict:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    user_turns = []
    user_blocks = re.findall(r"\*\*User\*\*\s*\n+\s*>\s*(.+?)(?=\n+\*\*|\n+###|\n+_\n*|$)", content, re.DOTALL)
    for block in user_blocks:
        lines = [line.strip().lstrip(">").strip() for line in block.strip().split("\n")]
        text = " ".join([l for l in lines if l])
        user_turns.append(text)
        
    turns = re.split(r"###\s*Turn\s*\d+", content)
    last_turn = turns[-1] if turns else content
    table_urls = re.findall(r"\|\s*<([^>]+)>", last_turn)
    
    expected_urls = []
    for url in table_urls:
        url_clean = url.strip()
        if url_clean not in expected_urls:
            expected_urls.append(url_clean)
            
    return {
        "user_turns": user_turns,
        "expected_urls": expected_urls
    }

def run_http_evaluation():
    print("=" * 70)
    print("SHL Recommender - HTTP Endpoint Verification Suite (Port 8000)")
    print("=" * 70)
    
    traces_dir = "GenAI_SampleConversations"
    trace_files = sorted([f for f in os.listdir(traces_dir) if f.endswith(".md")], key=lambda x: int(re.search(r"\d+", x).group()))
    
    total_recall = 0.0
    passed_traces = 0
    total_traces = len(trace_files)
    
    print(f"\nFound {total_traces} trace files for HTTP replay simulation.\n")
    
    for filename in trace_files:
        path = os.path.join(traces_dir, filename)
        trace_data = parse_trace_file(path)
        
        user_turns = trace_data["user_turns"]
        expected_urls = trace_data["expected_urls"]
        
        print(f"Replaying {filename} via HTTP POST /chat...")
        
        messages = []
        final_recs = []
        is_server_ok = True
        
        for turn_idx, user_text in enumerate(user_turns):
            messages.append({"role": "user", "content": user_text})
            
            # Send HTTP POST to FastAPI
            req = urllib.request.Request(
                "http://127.0.0.1:8000/chat",
                data=json.dumps({"messages": messages}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            try:
                with urllib.request.urlopen(req) as res:
                    response = json.loads(res.read().decode("utf-8"))
            except Exception as e:
                print(f"    [HTTP ERROR] Turn {turn_idx+1} failed: {e}")
                is_server_ok = False
                break
            
            # Extract recommendations and update assistant response
            assistant_reply = response.get("reply", "")
            final_recs = response.get("recommendations", [])
            messages.append({"role": "assistant", "content": assistant_reply})
            
        if not is_server_ok:
            print(f"  Result: FAILED (Server error)\n")
            continue
            
        # Calculate Recall@10
        rec_urls = [r["url"].strip().lower() for r in final_recs]
        expected_urls_clean = [u.strip().lower() for u in expected_urls]
        
        matched_count = 0
        for exp in expected_urls_clean:
            # Check if expected URL matches any returned URL (ignore trailing slash diffs)
            exp_clean = exp.rstrip("/")
            if any(r_url.rstrip("/") == exp_clean for r_url in rec_urls):
                matched_count += 1
                
        recall = matched_count / len(expected_urls_clean) if expected_urls_clean else 1.0
        total_recall += recall
        
        if recall >= 0.8:
            passed_traces += 1
            status_str = "PASSED"
        else:
            status_str = "FAILED"
            
        print(f"  Final Shortlist Size: {len(final_recs)} | Expected: {len(expected_urls)}")
        print(f"  Recall@10: {recall:.4f} ({matched_count}/{len(expected_urls)} matched) | Status: {status_str}\n")
        
    mean_recall = total_recall / total_traces
    pass_rate = (passed_traces / total_traces) * 100
    
    print("=" * 70)
    print("HTTP VERIFICATION COMPLETE")
    print(f"Pass Rate: {pass_rate:.1f}% ({passed_traces}/{total_traces} traces)")
    print(f"Mean Recall@10: {mean_recall:.4f}")
    print("=" * 70)

if __name__ == "__main__":
    run_http_evaluation()
