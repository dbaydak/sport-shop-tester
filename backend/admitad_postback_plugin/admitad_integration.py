"""
@file Admitad Integration Backend
@version 3.1.0
@description Этот файл представляет собой полностью автономный серверный API-шлюз для трекера Admitad.
Его задачи:
1. Принимать параметры визита от int_loader.js и устанавливать безопасные First-Party, HttpOnly cookie.
2. Принимать данные о конверсиях, собранные на фронтенде.
3. Проводить логику дедупликации по принципу Last Paid Click, решая, нужно ли атрибуцировать заказ Admitad.
4. Формировать и асинхронно отправлять серверный (S2S) postback-запрос в Admitad.
5. Отдавать клиентский скрипт int_loader.js под нейтральным именем для защиты от блокировщиков.
6. Вести собственное изолированное логирование в отдельный файл, не затрагивая основное приложение.
"""

import logging.handlers
import requests
import json
import os
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from dotenv import load_dotenv

# --- ⚙️ 1. ЗАГРУЗКА ИЗОЛИРОВАННОЙ КОНФИГУРАЦИИ ---
# Определяем путь к .env файлу, который находится внутри этой же папки.
# Это позволяет плагину иметь собственные, независимые настройки.

dotenv_path = os.path.join(os.path.dirname(__file__), ".admitad.env")
load_dotenv(dotenv_path=dotenv_path)


# --- ⚙️ 2. НАСТРОЙКА ИЗОЛИРОВАННОГО ЛОГГЕРА ---
# Этот блок настраивает собственную систему логирования для плагина,
# которая пишет все данные в отдельный файл
# и не мешает основной консоли сервера.

LOG_LEVEL = os.getenv("ADMITAD_LOG_LEVEL", "INFO").upper()
LOG_FILENAME = os.getenv("ADMITAD_LOG_FILE", "admitad_tracker.log")
LOG_MAX_BYTES = int(os.getenv("ADMITAD_LOG_MAX_BYTES", "5242880"))
LOG_BACKUP_COUNT = int(os.getenv("ADMITAD_LOG_BACKUP_COUNT", "3"))

# Создаем логгер с уникальным именем 'admitad_tracker',
# чтобы не конфликтовать с логгерами рекламодателя.
log = logging.getLogger("admitad_tracker")
log.setLevel(LOG_LEVEL)

# Создаем обработчик, который будет писать логи в файл с автоматической ротацией.
# Когда файл достигает максимального размера, он архивируется, и создается новый.
log_filepath = os.path.join(os.path.dirname(__file__), LOG_FILENAME)
handler = logging.handlers.RotatingFileHandler(
    log_filepath, maxBytes=LOG_MAX_BYTES, backupCount=LOG_BACKUP_COUNT
)

# Устанавливаем единый формат для всех записей в логе.
formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
handler.setFormatter(formatter)

# Добавляем наш файловый обработчик к логгеру.
log.addHandler(handler)

# ВАЖНО: отключаем "всплытие" логов к корневому логгеру.
# Это гарантирует, что логи нашего плагина не попадут в общую консоль сервера.
log.propagate = False

# --- Инициализация роутера FastAPI ---
router = APIRouter()


# --- ⚙️ 3. ЧТЕНИЕ КОНФИГУРАЦИОННЫХ НАСТРОЕК ---
# Все эти параметры управляются через файл .admitad.env

COOKIE_LIFETIME_DAYS = int(os.getenv("COOKIE_LIFETIME_DAYS", "90"))
ADMITAD_CAMPAIGN_CODE = os.getenv("ADMITAD_CAMPAIGN_CODE")
ADMITAD_POSTBACK_KEY = os.getenv("ADMITAD_POSTBACK_KEY")
DEFAULT_ACTION_CODE = os.getenv("DEFAULT_ACTION_CODE", "1")
DEFAULT_TARIFF_CODE = os.getenv("DEFAULT_TARIFF_CODE", "1")
DEFAULT_CURRENCY_CODE = os.getenv("DEFAULT_CURRENCY_CODE", "RUB")


# --- 📦 4. МОДЕЛИ ДАННЫХ (PYDANTIC) ---
# Модели Pydantic обеспечивают строгую валидацию
# всех входящих данных от int_loader.js,
# что защищает API от некорректных запросов и потенциальных ошибок.


