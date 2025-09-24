/**
 * @file Admitad Universal Tracker Script
 * @version 3.1.0
 * @description Этот скрипт является универсальной клиентской частью трекинговой системы Admitad.
 * Его задачи:
 * 1. Отслеживать параметры визита (admitad_uid и др.) и передавать их на серверный шлюз для установки First-Party cookie.
 * 2. Обеспечивать гибкую настройку под любую структуру dataLayer.
 * 3. Поддерживать несколько имён для события покупки (например, 'purchase', 'paid_order').
 * 4. Предоставлять альтернативный ("активный") режим работы для сайтов без dataLayer через ручной вызов.
 * 5. Приоритетно рассчитывать сумму заказа по товарам, а не по общей сумме, для максимальной точности.
 * 6. Использовать sessionStorage для надёжной передачи дополнительных данных и как "страховку" при редиректах, с возможностью полного отключения этой функции.
 * 7. Работать в изолированном пространстве имён в sessionStorage (с префиксами), чтобы не конфликтовать с другими скриптами.
 */

(function() {
    'use strict';

    // ===================================================================
    // --- ⚙️ 1. КОНФИГУРАЦИЯ ТРЕКЕРА ---
    // ЭТО ЕДИНСТВЕННЫЙ БЛОК, КОТОРЫЙ МОЖЕТ ПОТРЕБОВАТЬСЯ ОТРЕДАКТИРОВАТЬ.
    // ===================================================================

    /**
     * @description Основные настройки работы трекера.
     */
    const trackerConfig = {
        /**
         * Поставьте false, чтобы полностью отключить использование sessionStorage.
         * В этом режиме трекер будет полагаться ИСКЛЮЧИТЕЛЬНО на данные из dataLayer
         * или на данные из ручного вызова triggerPurchase().
         * ВАЖНО: При значении false перестает работать "страховка" от потери dataLayer
         * при редиректах с внешних платежных систем.
         */
        USE_SESSION_STORAGE: false,
        /**
         * Поставьте true, чтобы включить подробные логи в консоли.
         * На рабочем сайте рекомендуется ставить false.
         * Можно также активировать, добавив в URL параметр ?admitad_debug=true
         */
        DEBUG_MODE: false
    };

    // Динамическое включение DEBUG_MODE через URL-параметр
    if (new URLSearchParams(window.location.search).has('admitad_debug')) {
        trackerConfig.DEBUG_MODE = true;
    }

    /**
     * @description Маппинг полей для dataLayer. Укажите здесь пути к данным
     * в вашем объекте dataLayer, если они отличаются от стандартных.
     */
    const dataLayerMapping = {
        // --- Основные поля заказа ---
        // Укажите одно или несколько имён событий, которые должны считаться покупкой.
        purchase_event_names: ['purchase', 'paid_order', 'generate_lead'],
        transaction_id: 'ecommerce.transaction_id', // Путь к ID заказа
        order_value: 'ecommerce.value',             // Путь к ОБЩЕЙ сумме заказа (используется как fallback)
        currency: 'ecommerce.currency',             // Путь к валюте заказа
        items: 'ecommerce.items',                   // Путь к массиву товаров

        // --- Поля внутри одного товара ---
        item_id: 'item_id',                         // ID или артикул товара
        item_price: 'price',                        // Цена за единицу товара
        item_quantity: 'quantity',                  // Количество единиц товара
        item_sku: 'item_variant'                    // Артикул (SKU) товара, если есть
    };

    /**
     * @description Кастомный источник данных.
     * Используйте этот объект, если на вашем сайте нет dataLayer.
     * Вам нужно будет переопределить эти функции на странице подтверждения заказа
     * и затем вызвать window.admitadTracker.triggerPurchase().
     */
    const customDataSource = {
        getOrderId: null,      // Пример: () => window.myOrder.id
        getOrderAmount: null,  // Пример: () => window.myOrder.total
        getCurrency: null,     // Пример: () => "RUB"
        getItems: null         // Пример: () => window.myOrder.items
    };
    // ===================================================================


    let isConversionSent = false; // Флаг, чтобы избежать двойной отправки конверсии.

    // --- 🛠️ 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

    /**
     * Логгер для режима отладки.
     * @param {string} message - Сообщение для вывода.
     * @param {*} [details] - Дополнительные данные.
     */
    function logDebug(message, details) {
        // Проверяем флаг в конфигурации
        if (trackerConfig.DEBUG_MODE) {
            console.log(`[Admitracker DEBUG] ${message}`, details || '');
        }
    }

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
        console.error(`[Admitracker] ${message}`, details || '');
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
        if (!data || !data.orderId) {
            logError('Отсутствует обязательное поле orderId для трекинга.', data);
            return false;
        }
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
        logDebug('[Admitracker] Отправка события на API-шлюз:', payload);
        try {
            const response = await fetch('/s/track-conversion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                console.log('[Admitracker] Событие успешно отправлено на сервер.');
                if (trackerConfig.USE_SESSION_STORAGE) {
                    sessionStorage.removeItem('adt_action_code');
                    sessionStorage.removeItem('adt_promocode');
                    sessionStorage.removeItem('adt_tariff_codes');
                }
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

    // --- 🔄 4. ОБРАБОТЧИК РЕДИРЕКТОВ ---

    /**
     * Этот блок решает проблему потери dataLayer при редиректах (например, с внешних платежных шлюзов).
     * Если событие не удалось обработать до редиректа, оно сохраняется в sessionStorage,
     * а при возврате на сайт - извлекается и обрабатывается.
     */
    if (trackerConfig.USE_SESSION_STORAGE) {
        (function handleSessionStorageEvent() {
            const pendingEvent = sessionStorage.getItem('adt_dataLayerEvent');
            if (pendingEvent) {
                try {
                    window.dataLayer = window.dataLayer || [];
                    window.dataLayer.push(JSON.parse(pendingEvent));
                    sessionStorage.removeItem('adt_dataLayerEvent');
                    logDebug('[Admitracker] Обнаружено и обработано отложенное событие из sessionStorage.');
                } catch (e) {
                    logError("Ошибка парсинга dataLayerEvent из sessionStorage", e);
                }
            }
        })();
    }


    // --- 💡 5. ЦЕНТРАЛЬНЫЙ ОБРАБОТЧИК КОНВЕРСИИ ---

    /**
     * Центральная функция, которая обрабатывает данные о конверсии,
     * полученные из любого источника (dataLayer или кастомный вызов).
     * @param {object} data - Объект с данными о заказе.
     */
    async function processConversionData(data) {
        if (isConversionSent) {
            logDebug('[Admitracker] Конверсия уже была отправлена. Повторная отправка отменена.');
            return;
        }
        if (!data || !data.orderId) {
            logError('Отсутствует обязательное поле orderId для трекинга.', data);
            return;
        }

        isConversionSent = true;
        logDebug('[Admitracker] Запуск трекинга конверсии.', data);

        let promocode = null;
        let actionCode = null;
        let tariffCodes = null;

        if (trackerConfig.USE_SESSION_STORAGE) {
            promocode = sessionStorage.getItem('adt_promocode');
            actionCode = sessionStorage.getItem('adt_action_code');
            try {
                const tariffCodesRaw = sessionStorage.getItem('adt_tariff_codes');
                if (tariffCodesRaw) {
                    tariffCodes = JSON.parse(tariffCodesRaw);
                }
            } catch (e) { logError("Ошибка парсинга tariff_codes", e); }
        }

        const paymentType = ['purchase', 'paid_order'].includes(data.eventType) ? 'sale' : 'lead';

        await track(paymentType, {
            orderId: data.orderId,
            orderAmount: data.orderAmount,
            currency: data.currency,
            promocode: promocode,
            actionCode: actionCode,
            tariffCodes: tariffCodes
        }, data.items || []);
    }


    // --- 🎧 6. СЛУШАТЕЛЬ DATA LAYER ---

    /**
     * Главная функция-обработчик, которая реагирует на события в dataLayer.
     * @param {object} event - Событие из dataLayer.
     */
    async function processDataLayerEvent(event) {
        const purchaseEvents = dataLayerMapping.purchase_event_names || dataLayerMapping.purchase_event_name;
        const validEventNames = Array.isArray(purchaseEvents) ? purchaseEvents : [purchaseEvents];

        if (!event || typeof event !== 'object' || !event.event || !validEventNames.includes(event.event)) {
            return;
        }

        const orderId = getNestedValue(event, dataLayerMapping.transaction_id);
        if (!orderId) { return; }

        logDebug(`[Admitracker] Обнаружено событие покупки "${event.event}" в dataLayer.`);

        const itemsData = getNestedValue(event, dataLayerMapping.items) || [];
        let finalOrderAmount;

        // Приоритетный способ: считаем сумму по товарам.
        if (Array.isArray(itemsData) && itemsData.length > 0) {
            const totalFromItems = itemsData.reduce((sum, item) => {
                const price = Number(getNestedValue(item, dataLayerMapping.item_price) || 0);
                const quantity = Number(getNestedValue(item, dataLayerMapping.item_quantity) || 1);
                if (!isNaN(price) && !isNaN(quantity)) {
                    return sum + (price * quantity);
                }
                return sum;
            }, 0);

            if (totalFromItems > 0) {
                finalOrderAmount = totalFromItems;
                logDebug('[Admitracker] Сумма заказа рассчитана по товарам (items):', finalOrderAmount);
            }
        }

        // Fallback: если по товарам посчитать не удалось, берем общую сумму.
        if (typeof finalOrderAmount === 'undefined') {
            finalOrderAmount = Number(getNestedValue(event, dataLayerMapping.order_value) || 0);
            logDebug('[Admitracker] Сумма заказа взята из общего поля (ecommerce.value):', finalOrderAmount);
        }

        const currency = getNestedValue(event, dataLayerMapping.currency);
        const items = itemsData.map(item => ({
            id: String(getNestedValue(item, dataLayerMapping.item_id)),
            price: Number(getNestedValue(item, dataLayerMapping.item_price)),
            quantity: Number(getNestedValue(item, dataLayerMapping.item_quantity)),
            sku: String(getNestedValue(item, dataLayerMapping.item_sku) || '')
        }));

        processConversionData({
            orderId: orderId,
            orderAmount: finalOrderAmount,
            currency: currency,
            items: items,
            eventType: event.event
        });
    }

    // Инициализация и подписка на dataLayer
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.forEach(event => processDataLayerEvent(event));
    const originalPush = window.dataLayer.push;
    window.dataLayer.push = function(event) {
        processDataLayerEvent(event);
        return originalPush.apply(this, arguments);
    };

    // --- 🚀 7. ИНИЦИАЛИЗАЦИЯ СЕССИИ ТРЕКЕРА ---

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
        if (Object.values(params).some(p => p !== null)) {
            try {
                logDebug('[Admitracker] Инициализация сессии, отправка параметров на сервер:', params);
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
    initializeTrackerSession();

    // --- 🌐 8. ГЛОБАЛЬНЫЙ ДОСТУП ---

    /**
     * Делаем ключевые функции доступными глобально через window.admitadTracker.
     * Это позволяет вызывать трекинг вручную из других скриптов.
     */
    window.admitadTracker = {
        /**
         * Позволяет настроить кастомный источник данных.
         * @param {object} customConfig - Объект с функциями для получения данных.
         */
        configure: function(customConfig) {
            Object.assign(customDataSource, customConfig);
        },
        /**
         * Запускает трекинг, используя данные из кастомного источника.
         */
        triggerPurchase: function() {
            logDebug('[Admitracker] Ручной вызов triggerPurchase().');
            const data = {
                orderId: customDataSource.getOrderId ? customDataSource.getOrderId() : null,
                orderAmount: customDataSource.getOrderAmount ? customDataSource.getOrderAmount() : 0,
                currency: customDataSource.getCurrency ? customDataSource.getCurrency() : null,
                items: customDataSource.getItems ? customDataSource.getItems() : []
            };
            processConversionData(data);
        },
        /**
         * Прямой вызов функции трекинга (для продвинутого использования).
         */
        track: track
    };

    console.log('[Admitracker] Скрипт-слушатель успешно инициализирован.');

})();