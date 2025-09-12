from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter
from fastapi.staticfiles import StaticFiles

# Импортируем все наши роутеры из папки api
from backend.api import products, transactions, orders, events, admitad_integration

# --- Настройка приложения и CORS ---
app = FastAPI(title="Sport Shop Test API")
origins = [
    "http://localhost",
    "http://127.0.0.1",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "null"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Создание единого роутера /api для бизнес-логики ---
api_router = APIRouter(prefix="/api")
api_router.include_router(products.router)
api_router.include_router(transactions.router)
api_router.include_router(orders.router)
api_router.include_router(events.router)

# Подключаем главный роутер к приложению
app.include_router(api_router)

# --- Подключаем роутер для трекинга Admitad ---
# Этот роутер содержит эндпоинты /tracker.js и /api/track-conversion
app.include_router(admitad_integration.router)

# --- Обслуживание статических файлов фронтенда ---
# Эта строка должна быть в конце, после всех определений роутеров
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