class TrackingParams(BaseModel):
    """Модель для параметров, которые int_loader.js собирает из URL."""

    admitad_uid: Optional[str] = None
    pid: Optional[str] = None
    utm_source: Optional[str] = None
    gclid: Optional[str] = None
    fbclid: Optional[str] = None


# --- Модели данных для API-шлюза ---
class TrackingCartItem(BaseModel):
    """Модель для одного товара в корзине."""

    id: str
    price: float
    quantity: int
    sku: Optional[str] = None


class TrackingEvent(BaseModel):
    """Модель данных о конверсии, которую присылает int_loader.js."""

    order_id: str = Field(..., alias="orderId")
    order_amount: float = Field(..., alias="orderAmount")
    payment_type: str = Field(..., alias="paymentType")
    items: List[TrackingCartItem] = []  # Список товаров
    action_code: Optional[str] = Field(None, alias="actionCode")
    tariff_codes: Optional[List[str]] = Field(None, alias="tariffCodes")
    promocode: Optional[str] = Field(None, alias="promocode")
    currency: Optional[str] = Field(None, alias="currency")


# --- 🛠️ 5. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---


def send_postback_in_background(url: str, params: dict, order_id: str):
    """
    Отправляет GET-запрос (postback) в Admitad в фоновом режиме.
    Это позволяет мгновенно отдать ответ пользователю,
    не дожидаясь ответа от Admitad.
    """
    try:
        params_for_log = params.copy()
        if "postback_key" in params_for_log:
            params_for_log["postback_key"] = "********"  # Маскируем ключ в логах
        log.debug(f"ФОНОВАЯ ОТПРАВКА: URL: {url}, параметры: {params_for_log}")
        # Для фоновых задач рекомендуется ставить более долгий таймаут
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()  # Вызовет ошибку, если HTTP-статус 4xx или 5xx
        log.info(f"ФОНОВЫЙ ПОСТБЭК для заказа {order_id} успешно отправлен.")
    except requests.exceptions.RequestException as e:
        log.error(
            f"ОШИБКА ФОНОВОГО ПОСТБЭКА: Не удалось отправить S2S Postback для заказа {order_id}: {e}"
        )


# --- 🚀 6. API-ЭНДПОИНТЫ ---


@router.post("/init-tracking", summary="Инициализация трекинга и установка cookie")
def initialize_tracking(params: TrackingParams, response: Response):
    """
    Эндпоинт принимает параметры визита от int_loader.js.
    Его главная задача - установить First-Party, HttpOnly cookie.
    Флаг HttpOnly делает cookie недоступными для чтения из JavaScript,
    что является ключевым элементом защиты от XSS-атак.
    """
    log.debug(f"Инициализация трекинга с параметрами: {params.model_dump()}")

    # 1. Логика установки _adm_aid и _pid
    if params.admitad_uid:
        response.set_cookie(
            key="_adm_aid",
            value=params.admitad_uid,
            max_age=COOKIE_LIFETIME_DAYS * 86400,
            httponly=True,
            samesite="lax",
        )
    if params.pid:
        response.set_cookie(
            key="_pid",
            value=params.pid,
            max_age=COOKIE_LIFETIME_DAYS * 86400,
            httponly=True,
            samesite="lax",
        )

    # 2. Логика атрибуции: сохраняем последний источник перехода в отдельную cookie.
    source = None
    if params.utm_source:
        source = params.utm_source
    elif params.gclid:  # Переход из Google Ads
        source = "advAutoMarkup"
    elif params.fbclid:  # Переход из Facebook Ads
        source = "facebook"

    if source:
        response.set_cookie(
            key="_last_source",
            value=source,
            max_age=COOKIE_LIFETIME_DAYS * 86400,
            httponly=True,
            samesite="lax",
        )
        log.info(f"Установлена cookie _last_source: {source}")

    return {"status": "cookies initiated"}


