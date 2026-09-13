from typing import TypedDict, List, Dict, Any, Optional


class TurnState(TypedDict, total=False):
    """LangGraph state representation passed between Observer, Interviewer, and Evaluator subgraphs."""
    session_id: Optional[str]
    user_id: Optional[str]
    transcript_so_far: List[Dict[str, Any]]
    latest_user_turn: str
    silence_duration_ms: int
    current_phase: str
    resume_context: str
    job_description: str
    sentiment: Optional[str]
    hesitation_detected: Optional[bool]
    recommend_hint: Optional[bool]
    next_action: Optional[Dict[str, Any]]
    session_complete: bool
    evaluation: Optional[Dict[str, Any]]
    rubric_context: Optional[str]
    evaluation_retry_count: Optional[int]
