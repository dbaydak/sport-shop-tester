import random
import math
import time
from datetime import datetime

from backend import db
from backend.models import Order, EventRegistration, Transaction, CardDetails
from backend.services import tracking_service


def process_new_order(order: Order) -> dict:
    """
    Полный цикл обработки нового заказа: проверка, симуляция оплаты,
    сохранение транзакции и вызов трекинга.
    """
    print("ЭМУЛЯЦИЯ: Начало обработки заказа, ждем 1 секунду...")
    time.sleep(1)
    # 1. Серверная валидация суммы
    server_total = sum(item.price * item.quantity for item in order.items)
    if not math.isclose(server_total, order.total_amount):
        raise ValueError("Сумма заказа не совпадает.")

    # 2. Симуляция банковской операции
    payment_result = {"status": "success"}
    if order.payment_method == "card":
        if not order.card_details:
            raise ValueError("Данные карты обязательны при онлайн-оплате.")
        payment_result = _simulate_bank_processing(order.card_details)
        if payment_result["status"] == "failed":
            raise ValueError(payment_result["reason"])

    # 3. Создание и сохранение транзакции
    order_id = random.randint(1000, 9999)
    transaction = _create_and_save_transaction(
        order_id=order_id,
        transaction_id=payment_result.get("transaction_id"),
        user_email=order.user_email,
        amount=server_total,
        payment_method=order.payment_method,
        admitad_uid=order.admitad_uid
    )

    # 4. Вызов сервиса трекинга
    tracking_service.send_postback_to_admitad(transaction)

    print(f"ИЗ СЕРВИСА: Новый заказ #{order_id} успешно обработан.")
    return {"order_id": order_id, "total_amount": server_total}


def process_event_registration(registration: EventRegistration) -> dict:
    """
    Полный цикл обработки записи на мероприятие.
    """
    print("ЭМУЛЯЦИЯ: Начало обработки записи, ждем 1 секунду...")
    time.sleep(1)
    registration_id = random.randint(10000, 99999)

    # Запись на мероприятие тоже является транзакцией (с нулевой суммой)
    transaction = _create_and_save_transaction(
        order_id=registration_id,
        user_email=registration.user_email,
        amount=0.0,
        payment_method="event_registration",
        admitad_uid=registration.admitad_uid
    )

    # Вызов сервиса трекинга
    tracking_service.send_postback_to_admitad(transaction)

    print(f"ИЗ СЕРВИСА: Новая запись #{registration_id} успешно обработана.")
    return {
        "registration_id": registration_id,
        "user_name": registration.user_name,
        "event_name": registration.event_name
    }


# --- Приватные вспомогательные функции, используемые только внутри этого сервиса ---

def _simulate_bank_processing(card: CardDetails) -> dict:
    is_valid = all(
        getattr(card, key) == value for key, value in db.TEST_CARD_DATA.items())
    if is_valid:
        return {"status": "success",
                "transaction_id": random.randint(100000, 999999)}
    return {"status": "failed", "reason": "Неверные данные карты."}


def _create_and_save_transaction(**kwargs) -> dict:
    """Создает, сохраняет транзакцию и возвращает ее в виде словаря."""
    if 'timestamp' not in kwargs:
        kwargs['timestamp'] = datetime.now()

    new_transaction = Transaction(**kwargs)
    transaction_dict = new_transaction.dict(exclude_none=True)

    db.TRANSACTIONS_DB.append(transaction_dict)
    db.save_transactions(db.TRANSACTIONS_DB)
    return transaction_dict
