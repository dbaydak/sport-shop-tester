from fastapi import APIRouter
from backend import db

router = APIRouter()

@router.get("/transactions", summary="Получить список всех транзакций")
def get_transactions():
    return db.TRANSACTIONS_DB
