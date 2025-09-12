import logging
import requests
import json
import os
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional

# --- Настройка ---
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)
router = APIRouter()


# --- Модели данных для API-шлюза ---
class TrackingCartItem(BaseModel):
    id: str
    price: float
    quantity: int
    sku: Optional[str] = None


class TrackingEvent(BaseModel):
    """Модель данных, которую будет присылать фронтенд-трекер."""
    order_id: str = Field(..., alias='orderId')
    order_amount: float = Field(..., alias='orderAmount')
    payment_type: str = Field(..., alias='paymentType')
    items: List[TrackingCartItem] = []  # Ожидаем список товаров, если он есть


# --- API-шлюз для приёма данных от трекера ---
@router.post("/api/track-conversion", summary="API-шлюз для трекинга конверсий")
async def track_conversion(event: TrackingEvent, request: Request):
    """
    Принимает запрос от JS-трекера, проверяет атрибуцию
    и отправляет S2S Postback в Admitad.
    """
    log.info("--- Endpoint /api/track-conversion вызван ---")
    uid_from_cookie = request.cookies.get("admitad_aid")
    source_from_cookie = request.cookies.get("deduplication_cookie")
    log.info(
        f"Получены куки: admitad_aid='{uid_from_cookie}', deduplication_cookie='{source_from_cookie}'")

    # Логика дедупликации: отправляем, только если есть UID и источник - Admitad
    if uid_from_cookie and source_from_cookie == "admitad":
        log.info(
            f"Атрибуция Admitad подтверждена для заказа {event.order_id}. Отправка постбэка...")

        # Формируем корзину для параметра _ps, если она есть
        admitad_basket = {}
        if event.items:
            position_count = len(event.items)
            admitad_basket = {
                "tariff_code": ["1"] * position_count,
                # "order_id": [event.order_id] * position_count,
                "position_id": [str(i + 1) for i in range(position_count)],
                "position_count": [str(position_count)] * position_count,
                "price": [str(item.price) for item in event.items],
                "quantity": [str(item.quantity) for item in event.items],
                "product_id": [item.id for item in event.items],
            }

        postback_url = "https://ad.admitad.com/tt"
        params = {
            "channel": "admitad",
            "order_id": event.order_id,
            "postback_key": "ed2Dd5f96a1b1a762b712D87CE925C6f",
            "campaign_code": "8817907101",
            "uid": uid_from_cookie,
            "payment_type": event.payment_type,
            # "price": event.order_amount,
            "adm_method": "sr",  # Server request
            "adm_method_name": "postback_sdk",
            "promocode": ""
        }
        # Добавляем корзину в параметры, только если она не пуста
        if admitad_basket:
            params["_ps"] = json.dumps(admitad_basket)

        try:
            log.info(
                f"Отправка запроса на URL: {postback_url} с параметрами: {params}")
            response = requests.get(postback_url, params=params, timeout=5)
            response.raise_for_status()
            log.info(
                f"S2S Postback для заказа {event.order_id} успешно отправлен.")
            return {"status": "success", "message": "Postback sent."}
        except requests.exceptions.RequestException as e:
            log.error(f"ОШИБКА: Не удалось отправить S2S Postback: {e}")
            raise HTTPException(status_code=502,
                                detail="Failed to send postback.")

    else:
        log.info("Условие для отправки постбэка НЕ ВЫПОЛНЕНО.")
        log.info(
            f"ДЕДУПЛИКАЦИЯ: Конверсия для UID '{uid_from_cookie}' атрибуцирована источнику '{source_from_cookie}'. Постбэк не отправлен.")
        return {"status": "deduplicated", "source": source_from_cookie}


# --- Эндпоинт для отдачи самого JS-трекера ---
@router.get("/tracker.js", summary="Отдать клиентский JS-трекер")
def get_tracker_script():
    """
    Этот эндпоинт отдаёт файл tracker.js. Это делает скрипт first-party
    и защищает его от большинства блокировщиков.
    """
    # Путь к файлу tracker.js относительно текущего файла (admitad_integration.py)
    script_path = os.path.join(os.path.dirname(__file__), "..", "..", "assets",
                               "tracker.js")
    if os.path.exists(script_path):
        return FileResponse(script_path, media_type="application/javascript")
    raise HTTPException(status_code=404, detail="tracker.js not found")
