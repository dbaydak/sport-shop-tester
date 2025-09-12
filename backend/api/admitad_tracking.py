import logging
import requests
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

# --- Настройка логирования ---
# Лучше определить логгер здесь, чтобы он был доступен во всем файле
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

router = APIRouter()

class TrackingEvent(BaseModel):
    """Модель данных, которую будет присылать фронтенд-трекер."""
    order_id: str = Field(..., alias='orderId')
    order_amount: float = Field(..., alias='orderAmount')
    payment_type: str = Field(..., alias='paymentType') # 'sale' или 'lead'

@router.post("/track-conversion", summary="API-шлюз с финальной логикой дедупликации")
async def track_conversion(event: TrackingEvent, request: Request):
    """
    Принимает запрос от JS-трекера и отправляет S2S Postback,
    если последний источник трафика - Admitad.
    """
    uid_from_cookie = request.cookies.get("admitad_aid")
    source_from_cookie = request.cookies.get("deduplication_cookie")

    # --- ФИНАЛЬНАЯ ЛОГИКА АТРИБУЦИИ ---
    # Постбэк отправляется, только если оба условия выполнены:
    # 1. Есть admitad_uid (cookie 'admitad_aid' существует и не пуста).
    # 2. Последний источник трафика - 'admitad' (cookie 'deduplication_cookie' равна 'admitad').
    if uid_from_cookie and source_from_cookie == "admitad":
        log.info(f"Атрибуция подтверждена для Admitad. UID: {uid_from_cookie}. Отправка постбэка для заказа {event.order_id}...")

        postback_url = "https://ad.admitad.com/r"
        params = {
            "postback_key": "ed2Dd5f96a1b1a762b712D87CE925C6f", # Ваш секретный ключ
            "campaign_code": "8817907101",
            "action_code": "1",  # Пример кода целевого действия
            "uid": uid_from_cookie,
            "order_id": event.order_id,
            "tariff_code": "1",
            "payment_type": event.payment_type,
            "price": event.order_amount,
            "adm_method": "sr", # Server request
            "adm_method_name": "postback_sdk",

            "promocode": ""
        }
        try:
            response = requests.get(postback_url, params=params, timeout=5)
            response.raise_for_status()
            log.info(f"S2S Postback для заказа {event.order_id} успешно отправлен.")
            return {"status": "success", "message": "Postback sent to Admitad."}
        except requests.exceptions.RequestException as e:
            log.error(f"ОШИБКА: Не удалось отправить S2S Postback для заказа {event.order_id}: {e}")
            raise HTTPException(status_code=502, detail="Failed to send postback to affiliate network.")

    else:
        # Если условия не выполнены, логируем и ничего не отправляем
        log.info(f"ДЕДУПЛИКАЦИЯ: Конверсия атрибуцирована другому источнику ('{source_from_cookie}'). Постбэк для Admitad UID '{uid_from_cookie}' не отправлен.")
        return {"status": "deduplicated", "attributed_source": source_from_cookie}
