from fastapi import APIRouter, HTTPException
from backend.models import EventRegistration
from backend.services import order_service

router = APIRouter()


# Исправляем URL на "/registrations"
@router.post("/registrations", summary="Записать пользователя на мероприятие")
def create_event_registration(registration: EventRegistration):
    try:
        result = order_service.process_event_registration(registration)
        return {"status": "success", **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
