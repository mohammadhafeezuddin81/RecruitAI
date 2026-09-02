import firebase_admin
from firebase_admin import credentials, firestore
import os
from datetime import datetime

# Initialize Firebase
if not firebase_admin._apps:
    cred_path = "serviceAccountKey.json"
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        print("🔥 Connected to Firestore")
    else:
        print("⚠️ Service Key missing!")

try:
    db = firestore.client()
except:
    db = None

# --- 1. SAVE SESSION (UPDATED: Stores Full Transcript) ---
def save_session(user_id, transcript, feedback, job_role):
    if not db or not user_id: return
    
    session_data = {
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "role": job_role,
        "overall_score": feedback.get("overall_score", 0),
        "scores": {
            "technical": feedback.get("technical", {}).get("score", 0),
            "communication": feedback.get("communication", {}).get("score", 0),
            "resume": feedback.get("resume_fit", {}).get("score", 0),
            "presentation": feedback.get("presentation", {}).get("score", 0),
        },
        "feedback_text": feedback,  # Stores the full report text
        "transcript": transcript,   # <--- NEW: Stores the conversation dialogues
        "timestamp": firestore.SERVER_TIMESTAMP
    }
    
    db.collection("users").document(user_id).collection("sessions").add(session_data)
    print(f"✅ Full Session (Transcript + Feedback) saved for {user_id}")

# --- 2. UPDATE PROFILE ---
def update_profile(user_id, profile_data):
    if not db or not user_id: return
    clean_data = {k: v for k, v in profile_data.items() if v}
    db.collection("users").document(user_id).set(clean_data, merge=True)

# --- 3. GET ANALYTICS ---
def get_analytics(user_id):
    if not db or not user_id: return None

    sessions_ref = db.collection("users").document(user_id).collection("sessions")
    docs = sessions_ref.order_by("timestamp", direction=firestore.Query.DESCENDING).limit(10).stream()
    
    sessions = []
    all_improvements = []
    total_score = 0
    
    for doc in docs:
        data = doc.to_dict()
        if "timestamp" in data: del data["timestamp"]
        sessions.append(data)
        total_score += data.get("overall_score", 0)
        
        fb = data.get("feedback_text", {})
        if "improvements" in fb: all_improvements.extend(fb["improvements"])

    if not sessions:
        return {"status": "empty"}

    avg_score = total_score / len(sessions)

    return {
        "total_interviews": len(sessions),
        "average_score": round(avg_score, 1),
        "history": sessions,
        "recent_improvements": list(set(all_improvements[:5]))
    }