import logging
import requests
import json
import os
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
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
DEFAULT_TARIFF_CODE = "1"  # Тариф по умолчанию

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
    promocode: Optional[str] = Field(None, alias='promocode')


def send_postback_in_background(url: str, params: dict, order_id: str):
    """
    Эта функция выполняется в фоновом режиме, не блокируя основной ответ клиенту.
    """
    try:
        log.info(f"ФОНОВАЯ ОТПРАВКА: URL: {url}, параметры: {params}")
        # Для фоновых задач рекомендуется ставить более долгий таймаут
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        log.info(f"ФОНОВЫЙ ПОСТБЭК для заказа {order_id} успешно отправлен.")
    except requests.exceptions.RequestException as e:
        log.error(f"ОШИБКА ФОНОВОГО ПОСТБЭКА: Не удалось отправить S2S Postback для заказа {order_id}: {e}")


# --- API-шлюз для приема данных от трекера ---
@router.post("/api/track-conversion", summary="API-шлюз для трекинга конверсий")
async def track_conversion(event: TrackingEvent, request: Request, background_tasks: BackgroundTasks):
    """
    Принимает запрос, немедленно отвечает пользователю
    и ставит отправку S2S Postback в фоновую очередь.
    """
    log.info("--- Endpoint /api/track-conversion вызван ---")
    uid_from_cookie = request.cookies.get("_adm_aid")
    source_from_cookie = request.cookies.get("_last_source")
    pid_from_cookie = request.cookies.get("_pid")
    log.info(f"Получены куки: _adm_aid='{uid_from_cookie}', _last_source='{source_from_cookie}', _pid='{pid_from_cookie}'")

    # Шаг 1: Сначала полностью готовим базовые параметры запроса
    postback_url = "https://ad.admitad.com/tt"
    params = {
        "campaign_code": ADMITAD_CAMPAIGN_CODE,
        "postback_key": ADMITAD_POSTBACK_KEY,
        "channel": "admitad",
        "adm_method": "sr",
        "adm_method_name": "postback_sdk",
        "v": "2",
        "rt": "img",
        "currency_code": "RUB",
        "publisher_id": pid_from_cookie,
        "action_code": event.action_code,
        "order_id": event.order_id,
        "uid": uid_from_cookie,
        "payment_type": event.payment_type,
        "promocode": event.promocode or ""
    }

    # Шаг 2: Добавляем данные о заказе в зависимости от наличия товаров
    if event.items:
        # Если есть товары, формируем детализированную корзину (_ps)
        position_count = len(event.items)
        final_tariff_codes = []
        if event.tariff_codes and len(event.tariff_codes) == position_count:
            final_tariff_codes = event.tariff_codes
            log.info(f"Используются кастомные тарифы: {final_tariff_codes}")
        else:
            final_tariff_codes = [DEFAULT_TARIFF_CODE] * position_count
            log.info(f"Используется дефолтное значение для тарифов: {final_tariff_codes}")

        admitad_basket = {
            "tariff_code": final_tariff_codes,
            "position_id": [str(i + 1) for i in range(position_count)],
            "position_count": [str(position_count)] * position_count,
            "price": [str(item.price) for item in event.items],
            "quantity": [str(item.quantity) for item in event.items],
            "product_id": [item.id for item in event.items]
        }
        params["_ps"] = json.dumps(admitad_basket)
    else:
        # Если товаров нет, добавляем общую стоимость и тариф
        log.info("Информация о товарах отсутствует. Используются общие данные о заказе.")
        params["price"] = event.order_amount
        params["tariff_code"] = "1"

    # Шаг 3: Проверяем атрибуцию и принимаем решение об отправке
    if (event.promocode and event.promocode.strip()) or (
            uid_from_cookie and source_from_cookie == "admitad"):
        attribution_reason = "промокоду" if event.promocode and event.promocode.strip() else "cookie"
        log.info(
            f"Атрибуция Admitad подтверждена по {attribution_reason} для заказа {event.order_id}. Планирование постбэка...")
        background_tasks.add_task(send_postback_in_background, postback_url, params, event.order_id)
        return {"status": "success", "message": "Postback scheduled."}
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
