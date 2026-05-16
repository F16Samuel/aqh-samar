import uuid

async def notify_manager(
    manager_id: uuid.UUID,
    event: str,
    payload: dict,
) -> None:
    # stub — logs to stdout only
    # wired to Teams/email in bonus phase
    print(f"[NOTIFY] manager={manager_id} event={event} payload={payload}")
    return None
