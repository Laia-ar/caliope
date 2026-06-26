"""Helpers to track OpenRouter usage and costs."""
import os
import logging
import requests
from sqlalchemy import Numeric
from extensions import db
from models import UsageLog

GENERATION_API_URL = "https://openrouter.ai/api/v1/generation"
CREDITS_API_URL = "https://openrouter.ai/api/v1/credits"


def fetch_openrouter_credits() -> dict | None:
    """Fetch current OpenRouter account credits."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return None

    try:
        response = requests.get(
            CREDITS_API_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json().get("data") or {}
        total_credits = float(data.get("total_credits", 0) or 0)
        total_usage = float(data.get("total_usage", 0) or 0)
        return {
            "total_credits": total_credits,
            "total_usage": total_usage,
            "balance_usd": total_credits - total_usage,
        }
    except Exception as e:
        logging.warning(f"Failed to fetch OpenRouter credits: {e}")
        return None


def extract_usage_from_response(response_data: dict) -> dict:
    """Extract token usage from an OpenRouter chat completions response."""
    usage = response_data.get("usage") or {}
    return {
        "prompt_tokens": usage.get("prompt_tokens", 0) or 0,
        "completion_tokens": usage.get("completion_tokens", 0) or 0,
        "total_tokens": usage.get("total_tokens", 0) or 0,
    }


def fetch_generation_cost(generation_id: str) -> dict | None:
    """Fetch cost and token details from OpenRouter generation endpoint."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key or not generation_id:
        return None

    try:
        response = requests.get(
            f"{GENERATION_API_URL}?id={generation_id}",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json().get("data") or {}
        return {
            "prompt_tokens": data.get("prompt_tokens", 0) or 0,
            "completion_tokens": data.get("completion_tokens", 0) or 0,
            "total_tokens": data.get("total_tokens", 0) or 0,
            "cost_usd": data.get("total_cost") or data.get("cost"),
        }
    except Exception as e:
        logging.warning(f"Failed to fetch generation cost for {generation_id}: {e}")
        return None


def create_usage_log(
    *,
    user_id: int | None,
    query_id: int | None,
    session_query_id: int | None,
    session_participant_id: int | None,
    model_name: str,
    generation_id: str | None,
    response_data: dict,
) -> UsageLog:
    """Create a UsageLog entry from an OpenRouter response."""
    usage = extract_usage_from_response(response_data)
    log = UsageLog(
        user_id=user_id,
        query_id=query_id,
        session_query_id=session_query_id,
        session_participant_id=session_participant_id,
        generation_id=generation_id,
        model_name=model_name,
        prompt_tokens=usage["prompt_tokens"],
        completion_tokens=usage["completion_tokens"],
        total_tokens=usage["total_tokens"],
    )
    db.session.add(log)
    db.session.commit()
    return log


def sync_missing_costs(limit: int = 100) -> dict:
    """Fetch real costs for UsageLog rows without cost_usd."""
    logs = UsageLog.query.filter(UsageLog.cost_usd.is_(None), UsageLog.generation_id.isnot(None)).limit(limit).all()
    updated = 0
    failed = 0

    for log in logs:
        details = fetch_generation_cost(log.generation_id)
        if details and details.get("cost_usd") is not None:
            try:
                log.cost_usd = Numeric(details["cost_usd"])
            except Exception:
                log.cost_usd = float(details["cost_usd"])
            if details.get("prompt_tokens"):
                log.prompt_tokens = details["prompt_tokens"]
            if details.get("completion_tokens"):
                log.completion_tokens = details["completion_tokens"]
            if details.get("total_tokens"):
                log.total_tokens = details["total_tokens"]
            updated += 1
        else:
            failed += 1

    db.session.commit()
    return {"updated": updated, "failed": failed, "processed": len(logs)}
