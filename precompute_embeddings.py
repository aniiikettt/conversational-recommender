import json
import os
import numpy as np
from sentence_transformers import SentenceTransformer

def precompute():
    print("Loading catalog...")
    catalog_path = "shl_product_catalog.json"
    if not os.path.exists(catalog_path):
        print(f"Error: Catalog not found at {catalog_path}")
        return
        
    with open(catalog_path, "r", encoding="utf-8") as f:
        catalog = json.load(f)
        
    texts = []
    for item in catalog:
        name = item.get("name", "")
        desc = item.get("description", "")
        texts.append(f"{name}. {desc}")
    
    print("Loading SentenceTransformer model...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    print("Computing embeddings...")
    embeddings = model.encode(texts, show_progress_bar=True)
    
    # Save to app directory
    os.makedirs("app", exist_ok=True)
    out_path = os.path.join("app", "catalog_embeddings.npy")
    np.save(out_path, embeddings)
    print(f"Successfully precomputed and saved embeddings to {out_path}.")

if __name__ == "__main__":
    precompute()
