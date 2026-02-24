"""Audit write utility function for centralized audit logging."""
from datetime import datetime
from db.mongodb import get_async_db, COLLECTIONS


async def log_audit(
    event_id: str,
    action: str,
    entity_ref: str,
    prev_value,
    new_value,
    user_id: str = "system",
):
    """
    Write an audit log entry.

    Parameters:
        event_id: The event context
        action: One of the AuditAction values (e.g., ALLOCATION_CHANGE, CATEGORY_CHANGE, etc.)
        entity_ref: Reference to the affected entity (fund/date, position ID, etc.)
        prev_value: Previous value before the change
        new_value: New value after the change
        user_id: Who made the change
    """
    db = get_async_db()
    doc = {
        "eventId": event_id,
        "action": action,
        "entityReference": entity_ref,
        "previousValue": prev_value,
        "newValue": new_value,
        "changedBy": user_id,
        "timestamp": datetime.utcnow().isoformat(),
    }
    await db[COLLECTIONS["auditLogs"]].insert_one(doc)
    return doc
