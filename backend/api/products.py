from fastapi import APIRouter, HTTPException
from typing import List, Optional
from backend import db

router = APIRouter()


def get_unique_categories() -> List[str]:
    """Вспомогательная функция для получения уникальных категорий из "базы данных"."""
    categories = set()
    for product in db.PRODUCTS_DB:
        categories.add(product["category"])
    return sorted(list(categories))


@router.get("/categories", summary="Получить список всех категорий товаров")
def get_categories():
    """Отдает отсортированный список уникальных категорий."""
    return get_unique_categories()


@router.get("/products", summary="Получить список товаров (с фильтрацией по категории)")
def get_products(category: Optional[str] = None):
    """
    Отдает список всех товаров.
    Если указан GET-параметр `category`, фильтрует товары по этой категории.
    """
    if category:
        # Возвращаем только товары из указанной категории
        filtered_products = [
            p for p in db.PRODUCTS_DB if p["category"].lower() == category.lower()
        ]
        return filtered_products
    # Если категория не указана, возвращаем все товары
    return db.PRODUCTS_DB


@router.get("/products/{product_id}", summary="Получить один товар по ID")
def get_product_by_id(product_id: int):
    """Находит и отдает один товар по его уникальному ID."""
    product = next((p for p in db.PRODUCTS_DB if p["id"] == product_id), None)
    if product:
        return product
    raise HTTPException(status_code=404, detail="Товар не найден")
