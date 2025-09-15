import logging
import requests
import json
import os
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from dotenv import load_dotenv

# Загрузка секретных ключей из .env файла
load_dotenv()

# --- Настройка ---
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)
router = APIRouter()

# Конфигурационные настройки
COOKIE_LIFETIME_DAYS = 90
ADMITAD_CAMPAIGN_CODE = os.getenv("ADMITAD_CAMPAIGN_CODE")  # Код кампании
ADMITAD_POSTBACK_KEY = os.getenv("ADMITAD_POSTBACK_KEY")  # Секретный ключ
DEFAULT_ACTION_CODE = "5"  # Действие по умолчанию

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
    items: List[TrackingCartItem] = []  # Список товаров
    action_code: Optional[str] = Field(DEFAULT_ACTION_CODE, alias='actionCode')
    tariff_codes: Optional[List[str]] = Field(None, alias='tariffCodes')

# --- API-шлюз для приема данных от трекера ---
@router.post("/api/track-conversion", summary="API-шлюз для трекинга конверсий")
async def track_conversion(event: TrackingEvent, request: Request):
    """
    Принимает запрос от JS-трекера, проверяет атрибуцию
    и отправляет S2S Postback в Admitad.
    """
    log.info("--- Endpoint /api/track-conversion вызван ---")
    uid_from_cookie = request.cookies.get("_adm_aid")
    source_from_cookie = request.cookies.get("_last_source")
    pid_from_cookie = request.cookies.get("_pid")
    log.info(f"Получены куки: _adm_aid='{uid_from_cookie}', _last_source='{source_from_cookie}', _pid='{pid_from_cookie}'")

    # Дедупликация: отправляем, только если есть UID и источник - Admitad
    if uid_from_cookie and source_from_cookie == "admitad":
        log.info(f"Атрибуция Admitad подтверждена для заказа {event.order_id}. Отправка постбэка...")

        # Формирование корзины для параметра _ps, если товары указаны
        admitad_basket = {}
        if event.items:
            position_count = len(event.items)
            # Выбор тарифа: если передан кастомный тариф, используем его, иначе стандартный
            final_tariff_codes = []
            # Проверяем, что массив тарифов пришёл и его длина совпадает с кол-вом товаров
            if event.tariff_codes and len(event.tariff_codes) == position_count:
                final_tariff_codes = event.tariff_codes
                log.info(f"Используются кастомные тарифы: {final_tariff_codes}")
            else:
                # Если проверка не пройдена, используем значение по умолчанию
                final_tariff_codes = ["1"] * position_count
                log.info(
                    f"Кастомные тарифы не предоставлены или некорректны. Используется дефолтное значение: {final_tariff_codes}")

            admitad_basket = {
                "tariff_code": final_tariff_codes,
                "position_id": [str(i+1) for i in range(position_count)],
                "position_count": [str(position_count)] * position_count,
                "price": [str(item.price) for item in event.items],
                "quantity": [str(item.quantity) for item in event.items],
                "product_id": [item.id for item in event.items]
            }

        postback_url = "https://ad.admitad.com/tt"
        params = {
            "campaign_code": ADMITAD_CAMPAIGN_CODE,
            "postback_key": ADMITAD_POSTBACK_KEY,
            "channel": "admitad",
            "adm_method": "sr",  # Server request
            "adm_method_name": "postback_sdk",
            "v": "2",
            "rt": "img",
            "currency_code": "RUB",
            "publisher_id": pid_from_cookie,
            "ac": event.action_code,
            "order_id": event.order_id,
            "uid": uid_from_cookie,
            "payment_type": event.payment_type,
            "promocode": ""
        }

        # Добавляем корзину в параметры, если она указана
        if admitad_basket:
            params["_ps"] = json.dumps(admitad_basket)

        try:
            log.info(f"Отправка запроса на URL: {postback_url} с параметрами: {params}")
            response = requests.get(postback_url, params=params, timeout=2)
            response.raise_for_status()
            log.info(f"S2S Postback для заказа {event.order_id} успешно отправлен.")
            return {"status": "success", "message": "Postback sent."}
        except requests.exceptions.RequestException as e:
            log.error(f"ОШИБКА: Не удалось отправить S2S Postback: {e}")
            raise HTTPException(status_code=502, detail="Failed to send postback.")

    else:
        log.info("Условие для отправки постбэка НЕ ВЫПОЛНЕНО.")
        log.info(f"ДЕДУПЛИКАЦИЯ: Конверсия для UID '{uid_from_cookie}' атрибуцирована источнику '{source_from_cookie}'. Постбэк не отправлен.")
        return {"status": "deduplicated", "source": source_from_cookie}

# --- Эндпоинт для отдачи самого JS-трекера ---
@router.get("/tracker.js", summary="Отдача клиентского JS-трекера")
def get_tracker_script():
    """
    Этот эндпоинт отдаёт файл tracker.js. Это делает скрипт first-party
    и защищает его от большинства блокировщиков.
    """
    # Путь к файлу tracker.js относительно текущего файла (admitad_integration.py)
    script_path = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "tracker.js")
    if os.path.exists(script_path):
        return FileResponse(script_path, media_type="application/javascript")
    raise HTTPException(status_code=404, detail="tracker.js not found")
