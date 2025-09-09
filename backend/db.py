import json
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Тестовые данные для симуляции банковской карты
TEST_CARD_DATA = {
    "card_number": os.getenv("TEST_CARD_NUMBER"),
    "expiry_date": os.getenv("TEST_CARD_EXPIRY"),
    "cvv": os.getenv("TEST_CARD_CVV"),
    "owner_name": os.getenv("TEST_CARD_OWNER")
}

def load_products_from_json():
    """Загружает список товаров из JSON файла."""
    products_file = Path(__file__).parent / "products.json"
    with open(products_file, "r", encoding="utf-8") as f:
        return json.load(f)

PRODUCTS_DB = load_products_from_json()


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
