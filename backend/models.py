from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime



class ProductInOrder(BaseModel):
    id: int
    name: str
    price: float
    quantity: int = Field(gt=0) # Количество должно быть > 0


class CardDetails(BaseModel):
    card_number: str
    expiry_date: str
    cvv: str
    owner_name: str


class Order(BaseModel):
    user_name: str
    user_email: EmailStr
    payment_method: str
    # Используем обновленную модель ProductInOrder
    items: List[ProductInOrder]
    total_amount: float
    card_details: Optional[CardDetails] = None


class EventRegistration(BaseModel):
    user_name: str
    user_email: EmailStr
    event_name: str


class Transaction(BaseModel):
    order_id: int
    transaction_id: Optional[int] = None # Будет None для оплаты наличными
    user_email: EmailStr
    amount: float
    payment_method: str
    timestamp: datetime
