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

    function getCart() {
        return JSON.parse(localStorage.getItem('cart')) || [];
    }

    // --- Внутренняя функция для отправки данных на API-шлюз ---
    function track(type, data) {
        const cart = getCart();
        const payload = {
            orderId: String(data.orderId),
            orderAmount: Number(data.orderAmount),
            paymentType: type,
            items: cart.map(item => ({
                id: String(item.id),
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

    // --- "Умная" функция для автоматического отслеживания конверсии ---
    function autoTrackConversion() {
        const path = window.location.pathname;

        if (path.includes('confirmation.html')) {
            const orderDetails = JSON.parse(sessionStorage.getItem('lastOrderDetails'));
            if (orderDetails) {
                console.log('[Admitad Tracker] Обнаружена страница заказа. Отправка события "sale".');
                track('sale', {
                    orderId: orderDetails.order_id,
                    orderAmount: orderDetails.total_amount
                });
            }
        } else if (path.includes('event-confirmation.html')) {
            const regDetails = JSON.parse(sessionStorage.getItem('lastEventRegistration'));
            if (regDetails) {
                console.log('[Admitad Tracker] Обнаружена страница записи. Отправка события "lead".');
                track('lead', {
                    orderId: regDetails.registration_id,
                    orderAmount: 0
                });
            }
        }
    }

    // --- Логика, выполняемая при каждой загрузке скрипта ---
    const admitadUid = getParamFromURL('admitad_uid');
    if (admitadUid) {
        setCookie(UID_COOKIE_NAME, admitadUid, COOKIE_LIFETIME_DAYS);
    }

    let source = getParamFromURL('utm_source');
    if (!source) {
        if (getParamFromURL('gclid')) source = 'google';
        else if (getParamFromURL('fbclid')) source = 'facebook';
        else if (getParamFromURL('cjevent')) source = 'cj';
        else if (admitadUid) source = 'admitad';
    }

    if (source) {
        setCookie(DEDUPLICATION_COOKIE_NAME, source, COOKIE_LIFETIME_DAYS);
    }

    // Запускаем автоматическое отслеживание после загрузки страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoTrackConversion);
    } else {
        autoTrackConversion(); // Если DOM уже загружен
    }

    console.log('[Admitad Tracker] Скрипт успешно инициализирован (режим авто-трекинга).');

    // Оставляем глобальный объект на случай, если понадобится ручной вызов
    window.admitadTracker = { track };
})();
