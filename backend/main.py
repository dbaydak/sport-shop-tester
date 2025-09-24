import logging
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from backend import db
from backend.api import products, transactions, orders, events
from backend.admitad_postback_plugin import admitad_integration

# --- Настройка приложения и CORS ---
app = FastAPI(title="Sport Shop Test API")
origins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Подключаем все наши API-роутеры ---
app.include_router(products.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(admitad_integration.router, prefix="/s")


@app.get("/api/categories")
def get_categories():
    logging.info("Получение категорий")
    """
    Возвращает список всех уникальных категорий товаров.
    """
    # Убедитесь, что db импортирован: from backend import db
    all_products = db.PRODUCTS_DB
    logging.info(f"Всего продуктов: {len(all_products)}")
    if not all_products:
        logging.warning("База данных продуктов пуста")
        return []
    # Используем множество (set) для автоматического получения уникальных значений
    unique_categories = sorted(list({p['category'] for p in all_products}))
    logging.info(f"Найденные категории: {unique_categories}")
    return unique_categories


# --- ЯВНАЯ ОТДАЧА СТАТИЧЕСКИХ ФАЙЛОВ ---
# 1. Подключаем папку frontend как статику по пути /
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")
