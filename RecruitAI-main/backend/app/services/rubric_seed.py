"""
Rubric Seeding Module for RecruitAI.
Populates standard evaluation rubrics into the pgvector vectorstore
so the Evaluator agent can retrieve domain-relevant grading criteria.
"""

import logging
from app.services.ingestion import ingest_rubric
from app.services.rag_engine import check_rubrics_seeded

logger = logging.getLogger("recruitai.rubric_seed")

STANDARD_RUBRICS = [
    {
        "role_category": "general",
        "content": """
RecruitAI General Candidate Evaluation Rubric:
1. Communication Clarity (Weight: 25%):
   - Articulation, conciseness, structured thinking (STAR framework).
   - Active listening and direct addressing of the interviewer's prompt.
2. Problem Solving & Analytical Rigor (Weight: 35%):
   - Ability to break down ambiguous challenges into manageable components.
   - Evidence of hypothesis-driven reasoning and trade-off evaluation.
3. Domain Knowledge & Depth (Weight: 30%):
   - Mastery of core competencies, toolchains, and modern industry standards.
   - Depth over buzzwords; ability to explain foundational principles.
4. Adaptability & Coachability (Weight: 10%):
   - Receptiveness to hints, feedback, and edge-case course corrections.
        """.strip(),
    },
    {
        "role_category": "software_engineering",
        "content": """
RecruitAI Technical & Software Engineering Rubric:
1. System Architecture & Scalability (Weight: 30%):
   - Understanding of microservices, distributed systems, CAP theorem, caching, and data pipelines.
   - High availability, fault tolerance, horizontal scaling, and latency trade-offs.
2. Code Craftsmanship & Data Structures (Weight: 30%):
   - Algorithmic time/space complexity analysis (Big-O).
   - Clean code principles, maintainability, modularity, and error handling.
3. Production Readiness & DevOps (Weight: 20%):
   - CI/CD, containerization (Docker, Kubernetes), automated testing, observability, and monitoring.
   - Security best practices (authentication, authorization, encryption).
4. Technical Communication & Trade-offs (Weight: 20%):
   - Defending technical choices with empirical trade-offs rather than dogmatism.
        """.strip(),
    },
    {
        "role_category": "behavioral",
        "content": """
RecruitAI Behavioral & Culture Fit Rubric:
1. Leadership & Ownership (Weight: 30%):
   - Driving projects to completion, taking accountability for failures, and bias for action.
2. Collaboration & Team Dynamics (Weight: 30%):
   - Cross-functional communication, handling disagreements constructively, empathy, and mentoring.
3. Resilience & Conflict Resolution (Weight: 25%):
   - Managing tight deadlines, shifting priorities, and resolving stakeholder friction.
4. Continuous Learning & Self-Awareness (Weight: 15%):
   - Reflection on past mistakes, seeking feedback, and proactive skill acquisition.
        """.strip(),
    },
]


def seed_rubrics_if_needed():
    """Seeds standard rubrics into pgvector if not already populated."""
    try:
        if check_rubrics_seeded():
            logger.info("Evaluation rubrics already present. Skipping initial seed.")
            return

        logger.info("Seeding standard evaluation rubrics into vectorstore...")
        total_chunks = 0
        for rubric in STANDARD_RUBRICS:
            chunks = ingest_rubric(
                rubric_text=rubric["content"],
                role_category=rubric["role_category"],
            )
            total_chunks += chunks
        logger.info(f"Successfully seeded {total_chunks} rubric chunks across standard categories.")
    except Exception as e:
        logger.warning(f"Rubric seeding skipped or deferred: {e}")
