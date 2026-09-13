from pydantic import BaseModel, Field
from typing import List, Optional, Literal

PhaseType = Literal[
    "introduction",
    "screening",
    "adaptation",
    "follow_up",
    "deep_dive",
    "scenario",
    "feedback",
    "closing",
]

ActionType = Literal[
    "ask_question",
    "provide_hint",
    "probe_deeper",
    "transition_phase",
    "close_interview",
]


class ObserverOutput(BaseModel):
    """Structured perception output produced by the Observer agent."""
    sentiment: str = Field(
        description="Detected emotional or psychological state (e.g. confident, nervous, hesitant, neutral, frustrated)"
    )
    hesitation_detected: bool = Field(
        description="True if the candidate exhibited significant pause (>2s), stuttering, or repeated filler phrases"
    )
    recommend_hint: bool = Field(
        description="True if the candidate appears stuck or explicitly requested assistance"
    )
    reasoning: str = Field(
        description="Short reasoning behind the observation"
    )


class InterviewerAction(BaseModel):
    """Structured decision produced by the Interviewer agent driving the 8-phase FSM."""
    action: ActionType = Field(
        description="The action to perform in this conversation turn"
    )
    question: str = Field(
        description="The verbatim question or conversational response to speak to the candidate"
    )
    next_phase: PhaseType = Field(
        description="The interview phase for the next turn"
    )
    reasoning: str = Field(
        description="Chain-of-thought rationale explaining why this action and phase were chosen"
    )


class EvaluationResult(BaseModel):
    """Structured rubric evaluation produced by the Evaluator agent upon interview completion."""
    overall_score: int = Field(
        ge=0, le=100,
        description="Overall candidate performance score on a scale of 0 to 100"
    )
    technical_score: int = Field(
        ge=0, le=100,
        description="Technical competency and domain depth score on a scale of 0 to 100"
    )
    communication_score: int = Field(
        ge=0, le=100,
        description="Clarity, structure, and communication effectiveness score on a scale of 0 to 100"
    )
    problem_solving_score: int = Field(
        ge=0, le=100,
        description="Situational judgment and analytical problem-solving score on a scale of 0 to 100"
    )
    strengths: List[str] = Field(
        description="Key strengths demonstrated by the candidate during the interview"
    )
    weaknesses: List[str] = Field(
        description="Identified knowledge gaps or areas of struggle"
    )
    recommendations: List[str] = Field(
        description="Actionable guidance and preparation advice for improvement"
    )
    confidence_score: float = Field(
        ge=0.0, le=1.0,
        description="Self-assessed confidence level in this evaluation (0.0 - 1.0). If < 0.7, triggers rubric re-evaluation"
    )
    detailed_feedback: str = Field(
        description="Comprehensive summary feedback suitable for candidate review"
    )
