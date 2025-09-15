// Файл: tracker.js
(function() {
    'use strict';

    // --- Настройки ---
    const UID_COOKIE_NAME = '_adm_aid';
    const DEDUPLICATION_COOKIE_NAME = '_last_source';
    const PID_COOKIE_NAME = '_pid';
    const COOKIE_LIFETIME_DAYS = 90;

    // --- Вспомогательные функции ---
    function setCookie(name, value, days) {
        if (typeof value === 'undefined' || value === null) return;
        let expires = '';
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = `; expires=${date.toUTCString()}`;
        }
        const domain = `; domain=.${window.location.hostname.replace(/^www\./i, '')}`;
        // Добавляем HttpOnly и SameSite=Lax для дополнительной защиты
        document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/; samesite=lax`;
}

    function getCookie(name) {
        const matches = document.cookie.match(new RegExp(`(?:\\s|\\b|^)${name}=([^;]+)(?:;|$)`));
        return matches ? decodeURIComponent(matches[1]) : null;
    }

    function deleteCookie(name) {
        setCookie(name, '', -1);
    }

    function getParamFromURL(paramName) {
        return new URLSearchParams(window.location.search).get(paramName);
    }

    function logError(message, details) {
        console.error(`[Admitad Tracker] ${message}`, details);
    }

    // --- Функция отправки данных на бэкенд ---
    async function track(type, data, items = []) {
        if (!data || !data.orderId || !data.orderAmount) {
            logError('Неверные или отсутствующие обязательные поля.', data);
            return;
        }

        const payload = {
            orderId: String(data.orderId),
            orderAmount: Number(data.orderAmount),
            paymentType: type,
            actionCode: data.actionCode || null,
            tariffCodes: data.tariffCodes || null,
            items: items.map(item => ({
                id: String(item.item_id || item.product_id || item.id),
                price: Number(item.price),
                quantity: Number(item.quantity),
                sku: item.sku || null
            }))
        };

        console.log('[Admitad Tracker] Отправка события на API-шлюз:', payload);

        try {
            const response = await fetch('/api/track-conversion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                logError('Сервер вернул ошибку при отправке события.', {
                    status: response.statusText
                });
            } else {
                console.log('[Admitad Tracker] Событие успешно отправлено на сервер.');
            }
        } catch (err) {
            logError('Ошибка сети при отправке события:', err.message);
        }
    }

    // --- Блок обработки событий из sessionStorage (для Data Layer) ---
    (function() {
        const pendingEvent = sessionStorage.getItem('dataLayerEvent');
        if (pendingEvent) {
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push(JSON.parse(pendingEvent));
            sessionStorage.removeItem('dataLayerEvent');
            console.log('[Admitad Tracker] Обнаружено и обработано событие из sessionStorage.');
        }
    })();

    // --- "Умный" слушатель Data Layer ---
    function processDataLayerEvent(event) {
        if (!event || typeof event !== 'object') return;

        if (event.event === 'purchase' && event.ecommerce) {
            const orderData = event.ecommerce;

            // 1. Получаем и СРАЗУ удаляем action_code, чтобы он был использован только один раз
            const actionCode = sessionStorage.getItem('admitad_action_code');
            if (actionCode) {
                sessionStorage.removeItem('admitad_action_code');
            }

            // 2. Получаем и СРАЗУ удаляем tariff_codes
            let tariffCodes = null;
            const tariffCodesRaw = sessionStorage.getItem('admitad_tariff_codes');
            if (tariffCodesRaw) {
                try {
                    tariffCodes = JSON.parse(tariffCodesRaw);
                    sessionStorage.removeItem('admitad_tariff_codes');
                } catch (e) {
                    logError("Ошибка парсинга tariff_codes из sessionStorage", e);
                }
            }

            console.log('[Admitad Tracker] Обнаружено событие "purchase". Запуск трекинга.');
            track('sale', {
                orderId: orderData.transaction_id,
                orderAmount: orderData.value,
                actionCode: actionCode,
                tariffCodes: tariffCodes
            }, orderData.items);
        }
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.forEach(processDataLayerEvent);
    const originalPush = window.dataLayer.push;
    window.dataLayer.push = function(event) {
        const result = originalPush.apply(this, arguments);
        processDataLayerEvent(event);
        return result;
    };

    // --- Атрибуция LAST CLICK ---
    function setDeduplicationCookie() {
        const params = new URLSearchParams(window.location.search);
        let source = params.get('utm_source');
        if (!source) {
            if (params.get('gclid')) {
                source = 'advAutoMarkup';
            } else if (params.get('fbclid')) {
                source = 'facebook';
            }
        }
        if (source) {
            setCookie(DEDUPLICATION_COOKIE_NAME, source, COOKIE_LIFETIME_DAYS);
            console.log(`[Admitad Tracker] Установлен/обновлён источник (${DEDUPLICATION_COOKIE_NAME}): ${source}`);
        }
    }

    // Установка cookies и логика атрибуции
    const admitadUidFromUrl = getParamFromURL('admitad_uid');
    if (admitadUidFromUrl) {
        setCookie(UID_COOKIE_NAME, admitadUidFromUrl, COOKIE_LIFETIME_DAYS);
    }

    const pidFromUrl = getParamFromURL('pid');
    if (pidFromUrl) {
        setCookie(PID_COOKIE_NAME, pidFromUrl, COOKIE_LIFETIME_DAYS);
    }

    setDeduplicationCookie(); // Учитываем последний клик для атрибуции

    console.log('[Admitad Tracker] Скрипт-слушатель Data Layer успешно инициализирован.');
    window.admitadTracker = { track };
})();
