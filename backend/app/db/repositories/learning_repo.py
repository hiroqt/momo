import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from app.db.session import supabase_session

logger = logging.getLogger(__name__)

class LearningRepository:
    """
    In-memory and Supabase-backed persistent store for student auto-learning analytics.
    Tracks user study sessions, flashcard flip results, quiz scores, topic accuracy,
    and weak concepts for adaptive study generation.
    """

    def __init__(self) -> None:
        # In-memory store: user_id -> List of event dicts
        self._user_events: dict[str, list[dict[str, Any]]] = {}

    async def record_study_event(
        self,
        user_id: str,
        topic: str | None = None,
        item_id: str | None = None,
        question: str | None = None,
        result: str | None = None,
        user_answer: str | None = None,
        occurred_at: str | None = None
    ) -> dict[str, Any]:
        """
        Record a student study action (e.g. card review, quiz choice, correct/incorrect answer).
        """
        clean_topic = (topic or "General Concepts").strip().title()
        res_normalized = (result or "correct").lower()
        if res_normalized not in ("correct", "incorrect", "mastered", "review_later"):
            res_normalized = "correct" if "correct" in res_normalized else "incorrect"

        event = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "topic": clean_topic,
            "item_id": item_id or None,
            "question": question or f"Study item on {clean_topic}",
            "result": res_normalized,
            "user_answer": user_answer or "",
            "occurred_at": occurred_at or datetime.now(UTC).isoformat()
        }

        if supabase_session.is_configured and supabase_session.client:
            await supabase_session.execute(supabase_session.client.table("learning_events").insert(event))
        else:
            self._user_events.setdefault(user_id, []).append(event)

        logger.debug("Recorded learning event")
        return event

    async def get_learning_profile(self, user_id: str) -> dict[str, Any]:
        """
        Computes the student's mastery profile, weak spots, mastered subjects, and recommended review plan.
        """
        events = self._user_events.get(user_id, [])
        statistics = None
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.rpc("learning_statistics", {"p_user_id": user_id}))
            statistics = resp.data

        if not events and not (statistics and statistics["total_reviews"]):
            return {
                "user_id": user_id,
                "total_reviews": 0,
                "accuracy_rate": 0.0,
                "mastery_score": 0,
                "adaptive_level": "beginner",
                "topics_breakdown": {},
                "weak_topics": [],
                "strong_topics": [],
                "recent_missed_questions": [],
                "recommended_focus": ["Upload lecture notes or start a 10-card flashcard review"],
                "summary": "No study sessions recorded yet. Start practicing to unlock personalized learning metrics!"
            }

        total_reviews = statistics["total_reviews"] if statistics else len(events)
        correct_count = statistics["correct_count"] if statistics else sum(1 for e in events if e.get("result") in ("correct", "mastered"))
        accuracy_rate = round(correct_count / total_reviews, 2) if total_reviews > 0 else 0.0
        mastery_score = int(accuracy_rate * 100)

        # Topic aggregation
        topic_stats: dict[str, dict[str, Any]] = {}
        for e in events:
            top = e.get("topic") or "General Review"
            if top not in topic_stats:
                topic_stats[top] = {"total": 0, "correct": 0, "missed": 0}
            topic_stats[top]["total"] += 1
            if e.get("result") in ("correct", "mastered"):
                topic_stats[top]["correct"] += 1
            else:
                topic_stats[top]["missed"] += 1

        if statistics:
            topic_stats = {row["topic"]: row for row in statistics["topics"]}
        weak_topics = []
        strong_topics = []
        breakdown = {}

        for top, stats in topic_stats.items():
            t_acc = round(stats["correct"] / stats["total"], 2) if stats["total"] > 0 else 0.0
            status = "MASTERED" if t_acc >= 0.80 and stats["total"] >= 3 else ("NEEDS_REVIEW" if t_acc < 0.65 or stats["missed"] >= 2 else "LEARNING")
            breakdown[top] = {
                "attempts": stats["total"],
                "correct": stats["correct"],
                "accuracy": t_acc,
                "status": status
            }
            if status == "NEEDS_REVIEW":
                weak_topics.append(top)
            elif status == "MASTERED":
                strong_topics.append(top)

        # Recent missed questions
        missed_events = statistics["recent_missed_events"] if statistics else [e for e in reversed(events) if e.get("result") == "incorrect"]
        recent_missed = []
        seen_q = set()
        for me in missed_events:
            q_text = me.get("question", "")
            if q_text and q_text not in seen_q:
                seen_q.add(q_text)
                recent_missed.append({
                    "question": q_text,
                    "topic": me.get("topic"),
                    "user_answer": me.get("user_answer", ""),
                    "occurred_at": me.get("occurred_at")
                })
            if len(recent_missed) >= 5:
                break

        # Adaptive difficulty rating
        if accuracy_rate >= 0.85 and total_reviews >= 10:
            adaptive_level = "advanced"
        elif accuracy_rate >= 0.65:
            adaptive_level = "intermediate"
        else:
            adaptive_level = "beginner"

        # Recommendations
        recommended = []
        if weak_topics:
            recommended.extend([f"Review weak topic: {wt}" for wt in weak_topics[:3]])
        elif strong_topics:
            recommended.append(f"Level up on {strong_topics[0]} with a hard practice quiz")
        else:
            recommended.append("Practice 10 flashcards to build your mastery baseline")

        return {
            "user_id": user_id,
            "total_reviews": total_reviews,
            "accuracy_rate": accuracy_rate,
            "mastery_score": mastery_score,
            "adaptive_level": adaptive_level,
            "topics_breakdown": breakdown,
            "weak_topics": weak_topics,
            "strong_topics": strong_topics,
            "recent_missed_questions": recent_missed,
            "recommended_focus": recommended,
            "summary": (
                f"Mastery: {mastery_score}% across {total_reviews} questions. "
                + (f"Focus areas: {', '.join(weak_topics)}." if weak_topics else "Solid concept retention across all practiced topics.")
            )
        }

    async def get_adaptive_difficulty(self, user_id: str, topic: str | None = None) -> str:
        """
        Determines the optimal question difficulty for the user to maximize learning gains.
        """
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.rpc("learning_statistics", {"p_user_id": user_id}))
            stats = resp.data
            if topic:
                for row in stats["topics"]:
                    if row["topic"].lower() == topic.lower() and row["total"] >= 3:
                        acc = row["correct"] / row["total"]
                        return "hard" if acc >= 0.85 else "easy" if acc <= 0.50 else "medium"
            total = stats["total_reviews"]
            if not total:
                return "medium"
            acc = stats["correct_count"] / total
            return "hard" if acc >= 0.85 and total >= 8 else "easy" if acc <= 0.50 else "medium"
        events = self._user_events.get(user_id, [])
        if not events:
            return "medium"

        if topic:
            topic_events = [e for e in events if (e.get("topic") or "").lower() == topic.lower()]
            if len(topic_events) >= 3:
                acc = sum(1 for e in topic_events if e.get("result") in ("correct", "mastered")) / len(topic_events)
                if acc >= 0.85:
                    return "hard"
                elif acc <= 0.50:
                    return "easy"
                return "medium"

        # Overall user accuracy
        total = len(events)
        correct = sum(1 for e in events if e.get("result") in ("correct", "mastered"))
        acc = correct / total if total > 0 else 0.5
        if acc >= 0.85 and total >= 8:
            return "hard"
        elif acc <= 0.50:
            return "easy"
        return "medium"

learning_repo = LearningRepository()
