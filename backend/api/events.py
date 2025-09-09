from fastapi import APIRouter
from backend.models import EventRegistration
from backend.services import order_service

router = APIRouter()

@router.post("/register-event", summary="Записать пользователя на мероприятие")
def register_for_event(registration: EventRegistration):
    result = order_service.process_event_registration(registration)
    return {"status": "success", **result}
