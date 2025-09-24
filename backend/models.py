from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class OrderStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    SHIPPED = "shipped"
    CANCELED = "canceled"
    FAILED = "failed"


class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    EVENT_REGISTRATION = "event_registration"


class ProductInOrder(BaseModel):
    product_id: int  # Явное название поля
    sku: Optional[str] = None  # Артикул, очень распространённое поле
    name: str
    price: float
    quantity: int = Field(gt=0)


class CardDetails(BaseModel):
    card_number: str
    expiry_date: str
    cvv: str
    owner_name: str


class Order(BaseModel):
    order_id: Optional[int] = None  # ID заказа, если он уже создан
    status: OrderStatus = (
        OrderStatus.PENDING
    )  # Статус заказа, по умолчанию "в ожидании"
    user_name: str
    user_email: EmailStr
    payment_method: PaymentMethod  # <-- Используем Enum
    currency: str = "RUB"  # Валюта заказа
    items: List[ProductInOrder]
    total_amount: float
    card_details: Optional[CardDetails] = None
    admitad_uid: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)  # Время создания


class EventRegistration(BaseModel):
    user_name: str
    user_email: EmailStr
    event_name: str
    admitad_uid: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)


class Transaction(BaseModel):
    order_id: int
    transaction_id: Optional[str] = None  # ID от платёжной системы обычно строка
    status: OrderStatus = OrderStatus.PENDING  # Транзакция тоже имеет статус
    user_email: EmailStr
    amount: float
    payment_method: PaymentMethod  # <-- Использовать Enum, как в модели Order
    timestamp: datetime = Field(
        default_factory=datetime.now
    )  # <-- Использовать default_factory
    admitad_uid: Optional[str] = None
