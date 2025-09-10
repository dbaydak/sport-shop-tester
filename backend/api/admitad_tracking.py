import requests # <-- Добавляем импорт для отправки запросов
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter()

class TrackingEvent(BaseModel):
    """Модель данных, которую будет присылать фронтенд-трекер."""
    order_id: str = Field(..., alias='orderId')
    order_amount: float = Field(..., alias='orderAmount')
    payment_type: str = Field(..., alias='paymentType') # 'sale' или 'lead'

@router.post("/track-conversion", summary="Автономный API-шлюз для трекинга конверсий")
async def track_conversion(event: TrackingEvent, request: Request):
    """
    Этот эндпоинт принимает данные от JS-трекера, извлекает UID из cookie
    и НАПРЯМУЮ отправляет S2S Postback в Admitad.
    """
    uid_from_cookie = request.cookies.get("admitad_aid")

    if not uid_from_cookie:
        return {"status": "ignored", "message": "Admitad UID not found in cookies."}

    # --- ЛОГИКА ОТПРАВКИ POSTBACK ПЕРЕНЕСЕНА СЮДА ---
    postback_url = "https://ad.admitad.com/r"
    params = {
        "order_id": event.order_id,
        "postback_key": "ed2Dd5f96a1b1a762b712D87CE925C6f", # Ваш секретный ключ
        "action_code": "5", # Код вашего целевого действия
        "uid": uid_from_cookie,
        "tariff_code": "1",
        "payment_type": event.payment_type,
        "price": event.order_amount,
        "adm_method": "postback_sdk"
    }

    try:
        print(f"ИЗ API-ШЛЮЗА: Отправка S2S Postback с параметрами {params}")
        response = requests.get(postback_url, params=params, timeout=5)
        response.raise_for_status() # Проверяем, что ответ успешный (статус 2xx)
        print("ИЗ API-ШЛЮЗА: S2S Postback успешно отправлен!")
        return {"status": "success", "message": "Postback sent"}
    except requests.exceptions.RequestException as e:
        print(f"ОШИБКА API-ШЛЮЗА: Не удалось отправить S2S Postback: {e}")
        # Возвращаем ошибку, чтобы фронтенд (при желании) мог её обработать
        raise HTTPException(status_code=502, detail="Failed to send postback to affiliate network.")
