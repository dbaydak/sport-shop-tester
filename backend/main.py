import logging
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from backend import db
from backend.api import products, transactions, orders, events, admitad_integration

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
app.include_router(products.router)
app.include_router(transactions.router)
app.include_router(orders.router)
app.include_router(events.router)
app.include_router(admitad_integration.router)


@app.get("/api/categories")
def get_categories():
    """
    Возвращает список всех уникальных категорий товаров.
    """
    # Убедитесь, что db импортирован: from backend import db
    all_products = db.PRODUCTS_DB
    # Используем множество (set) для автоматического получения уникальных значений
    unique_categories = sorted(list({p['category'] for p in all_products}))
    return unique_categories


# --- ЯВНАЯ ОТДАЧА СТАТИЧЕСКИХ ФАЙЛОВ ---
# 1. Подключаем папку frontend как статику по пути /
app.mount("/", StaticFiles(directory="frontend"), name="static")

# 2. Создаём явный обработчик для корневого маршрута, который отдаёт index.html
@app.get("/", include_in_schema=False)
async def read_index():
    return FileResponse('frontend/index.html')

# 3. Добавляем "catch-all" обработчик, чтобы любая другая страница
#    (например, /checkout.html) также возвращала свой HTML-файл.
@app.get("/{full_path:path}", include_in_schema=False)
async def read_catch_all(request: Request, full_path: str):
    # Пытаемся найти файл. Если его нет, FastAPI вернёт 404.
    return FileResponse(f'frontend/{full_path}')

