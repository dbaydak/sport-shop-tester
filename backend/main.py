from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter
from fastapi.staticfiles import StaticFiles
# from fastapi.responses import FileResponse # Для tracker.js (последний блок)

from backend import db

# Импортируем все наши роутеры из папки api
from backend.api import products, transactions, orders, events, admitad_tracking

# --- Настройка приложения и CORS ---
app = FastAPI(title="Sport Shop Test API")
origins = [
    "http://localhost",
    "http://127.0.0.1",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "null"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "DELETE", "PATCH", "PUT"],
    allow_headers=["*"],
)

# --- Создание единого роутера /api ---
# Мы подключаем все наши отдельные роутеры к одному главному роутеру
# с префиксом /api.
api_router = APIRouter(prefix="/api")
api_router.include_router(products.router)      # <-- Эта строка подключает категории и товары
api_router.include_router(transactions.router)
api_router.include_router(orders.router)
api_router.include_router(events.router)
api_router.include_router(admitad_tracking.router) # API-шлюз: принимает запросы с фронта и отправляет на нужный сервер

# Подключаем главный роутер к приложению
app.include_router(api_router)

# @app.get("/", summary="Корневой эндпоинт для проверки работы")
# def read_root():
#     return {"message": "Welcome to the Sport Shop API"}


@app.get("/api/categories")
def get_categories():
    """
    Возвращает список всех уникальных категорий товаров.
    """
    all_products = db.PRODUCTS_DB
    unique_categories = sorted(list({p['category'] for p in all_products}))
    return unique_categories


# --- ДОБАВЬТЕ ЭТОТ БЛОК КОДА ---
# Этот блок необходим, если JS-сниппет настраивается на стороне рекламодателя
# @app.get("/js/tracker.js", summary="Отдать клиентский JS-трекер")
# def get_tracker_script():
#     """
#     Этот эндпоинт работает как прокси, отдавая файл tracker.js.
#     Это делает скрипт first-party и защищает его от блокировщиков.
#     """
#     # Строим путь к файлу tracker.js относительно main.py
#     # (на 2 уровня вверх, затем в папку assets)
#     script_path = os.path.join(os.path.dirname(__file__), "..", "assets", "tracker.js")
#     if os.path.exists(script_path):
#         return FileResponse(script_path, media_type="application/javascript")
#     return {"error": "tracker.js not found"}, 404
# --- КОНЕЦ БЛОКА ---


app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
