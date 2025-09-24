from fastapi import APIRouter, HTTPException
from backend.models import Order
from backend.services import order_service

router = APIRouter()


@router.post("/orders", summary="Оформить новый заказ")
def create_order(order: Order):
    try:
        result = order_service.process_new_order(order)
        return {"status": "success", **result}
    except ValueError as e:
        # Сервис может вернуть ошибку, которую мы превращаем в HTTP-ответ
        raise HTTPException(status_code=400, detail=str(e))