# --- 7. API-шлюз для приема данных от трекера ---
@router.post("/track-conversion", summary="API-шлюз для трекинга конверсий")
async def track_conversion(
    event: TrackingEvent, request: Request, background_tasks: BackgroundTasks
):
    """
    Принимает запрос, немедленно отвечает пользователю
    и ставит отправку S2S Postback в фоновую очередь.
    """
    log.debug("--- Endpoint /api/track-conversion вызван ---")
    # 1. Извлекаем данные из безопасных HttpOnly cookie, установленных ранее.
    uid_from_cookie = request.cookies.get("_adm_aid")
    source_from_cookie = request.cookies.get("_last_source")
    pid_from_cookie = request.cookies.get("_pid")
    log.debug(
        f"Получены куки: _adm_aid='{uid_from_cookie}', _last_source='{source_from_cookie}', _pid='{pid_from_cookie}'"
    )

    # 2. Формируем базовые параметры для postback-запроса.
    postback_url = "https://ad.admitad.com/tt"
    params = {
        "campaign_code": ADMITAD_CAMPAIGN_CODE,
        "postback_key": ADMITAD_POSTBACK_KEY,
        "channel": "admitad",
        "adm_method": "sr",
        "adm_method_name": "postback_sdk",
        "v": "2",
        "rt": "img",
        "payment_type": event.payment_type or "sale",
        "currency_code": event.currency or DEFAULT_CURRENCY_CODE,
        "publisher_id": pid_from_cookie,
        "action_code": event.action_code or DEFAULT_ACTION_CODE,
        "order_id": event.order_id,
        "uid": uid_from_cookie,
        "promocode": event.promocode or "",
    }

    # 3. Добавляем данные о заказе. Логика адаптируется в зависимости от того,
    # передал ли рекламодатель детализацию по товарам.
    if event.items:
        # Если есть товары, формируем детализированную корзину (_ps)
        position_count = len(event.items)
        # Проверяем, переданы ли кастомные тарифы для каждого товара.
        if event.tariff_codes and len(event.tariff_codes) == position_count:
            final_tariff_codes = event.tariff_codes
            log.debug(f"Используются кастомные тарифы: {final_tariff_codes}")
        else:
            final_tariff_codes = [DEFAULT_TARIFF_CODE] * position_count
            log.debug(
                f"Используется дефолтное значение для тарифов: {final_tariff_codes}"
            )

        admitad_basket = {
            "tariff_code": final_tariff_codes,
            "position_id": [str(i + 1) for i in range(position_count)],
            "position_count": [str(position_count)] * position_count,
            "price": [str(item.price) for item in event.items],
            "quantity": [str(item.quantity) for item in event.items],
            "product_id": [item.id for item in event.items],
        }
        params["_ps"] = json.dumps(admitad_basket)
    else:
        # Если товаров нет, используем общую сумму заказа.
        log.debug(
            "Информация о товарах отсутствует. Используются общие данные о заказе."
        )
        params["price"] = event.order_amount
        params["tariff_code"] = DEFAULT_TARIFF_CODE

    # 4. ЛОГИКА АТРИБУЦИИ И ДЕДУПЛИКАЦИИ.
    # Решаем, нужно ли отправлять postback.
    is_admitad_source = (
        uid_from_cookie
        and source_from_cookie
        and source_from_cookie.startswith("admitad")
    )

    # Условие: отправляем, если есть admitad_uid И (последний источник - Admitad ИЛИ использован промокод).
    if (event.promocode and event.promocode.strip()) or is_admitad_source:
        attribution_reason = (
            "промокоду" if event.promocode and event.promocode.strip() else "cookie"
        )
        log.info(
            f"Атрибуция Admitad подтверждена по {attribution_reason} для заказа {event.order_id}. Планирование постбэка..."
        )
        background_tasks.add_task(
            send_postback_in_background, postback_url, params, event.order_id
        )
        return {"status": "success", "message": "Postback scheduled."}
    else:
        # Если условие не выполнено, postback не отправляется.
        log.debug("Условие для отправки постбэка НЕ ВЫПОЛНЕНО.")
        log.info(
            f"ДЕДУПЛИКАЦИЯ: Конверсия для UID '{uid_from_cookie}' атрибуцирована источнику '{source_from_cookie}'. Постбэк не отправлен."
        )
        return {"status": "deduplicated", "source": source_from_cookie}


# --- Эндпоинт для отдачи самого JS-трекера ---
@router.get("/main.js", summary="Отдача клиентского JS-трекера")
def get_tracker_script():
    """
    Этот эндпоинт отдает файл int_loader.js. Размещение скрипта на том же домене,
    что и основной сайт (first-party), значительно повышает его устойчивость
    к блокировщикам рекламы и ITP-механизмам браузеров.
    """
    # Путь к файлу int_loader.js относительно текущего файла (admitad_integration.py)
    script_path = os.path.join(os.path.dirname(__file__), "assets", "int_loader.js")
    if os.path.exists(script_path):
        return FileResponse(script_path, media_type="application/javascript")
    raise HTTPException(status_code=404, detail="int_loader.js not found")
