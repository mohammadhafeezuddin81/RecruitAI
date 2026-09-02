import chromadb
from chromadb.utils import embedding_functions
import os
import time  # <--- REQUIRED FOR RATE LIMITING
from langchain_text_splitters import RecursiveCharacterTextSplitter
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Initialize ChromaDB (Local Vector Database)
chroma_client = chromadb.Client()

# Create a collection (like a table) for the interview context
class GeminiEmbeddingFunction(chromadb.EmbeddingFunction):
    def __call__(self, input: list[str]) -> list[list[float]]:
        model = "models/embedding-001"
        title = "Resume Embeddings"
        
        embeddings = []
        
        print(f"⚡ Generating embeddings for {len(input)} chunks...")
        
        for i, text in enumerate(input):
            try:
                # --- RATE LIMIT FIX ---
                # We sleep for 2 seconds between calls to avoid Google 429 Errors
                if i > 0: 
                    time.sleep(2.0) 
                
                response = genai.embed_content(
                    model=model, 
                    content=text, 
                    task_type="retrieval_document", 
                    title=title
                )
                embeddings.append(response['embedding'])
                print(f"   - Chunk {i+1}/{len(input)} embedded.")
                
            except Exception as e:
                print(f"⚠️ Error embedding chunk {i}: {e}")
                # Fallback: If API fails, add a dummy zero-vector so the app doesn't crash
                # (Embedding-001 has 768 dimensions)
                embeddings.append([0.0] * 768)

        return embeddings

# Initialize Collection
def get_collection():
    # Helper to get collection safely
    return chroma_client.get_or_create_collection(
        name="interview_context", 
        embedding_function=GeminiEmbeddingFunction()
    )

def ingest_text(text: str, metadata: dict):
    """
    1. Chunks the text (Split into smaller pieces).
    2. Creates Word Embeddings with Rate Limiting.
    3. Stores in Vector DB.
    """
    # Clear previous session data to prevent duplicates
    try:
        chroma_client.delete_collection("interview_context")
    except:
        pass
        
    new_collection = get_collection()
    
    # Split text intelligently
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = text_splitter.split_text(text)
    
    if not chunks:
        print("⚠️ No text to ingest.")
        return

    print(f"📂 Splitting text into {len(chunks)} chunks...")

    # Add to DB
    new_collection.add(
        documents=chunks,
        metadatas=[metadata for _ in chunks],
        ids=[f"id_{i}" for i in range(len(chunks))]
    )
    print(f"✅ RAG Engine: Successfully ingested {len(chunks)} vectors.")

def retrieve_context(query: str, n_results=2):
    """
    Semantic Search: Finds the most relevant part of the resume/JD 
    based on what the user just said.
    """
    try:
        collection = get_collection()
        
        # We assume the collection exists and has data
        if collection.count() == 0:
            return ["No context available."]

        results = collection.query(
            query_texts=[query],
            n_results=n_results
        )
        
        # Extract documents
        if results and results['documents']:
            return results['documents'][0]
        return ["No relevant context found."]
        
    except Exception as e:
        print(f"Retrieval Error: {e}")
        return ["Error retrieving context."]