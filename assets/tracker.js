// Файл: assets/tracker.js
(function() {
    'use strict';

    // --- Настройки ---
    const UID_COOKIE_NAME = 'admitad_aid';
    const DEDUPLICATION_COOKIE_NAME = 'deduplication_cookie';
    const COOKIE_LIFETIME_DAYS = 90;

    // --- Вспомогательные функции ---
    function setCookie(name, value, days) {
        if (!value) return;
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        const domain = "; domain=." + window.location.hostname.replace(/^www\./i, "");
        document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/" + domain;
    }

    function getParamFromURL(paramName) {
        const params = new URLSearchParams(window.location.search);
        return params.get(paramName);
    }

    function track(type, data, items = []) { // Принимаем items как новый аргумент
    const payload = {
        orderId: String(data.orderId),
        orderAmount: Number(data.orderAmount),
        paymentType: type,
        // Используем переданные items, а не getCart()
        items: items.map(item => ({
            id: String(item.item_id || item.product_id || item.id), // Поддерживаем оба формата
            price: Number(item.price),
            quantity: Number(item.quantity),
            sku: item.sku || null
        }))
    };

        console.log('[Admitad Tracker] Отправка события на API-шлюз:', payload);

        fetch('/api/track-conversion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (response.ok) {
                console.log('[Admitad Tracker] Событие успешно отправлено на сервер.');
            } else {
                console.error('[Admitad Tracker] Сервер вернул ошибку при отправке события.');
            }
        })
        .catch(error => {
            console.error('[Admitad Tracker] Ошибка сети при отправке события:', error);
        });
    }

// --- НОВЫЙ БЛОК: ПРОВЕРКА СОБЫТИЙ ИЗ SESSIONSTORAGE ---
(function() {
    const pendingEvent = sessionStorage.getItem('dataLayerEvent');
    if (pendingEvent) {
        // Если событие есть, добавляем его в dataLayer ТЕКУЩЕЙ страницы
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(JSON.parse(pendingEvent));
        // И сразу же удаляем, чтобы не отправить его повторно
        sessionStorage.removeItem('dataLayerEvent');
        console.log('[Admitad Tracker] Обнаружено и обработано событие из sessionStorage.');
    }
})();
// --- КОНЕЦ НОВОГО БЛОКА ---

    // --- НОВАЯ ЛОГИКА: УМНЫЙ СЛУШАТЕЛЬ DATA LAYER ---
function processDataLayerEvent(event) {
    if (!event || typeof event !== 'object') return;
    console.log('[Admitad Tracker] Обработка события из Data Layer:', event);

    // Если это событие покупки, обрабатываем его
    if (event.event === 'purchase' && event.ecommerce) {
        const orderData = event.ecommerce;
        console.log('[Admitad Tracker] Обнаружено событие "purchase". Запуск трекинга.');
        track('sale', {
            orderId: orderData.transaction_id,
            orderAmount: orderData.value
        }, orderData.items);
    }
}

// Инициализируем dataLayer, если его нет
window.dataLayer = window.dataLayer || [];

// --- Часть 1: Обрабатываем все события, которые УЖЕ есть в dataLayer ---
window.dataLayer.forEach(event => processDataLayerEvent(event));

// --- Часть 2: Начинаем слушать НОВЫЕ события, переопределяя push ---
const originalPush = window.dataLayer.push;
window.dataLayer.push = function(event) {
    const result = originalPush.apply(this, arguments); // Сначала выполняем оригинальный push
    processDataLayerEvent(event); // Затем обрабатываем новое событие
    return result;
};

    // --- Логика установки cookie (без изменений) ---
    const admitadUid = getParamFromURL('admitad_uid');
    if (admitadUid) {
        setCookie(UID_COOKIE_NAME, admitadUid, COOKIE_LIFETIME_DAYS);
    }

    let source;
    if (admitadUid) {
        source = 'admitad';
    } else {
        source = getParamFromURL('utm_source');
        if (!source) {
            if (getParamFromURL('gclid')) source = 'google';
            else if (getParamFromURL('fbclid')) source = 'facebook';
        }
    }
    if (source) {
        setCookie(DEDUPLICATION_COOKIE_NAME, source, COOKIE_LIFETIME_DAYS);
    }

    console.log('[Admitad Tracker] Скрипт-слушатель Data Layer успешно инициализирован.');

    // Оставляем глобальный объект на случай ручного вызова
    window.admitadTracker = { track };
})();
