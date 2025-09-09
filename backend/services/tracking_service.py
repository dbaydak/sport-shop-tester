import requests

def send_postback_to_admitad(transaction: dict):
    """
    Отправляет Server-to-Server Postback-запрос.
    Эта функция отвечает только за отправку данных во внешнюю систему.
    """
    postback_url = "https://ad.admitad.com/r"
    params = {
        "order_id": transaction.get("order_id"),
        "postback_key": "ed2Dd5f96a1b1a762b712D87CE925C6f",
        "action_code": "5",
        "uid": "testlocal",
        "tariff_code": "1",
        "payment_type": "lead" if transaction.get("amount") == 0 else "sale",
        "price": transaction.get("amount"),
        "server_side_postback": "1"
    }

    try:
        print(f"ИЗ СЕРВИСА: Отправка S2S Postback с параметрами {params}")
        response = requests.get(postback_url, params=params, timeout=5)
        response.raise_for_status()
        print("ИЗ СЕРВИСА: S2S Postback успешно отправлен!")
    except requests.exceptions.RequestException as e:
        print(f"ОШИБКА СЕРВИСА: Не удалось отправить S2S Postback: {e}")
