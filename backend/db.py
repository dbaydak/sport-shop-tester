import json
import os
from pathlib import Path
from typing import List, Dict, Any
from dotenv import load_dotenv
import logging

# --- КОНФИГУРАЦИЯ И КОНСТАНТЫ ---

load_dotenv()

# Тестовые данные для симуляции банковской карты из .env файла
TEST_CARD_DATA = {
    "card_number": os.getenv("TEST_CARD_NUMBER"),
    "expiry_date": os.getenv("TEST_CARD_EXPIRY"),
    "cvv": os.getenv("TEST_CARD_CVV"),
    "owner_name": os.getenv("TEST_CARD_OWNER")
}

# --- ХРАНИЛИЩЕ ДАННЫХ: ТОВАРЫ ---

PRODUCTS_FILE_PATH = Path(__file__).parent / "products.json"

def load_products() -> List[Dict[str, Any]]:
    """Загружает каталог товаров из файла products.json."""
    try:
        with open(PRODUCTS_FILE_PATH, 'r', encoding='utf-8') as f:
            logging.info("Загрузка каталога товаров из products.json...")
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logging.error(f"Ошибка загрузки каталога товаров: {e}. Возвращается пустой список.")
        return []

PRODUCTS_DB = load_products()


# --- ХРАНИЛИЩЕ ДАННЫХ: ЗАПИСИ НА МЕРОПРИЯТИЯ ---

EVENT_REGISTRATIONS_FILE = Path(__file__).parent / "event_registrations.json"

def load_event_registrations() -> List[Dict[str, Any]]:
    """Загружает записи на мероприятия из файла."""
    if not EVENT_REGISTRATIONS_FILE.exists():
        return []
    try:
        with open(EVENT_REGISTRATIONS_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
            return json.loads(content) if content else []
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def save_event_registrations(registrations: List[Dict[str, Any]]):
    """Сохраняет записи на мероприятия в файл."""
    with open(EVENT_REGISTRATIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(registrations, f, indent=4, ensure_ascii=False, default=str)

EVENT_REGISTRATIONS_DB = load_event_registrations()


# --- ХРАНИЛИЩЕ ДАННЫХ: ТРАНЗАКЦИИ ---

TRANSACTIONS_FILE = Path(__file__).parent / "transactions.json"

def load_transactions() -> List[Dict[str, Any]]:
    """Загружает транзакции из файла."""
    if not TRANSACTIONS_FILE.exists():
        return []
    try:
        with open(TRANSACTIONS_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
            return json.loads(content) if content else []
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def save_transactions(transactions: List[Dict[str, Any]]):
    """Сохраняет транзакции в файл."""
    with open(TRANSACTIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(transactions, f, indent=4, ensure_ascii=False, default=str)

TRANSACTIONS_DB = load_transactions()
