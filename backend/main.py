from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter

from backend import db

# Импортируем все наши роутеры из папки api
from api import products, transactions, orders, events

# --- Настройка приложения и CORS ---
app = FastAPI(title="Sport Shop Test API")
origins = ["http://localhost", "http://127.0.0.1", "http://127.0.0.1:5500", "null"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
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

# Подключаем главный роутер к приложению
app.include_router(api_router)

@app.get("/", summary="Корневой эндпоинт для проверки работы")
def read_root():
    return {"message": "Welcome to the Sport Shop API"}


@app.get("/api/categories")
def get_categories():
    """
    Возвращает список всех уникальных категорий товаров.
    """
    # ИСПРАВЛЕНИЕ: Обращаемся напрямую к списку PRODUCTS_DB, а не к функции
    all_products = db.PRODUCTS_DB

    # Используем множество (set) для автоматического получения уникальных значений
    unique_categories = sorted(list({p['category'] for p in all_products}))
    return unique_categories
