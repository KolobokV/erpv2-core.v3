from fastapi import APIRouter

router = APIRouter()


@router.get("/control-events/{client_id}")
def get_control_events(client_id: str):
    """
    Return control events for a client.
    This is a minimal working prototype. 
    Later it will be replaced by dynamic logic.
    """

    # Temporary mock events for working demo
    events = [
        {
            "id": "monthly_statement_request",
            "title": "Monthly bank statement request",
            "due_day": 1,
            "type": "monthly",
        },
        {
            "id": "documents_request_after_statement",
            "title": "Request documents",
            "after_event": "monthly_statement_request",
            "type": "chained",
        },
        {
            "id": "salary_first_part",
            "title": "Salary payment (first)",
            "days": [5, 10, 15, 20],
            "type": "custom",
        },
    ]

    return {
        "client_id": client_id,
        "events": events,
    }
