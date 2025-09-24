// Файл: assets/int_loader.js
/**
 * @file Admitad Tracker Script
 * @version 2.0.0
 * @description Этот скрипт является клиентской частью трекинговой системы.
 * Его задачи:
 * 1. Отслеживать параметры визита (admitad_uid, utm_source и др.) при заходе на сайт.
 * 2. Передавать эти параметры на внутренний API для установки безопасных First-Party cookies.
 * 3. Слушать объект dataLayer на предмет события покупки ('purchase').
 * 4. Собирать данные о заказе и отправлять их на внутренний API для дальнейшей обработки.
 * 5. Обеспечивать гибкость за счет настраиваемого маппинга полей dataLayer.
 */

(function() {
    'use strict';

    // --- ⚙️ 1. ОБЪЕКТ КОНФИГУРАЦИИ ---
    // ЭТО ЕДИНСТВЕННЫЙ БЛОК, КОТОРЫЙ МОЖЕТ ПОТРЕБОВАТЬСЯ ОТРЕДАКТИРОВАТЬ.
    // Укажите здесь пути к данным в вашем объекте dataLayer.
    const dataLayerMapping = {
        // --- Основные поля заказа ---
        purchase_event_name: 'purchase', // Название события покупки в dataLayer
        transaction_id: 'ecommerce.transaction_id', // Путь к ID заказа
        order_value: 'ecommerce.value',             // Путь к общей сумме заказа
        currency: 'ecommerce.currency',             // Путь к валюте заказа
        items: 'ecommerce.items',                   // Путь к массиву товаров

        // --- Поля внутри одного товара ---
        item_id: 'item_id',                         // ID или артикул товара
        item_price: 'price',                        // Цена за единицу товара
        item_quantity: 'quantity',                  // Количество единиц товара
        item_sku: 'item_variant'                    // Артикул (SKU) товара, если есть
    };

    // --- 🛠️ 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

    /**
     * Безопасно извлекает вложенное значение из объекта по строковому пути.
     * @param {object} obj - Исходный объект (например, событие dataLayer).
     * @param {string} path - Путь к свойству (например, 'ecommerce.transaction_id').
     * @returns {*} - Найденное значение или undefined.
     */
    function getNestedValue(obj, path) {
        if (!path || !obj) return undefined;
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }

    /**
     * Извлекает GET-параметр из URL-адреса текущей страницы.
     * @param {string} paramName - Имя параметра.
     * @returns {string|null} - Значение параметра или null.
     */
    function getParamFromURL(paramName) {
        return new URLSearchParams(window.location.search).get(paramName);
    }

    /**
     * Стандартизированный логгер ошибок.
     * @param {string} message - Сообщение об ошибке.
     * @param {*} [details] - Дополнительные данные для вывода в консоль.
     */
    function logError(message, details) {
        console.error(`[Admitad Tracker] ${message}`, details || '');
    }

    // --- 📡 3. ОСНОВНАЯ ФУНКЦИЯ ТРЕКИНГА ---

    /**
     * Формирует и отправляет данные о конверсии на внутренний API-шлюз.
     * @param {string} type - Тип события (например, 'sale').
     * @param {object} data - Данные о заказе.
     * @param {Array} items - Массив товаров в заказе.
     * @returns {Promise<boolean>} - Возвращает true в случае успеха, false в случае неудачи.
     */
    async function track(type, data, items = []) {
        // Проверка наличия обязательного ID заказа.
        if (!data || !data.orderId) {
            logError('Отсутствует обязательное поле orderId для трекинга.', data);
            return false;
        }

        // Формирование тела запроса (payload) к API.
        // Все данные приводятся к строгим типам для надежности.
        const payload = {
            orderId: String(data.orderId),
            orderAmount: Number(data.orderAmount || 0),
            currency: data.currency || null,
            paymentType: type,
            promocode: data.promocode || null,
            actionCode: data.actionCode || null,
            tariffCodes: data.tariffCodes || null,
            items: items.map(item => ({
                id: String(item.id),
                price: Number(item.price),
                quantity: Number(item.quantity),
                sku: item.sku || null
            }))
        };

        console.log('[Admitad Tracker] Отправка события на API-шлюз:', payload);

        try {
            const response = await fetch('/s/track-conversion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // credentials: 'include' - критически важный параметр.
                // Он разрешает браузеру отправлять HttpOnly cookie, установленные сервером.
                credentials: 'include', // Обязательно для отправки HttpOnly cookies
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log('[Admitad Tracker] Событие успешно отправлено на сервер.');
                // 🔧 Надежность: удаляем данные из sessionStorage ТОЛЬКО после успешного ответа
                // Это предотвращает потерю данных при сбое сети.
                sessionStorage.removeItem('admitad_action_code');
                sessionStorage.removeItem('admitad_promocode');
                sessionStorage.removeItem('admitad_tariff_codes');
                return true;
            } else {
                logError('Сервер вернул ошибку при отправке события.', { status: response.status, statusText: response.statusText });
                return false;
            }
        } catch (err) {
            logError('Ошибка сети при отправке события:', err);
            return false;
        }
    }

    // --- 🔄 4. ОБРАБОТЧИК РЕДИРЕКТОВ (например, с платежных шлюзов) ---

    /**
     * Этот блок решает проблему потери dataLayer при редиректах (например, с внешних платежных шлюзов).
     * Если событие не удалось обработать до редиректа, оно сохраняется в sessionStorage,
     * а при возврате на сайт - извлекается и обрабатывается.
     */
    (function handleSessionStorageEvent() {
        const pendingEvent = sessionStorage.getItem('dataLayerEvent');
        if (pendingEvent) {
            try {
                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push(JSON.parse(pendingEvent));
                sessionStorage.removeItem('dataLayerEvent');
                console.log('[Admitad Tracker] Обнаружено и обработано отложенное событие из sessionStorage.');
            } catch (e) {
                logError("Ошибка парсинга dataLayerEvent из sessionStorage", e);
            }
        }
    })();

    // --- 🎧 5. "УМНЫЙ" СЛУШАТЕЛЬ DATA LAYER ---

    /**
     * Главная функция-обработчик, которая реагирует на события в dataLayer.
     * @param {object} event - Событие из dataLayer.
     */
    async function processDataLayerEvent(event) {
        // 1. Проверяем, что это событие покупки, указанное в конфигурации.
        if (!event || typeof event !== 'object' || event.event !== dataLayerMapping.purchase_event_name) {
            return;
        }

        // 2. Извлекаем ID заказа, используя гибкий маппинг. Если его нет - прекращаем работу.
        const orderId = getNestedValue(event, dataLayerMapping.transaction_id);
        if (!orderId) {
            // Если событие 'purchase', но без ID заказа, то игнорируем его.
            return;
        }

        console.log('[Admitad Tracker] Обнаружено событие "purchase". Запуск трекинга.');

        // 3. Извлекаем остальные данные о заказе и товарах через маппинг.
        const orderAmount = getNestedValue(event, dataLayerMapping.order_value);
        const currency = getNestedValue(event, dataLayerMapping.currency);
        const itemsData = getNestedValue(event, dataLayerMapping.items) || [];

        // 4. Получаем необязательные данные (промокод и др.) из sessionStorage.
        // Они могли быть установлены на предыдущих шагах воронки.
        const promocode = sessionStorage.getItem('admitad_promocode');
        const actionCode = sessionStorage.getItem('admitad_action_code');
        let tariffCodes = null;
        try {
            const tariffCodesRaw = sessionStorage.getItem('admitad_tariff_codes');
            if (tariffCodesRaw) {
                tariffCodes = JSON.parse(tariffCodesRaw);
            }
        } catch (e) {
            logError("Ошибка парсинга tariff_codes из sessionStorage", e);
        }

        // 5. Преобразуем массив товаров в стандартизированный формат.
        const items = itemsData.map(item => ({
            id: String(getNestedValue(item, dataLayerMapping.item_id)),
            price: Number(getNestedValue(item, dataLayerMapping.item_price)),
            quantity: Number(getNestedValue(item, dataLayerMapping.item_quantity)),
            sku: String(getNestedValue(item, dataLayerMapping.item_sku) || '')
        }));

        // 6. Вызываем основную функцию отправки данных.
        await track('sale', {
            orderId: orderId,
            orderAmount: orderAmount,
            currency: currency,
            promocode: promocode,
            actionCode: actionCode,
            tariffCodes: tariffCodes
        }, items);
    }

    // Инициализируем dataLayer, если его нет, и подписываемся на события.
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.forEach(event => processDataLayerEvent(event)); // Обрабатываем уже существующие события

    const originalPush = window.dataLayer.push;
    window.dataLayer.push = function(event) {
        // Перехватываем новые события
        processDataLayerEvent(event);
        return originalPush.apply(this, arguments);
    };


    // --- 🚀 6. ИНИЦИАЛИЗАЦИЯ СЕССИИ ТРЕКЕРА ---

    /**
     * Эта функция выполняется при каждой загрузке страницы.
     * Она собирает параметры из URL (admitad_uid, utm_source и т.д.) и отправляет их
     * на бэкенд для установки безопасных HttpOnly cookie.
     */
    async function initializeTrackerSession() {
        const params = {
            admitad_uid: getParamFromURL('admitad_uid'),
            pid: getParamFromURL('pid'),
            utm_source: getParamFromURL('utm_source'),
            gclid: getParamFromURL('gclid'),
            fbclid: getParamFromURL('fbclid')
        };

        // Отправляем запрос, только если в URL есть хотя бы один из отслеживаемых параметров.
        if (Object.values(params).some(p => p !== null)) {
            try {
                console.log('[Admitad Tracker] Инициализация сессии, отправка параметров на сервер:', params);
                await fetch('/s/init-tracking', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(params)
                });
            } catch (e) {
                logError("Не удалось инициализировать сессию трекера.", e);
            }
        }
    }

    // Запускаем инициализацию при каждой загрузке страницы
    initializeTrackerSession();

    // --- 🌐 7. ГЛОБАЛЬНЫЙ ДОСТУП ---

    // Делаем функцию track доступной глобально (window.admitadTracker.track(...)).
    // Это позволяет вызывать трекинг вручную из других скриптов, если это необходимо.
    window.admitadTracker = {
        track: track
    };

    console.log('[Admitad Tracker] Скрипт-слушатель успешно инициализирован.');

})();