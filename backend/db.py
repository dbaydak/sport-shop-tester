import json
from pathlib import Path

# Тестовые данные для симуляции банковской карты
TEST_CARD_DATA = {
    "card_number": "1234567812345678",
    "expiry_date": "12/28",
    "cvv": "123",
    "owner_name": "IVAN IVANOV"
}

# Симуляция таблицы товаров в базе данных
PRODUCTS_DB = [
    {
        "id": 1,
        "name": "Беговые кроссовки ProRun",
        "category": "Обувь",
        "description": "Легкие и удобные кроссовки для профессионального бега.",
        "price": 8500.00
    },
    {
        "id": 2,
        "name": "Фитнес-трекер SmartBand 5",
        "category": "Гаджеты",
        "description": "Отслеживайте свою активность и пульс 24/7.",
        "price": 3200.00
    },
    {
        "id": 3,
        "name": "Футболка для тренировок DryFit",
        "category": "Одежда",
        "description": "Отводит влагу и сохраняет комфорт.",
        "price": 2500.00
    },
    {
        "id": 4,
        "name": "Бутылка для воды (750 мл)",
        "category": "Аксессуары",
        "description": "Эргономичная бутылка, не содержит BPA.",
        "price": 990.00
    },
    # Добавьте еще 15-16 товаров по аналогии
]

# Симуляция таблицы для записи на мероприятия
EVENT_REGISTRATIONS = []

TRANSACTIONS_FILE = Path(__file__).parent / "transactions.json"

def load_transactions() -> list:
    """Загружает транзакции из JSON файла при старте."""
    if TRANSACTIONS_FILE.exists():
        with open(TRANSACTIONS_FILE, "r", encoding="utf-8") as f:
            try:
                # Если файл пустой, json.load() выдаст ошибку, поэтому сначала читаем
                content = f.read()
                if not content:
                    return []
                return json.loads(content)
            except json.JSONDecodeError:
                return [] # Возвращаем пустой список, если файл поврежден
    return []

def save_transactions(transactions: list):
    """Сохраняет все транзакции в JSON файл."""
    with open(TRANSACTIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(transactions, f, indent=4, ensure_ascii=False, default=str)

# Загружаем данные при импорте модуля
TRANSACTIONS_DB = load_transactions()
