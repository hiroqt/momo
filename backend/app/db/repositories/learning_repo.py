from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from app.db.session import supabase_session
import logging

logger = logging.getLogger(__name__)

class LearningRepository:
    """
    In-memory and Supabase-backed persistent store for student auto-learning analytics.
    Tracks user study sessions, flashcard flip results, quiz scores, topic accuracy,
    and weak concepts for adaptive study generation.
    """

    def __init__(self):
        # In-memory store: user_id -> List of event dicts
        self._user_events: Dict[str, List[Dict[str, Any]]] = {}

    async def record_study_event(
        self,
        user_id: str,
        topic: Optional[str] = None,
        item_id: Optional[str] = None,
        question: Optional[str] = None,
        result: Optional[str] = None,
        user_answer: Optional[str] = None,
        occurred_at: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Record a student study action (e.g. card review, quiz choice, correct/incorrect answer).
        """
        clean_topic = (topic or "General Concepts").strip().title()
        res_normalized = (result or "correct").lower()
        if res_normalized not in ("correct", "incorrect", "mastered", "review_later"):
            res_normalized = "correct" if "correct" in res_normalized else "incorrect"

        event = {
            "id": f"evt-{len(self._user_events.get(user_id, [])) + 1}",
            "user_id": user_id,
            "topic": clean_topic,
            "item_id": item_id or "",
            "question": question or f"Study item on {clean_topic}",
            "result": res_normalized,
            "user_answer": user_answer or "",
            "occurred_at": occurred_at or datetime.now(timezone.utc).isoformat()
        }

        if user_id not in self._user_events:
            self._user_events[user_id] = []
        self._user_events[user_id].append(event)

        # Optional Supabase persistence
        if supabase_session.is_configured and supabase_session.client:
            try:
                supabase_session.client.table("learning_events").insert(event).execute()
            except Exception as e:
                logger.debug(f"Learning event Supabase sync skipped or failed: {e}")

        logger.debug(f"Recorded learning event for user={user_id} topic={clean_topic} result={res_normalized}")
        return event

    async def get_learning_profile(self, user_id: str) -> Dict[str, Any]:
        """
        Computes the student's mastery profile, weak spots, mastered subjects, and recommended review plan.
        """
        events = self._user_events.get(user_id, [])

        if not events:
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

        total_reviews = len(events)
        correct_count = sum(1 for e in events if e.get("result") in ("correct", "mastered"))
        accuracy_rate = round(correct_count / total_reviews, 2) if total_reviews > 0 else 0.0
        mastery_score = int(accuracy_rate * 100)

        # Topic aggregation
        topic_stats: Dict[str, Dict[str, Any]] = {}
        for e in events:
            top = e.get("topic") or "General Review"
            if top not in topic_stats:
                topic_stats[top] = {"total": 0, "correct": 0, "missed": 0}
            topic_stats[top]["total"] += 1
            if e.get("result") in ("correct", "mastered"):
                topic_stats[top]["correct"] += 1
            else:
                topic_stats[top]["missed"] += 1

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
        missed_events = [e for e in reversed(events) if e.get("result") == "incorrect"]
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

    async def get_adaptive_difficulty(self, user_id: str, topic: Optional[str] = None) -> str:
        """
        Determines the optimal question difficulty for the user to maximize learning gains.
        """
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
