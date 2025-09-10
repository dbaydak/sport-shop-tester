// --- ГЛОБАЛЬНЫЙ СКРИПТ ДЛЯ ТРЕКИНГА (выполняется на каждой странице) ---
/*
(function() {
    // --- НАСТРОЙКИ ---
    const DEDUPLICATION_COOKIE_NAME = 'deduplication_cookie'; // Имя cookie для источника
    const UID_COOKIE_NAME = 'admitad_aid'; // Имя cookie для ID Admitad
    const COOKIE_LIFETIME_DAYS = 90; // Время жизни cookie в днях
    // Устанавливает cookie с заданным именем, значением и сроком жизни.
    function setCookie(name, value, days) {
        if (!value) return; // Не устанавливаем пустые cookie
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        const domain = "; domain=." + window.location.hostname.replace(/^www\./i, "");
        document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/" + domain;
    }
    // Получает значение параметра из URL.
    function getParamFromURL(paramName) {
        const params = new URLSearchParams(window.location.search);
        return params.get(paramName);
    }
    // --- ОСНОВНАЯ ЛОГИКА ---
    // 1. Установка cookie для admitad_uid
    const admitadUid = getParamFromURL('admitad_uid');
    setCookie(UID_COOKIE_NAME, admitadUid, COOKIE_LIFETIME_DAYS);
    // 2. Установка cookie для источника трафика (дедупликация)
    let source = getParamFromURL('utm_source');
    if (!source) {
        if (getParamFromURL('gclid')) source = 'google';
        else if (getParamFromURL('fbclid')) source = 'facebook';
        else if (getParamFromURL('cjevent')) source = 'cj';
    }
    setCookie(DEDUPLICATION_COOKIE_NAME, source, COOKIE_LIFETIME_DAYS);
})();
// --- КОНЕЦ ГЛОБАЛЬНОГО СКРИПТА ДЛЯ ТРЕКИНГА ---
*/

// Финальная версия файла: assets/tracker.js
(function() {
    'use strict';

    // --- Настройки ---
    const UID_COOKIE_NAME = 'admitad_aid';
    const DEDUPLICATION_COOKIE_NAME = 'deduplication_adm';
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

    // --- Логика при загрузке скрипта ---
    const params = new URLSearchParams(window.location.search);
    const admitadUid = params.get('admitad_uid');
    if (admitadUid) {
        setCookie(UID_COOKIE_NAME, admitadUid, COOKIE_LIFETIME_DAYS);
    }
    let source = getParamFromURL('utm_source');
    if (!source) {
        if (getParamFromURL('gclid')) source = 'google';
        else if (getParamFromURL('fbclid')) source = 'facebook';
        else if (getParamFromURL('cjevent')) source = 'cj';
    }
    if (source) {
        setCookie(DEDUPLICATION_COOKIE_NAME, source, COOKIE_LIFETIME_DAYS);
    }

    // --- Создаём глобальный объект трекера ---
    window.admitadTracker = {
        track: function(type, data) {
            // --- ЛОГИКА ОТПРАВКИ FETCH-ЗАПРОСА ---
            const payload = {
                orderId: String(data.orderId),
                orderAmount: Number(data.orderAmount),
                paymentType: type // 'sale' или 'lead'
            };

            console.log('[Admitad Tracker] Отправка события на API-шлюз:', payload);

            // Отправляем запрос на ВАШ API-шлюз
            fetch('/api/track-conversion', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                // credentials: 'include' ВАЖНО: эта опция гарантирует,
                // что браузер отправит cookie (включая admitad_aid) вместе с запросом
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
    };

    console.log('[Admitad Tracker] Скрипт успешно инициализирован.');
})();

// Global constant for the backend URL
const API_URL = 'http://127.0.0.1:8000/api';

/**
 * Main handler that runs after the HTML page is fully loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Render shared components like the header
    renderHeader();

    // Attach page-specific logic
    if (document.getElementById('categories-container')) loadCategories();
    if (document.getElementById('products-list-container')) loadProductsByCategory();
    if (document.getElementById('product-detail-container')) loadProductDetails();
    if (document.getElementById('event-form-container')) setupEventForm();
    if (document.getElementById('cart-page-items')) displayCartPage();
    if (document.getElementById('checkout-form')) displayCheckoutPage();
    if (document.getElementById('confirmation-details')) displayConfirmationDetails();
    if (document.getElementById('event-confirmation-details')) displayEventConfirmation();
    if (document.getElementById('transactions-container')) loadTransactions();

    updateCartCountAndTotal();
});

function getCookie(name) {
    const matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : null;
}

/**
 * Вспомогательная функция для запуска трекинг-пикселя.
 * @param {string|number} orderId - ID заказа или записи.
 * @param {number} orderAmount - Сумма заказа.
 * @param {string} paymentType - 'sale' для покупки, 'lead' для записи.
 */
function fireTrackingPixel(details) {
    const { orderId, orderAmount, paymentType } = details;
    const admitadUid = getCookie('admitad_aid');

    if (!admitadUid) {
        console.warn('Admitad UID не найден, пиксель не отправляется.');
        return;
    }

    const channel = getCookie('deduplication_cookie') || 'direct';
    console.log(`Запуск пикселя: ID=${orderId}, Сумма=${orderAmount}, UID=${admitadUid}, Канал=${channel}`);

    const pixel = new Image();
    pixel.src = `https://ad.admitad.com/tt?order_id=${orderId}&campaign_code=8817907101&action_code=5&uid=${admitadUid}&tariff_code=1&payment_type=${paymentType}&price=${orderAmount}&channel=${channel}&rt=img&adm_method=imgpixel`;
    pixel.style.display = 'none';
    document.body.appendChild(pixel);
}

/**
 * Отображает детали заказа и вызывает трекинг-пиксель.
 */
/**
 * Configures the event registration form.
 */
function setupEventForm() {
    // --- ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ: Слушаем КЛИК напрямую по КНОПКЕ ---
    const submitBtn = document.getElementById('submit-event-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', handleEventForm);
    }
    // --- КОНЕЦ ФИНАЛЬНОГО ИСПРАВЛЕНИЯ ---
}
// ====================================================================
// --- NEW: Page Initializers for Categories & Products ---
// ====================================================================
async function loadCategories() {
    const container = document.getElementById('categories-container');
    try {
        const response = await fetch(`${API_URL}/categories`);
        if (!response.ok) throw new Error('Network response was not ok');
        const categories = await response.json();
        container.innerHTML = '';
        categories.forEach(category => {
            const categoryCard = document.createElement('a');
            categoryCard.href = `products.html?category=${encodeURIComponent(category)}`;
            categoryCard.className = 'category-card';
            categoryCard.innerHTML = `<img src="https://placehold.co/400x250/EFEFEF/333333?text=${encodeURIComponent(category)}" alt="${category}"><h3>${category}</h3>`;
            container.appendChild(categoryCard);
        });
    } catch (error) { container.innerHTML = `<p class="error-message">Не удалось загрузить категории.</p>`; }
}
async function loadProductsByCategory() {
    const container = document.getElementById('products-list-container');
    const title = document.getElementById('category-title');
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');
    if (!category) { title.textContent = 'Категория не выбрана'; container.innerHTML = ''; return; }
    title.textContent = `Товары в категории: ${category}`;
    try {
        const response = await fetch(`${API_URL}/products?category=${encodeURIComponent(category)}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const products = await response.json();
        container.innerHTML = '';
        if (products.length === 0) { container.innerHTML = '<p>В этой категории пока нет товаров.</p>'; return; }
        products.forEach(product => { container.appendChild(createProductCard(product)); });
    } catch (error) { container.innerHTML = `<p class="error-message">Не удалось загрузить товары.</p>`; }
}
async function loadProductDetails() {
    const container = document.getElementById('product-detail-container');
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');
    if (!productId) { container.innerHTML = `<p class="error-message">ID товара не указан.</p>`; return; }
    try {
        const response = await fetch(`${API_URL}/products/${productId}`);
        if (!response.ok) throw new Error('Товар не найден');
        const product = await response.json();
        document.title = `${product.name} - Тестовый Магазин`;
        container.innerHTML = `<div class="product-detail-image"><img src="https://placehold.co/600x400/EFEFEF/333333?text=${encodeURIComponent(product.name)}" alt="${product.name}"></div><div class="product-detail-info form-card"><h2>${product.name}</h2><p class="product-category">${product.category}</p><p>${product.description}</p><div class="product-price"><strong>${product.price.toFixed(2)} руб.</strong></div><div class="product-controls"><input type="number" id="quantity-${product.id}" value="1" min="1" class="quantity-input"><button id="add-to-cart-btn" class="button">В корзину</button></div></div>`;
        document.getElementById('add-to-cart-btn').onclick = () => { addToCart(product.id, product.name, product.price); };
    } catch (error) { container.innerHTML = `<p class="error-message">${error.message}.</p>`; }
}
function createProductCard(product) {
    const cardLink = document.createElement('a');
    cardLink.href = `product-detail.html?id=${product.id}`;
    cardLink.className = 'product-card-link';
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `<img src="https://placehold.co/300x200/EFEFEF/333333?text=${encodeURIComponent(product.category)}" alt="${product.name}" class="product-image"><h3>${product.name}</h3><div class="product-price"><strong>${product.price.toFixed(2)} руб.</strong></div>`;
    cardLink.appendChild(card);
    return cardLink;
}
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('show'); }, 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => { document.body.removeChild(toast); }, 500); }, 3000);
}
function showConfirmModal(title, question) {
    return new Promise(resolve => {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.innerHTML = `<div class="modal"><h3>${title}</h3><p>${question}</p><div class="modal-buttons"><button id="confirm-yes" class="button button-primary">Да</button><button id="confirm-no" class="button">Отмена</button></div></div>`;
        const closeModal = (result) => { document.body.removeChild(modalOverlay); resolve(result); };
        modalOverlay.querySelector('#confirm-yes').onclick = () => closeModal(true);
        modalOverlay.querySelector('#confirm-no').onclick = () => closeModal(false);
        document.body.appendChild(modalOverlay);
    });
}
function getCart() { return JSON.parse(localStorage.getItem('cart')) || []; }
function saveCart(cart) { localStorage.setItem('cart', JSON.stringify(cart)); updateCartCountAndTotal(); }
function updateCartCountAndTotal() {
    const cart = getCart();
    const cartCountEl = document.getElementById('cart-count');
    const cartTotalEl = document.getElementById('cart-total');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (cartCountEl) cartCountEl.textContent = totalItems;
    if (cartTotalEl) cartTotalEl.textContent = totalPrice.toFixed(2);
}
function addToCart(id, name, price) {
    const quantityInput = document.querySelector(`#quantity-${id}`);
    const quantity = parseInt(quantityInput.value, 10);
    if (isNaN(quantity) || quantity <= 0) { showToast('Выберите корректное количество.', 'error'); return; }
    const cart = getCart();
    const existingProduct = cart.find(item => item.id === id);
    if (existingProduct) { existingProduct.quantity += quantity; } else { cart.push({ id, name, price, quantity }); }
    saveCart(cart);
    showToast(`"${name}" (x${quantity}) добавлен в корзину!`);
    quantityInput.value = 1;
}
function updateQuantity(id, change) {
    const cart = getCart();
    const product = cart.find(item => item.id === id);
    if (product) {
        product.quantity += change;
        if (product.quantity <= 0) { removeFromCart(id); } else { saveCart(cart); displayCartPage(); }
    }
}
function removeFromCart(id) { let cart = getCart(); cart = cart.filter(item => item.id !== id); saveCart(cart); displayCartPage(); }
async function clearCart() {
    const confirmed = await showConfirmModal('Очистка корзины', 'Вы уверены, что хотите удалить все товары?');
    if (confirmed) { saveCart([]); if (document.getElementById('cart-page-items')) displayCartPage(); }
}
function displayCartPage() {
    const cart = getCart();
    const itemsContainer = document.getElementById('cart-page-items');
    const totalAmountEl = document.getElementById('cart-page-total');
    const emptyCartMsg = document.getElementById('empty-cart-message');
    const cartActions = document.getElementById('cart-actions');
    if (!itemsContainer) return;
    itemsContainer.innerHTML = '';
    if (cart.length === 0) {
        if (emptyCartMsg) emptyCartMsg.classList.remove('hidden');
        if (cartActions) cartActions.classList.add('hidden');
    } else {
        if (emptyCartMsg) emptyCartMsg.classList.add('hidden');
        if (cartActions) cartActions.classList.remove('hidden');
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        cart.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'cart-item';
            itemEl.innerHTML = `<div class="cart-item-info"><h4>${item.name}</h4><span>${item.price.toFixed(2)} руб. x ${item.quantity} = <strong>${(item.price * item.quantity).toFixed(2)} руб.</strong></span></div><div class="cart-item-controls"><button class="quantity-btn" onclick="updateQuantity(${item.id}, -1)">-</button><span class="quantity-display">${item.quantity}</span><button class="quantity-btn" onclick="updateQuantity(${item.id}, 1)">+</button><button class="button-danger" onclick="removeFromCart(${item.id})">Удалить</button></div>`;
            itemsContainer.appendChild(itemEl);
        });
        if (totalAmountEl) totalAmountEl.textContent = total.toFixed(2);
    }
}
function displayCheckoutPage() {
    // --- Отрисовка корзины (оставляем как есть, всё работает) ---
    const cart = getCart();
    const itemsSummaryContainer = document.getElementById('cart-items-summary');
    const totalAmountEl = document.getElementById('summary-total-amount');
    if (itemsSummaryContainer) {
        itemsSummaryContainer.innerHTML = '';
        if (cart.length === 0) {
            itemsSummaryContainer.innerHTML = '<p>Ваша корзина пуста.</p>';
        } else {
            let total = 0;
            cart.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'summary-item';
                itemEl.innerHTML = `<span>${item.name} (x${item.quantity})</span><span>${(item.price * item.quantity).toFixed(2)} руб.</span>`;
                itemsSummaryContainer.appendChild(itemEl);
                total += item.price * item.quantity;
            });
            if (totalAmountEl) {
                totalAmountEl.textContent = total.toFixed(2);
            }
        }
    }

    // --- ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ: Слушаем КЛИК напрямую по КНОПКЕ ---
    const submitBtn = document.getElementById('submit-order-btn');
    if (submitBtn) {
        // Убрали 'submit' с формы, слушаем 'click' на кнопке
        submitBtn.addEventListener('click', handleCheckoutForm);
    }
    // --- КОНЕЦ ФИНАЛЬНОГО ИСПРАВЛЕНИЯ ---

    // --- Логика выбора оплаты (оставляем как есть) ---
    const paymentRadios = document.querySelectorAll('input[name="payment"]');
    const cardDetailsForm = document.getElementById('card-details-form');
    paymentRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'card' && radio.checked) {
                cardDetailsForm.classList.remove('hidden');
            } else {
                cardDetailsForm.classList.add('hidden');
            }
        });
    });
}
function handleCheckoutForm(e) {
    e.preventDefault();
    console.log("НАЧАТА ОТПРАВКА ФОРМЫ (новый, стабильный обработчик)...");

    const statusEl = document.getElementById('checkout-status');
    const submitBtn = document.getElementById('submit-order-btn');
    statusEl.textContent = 'Обрабатываем ваш заказ...';
    submitBtn.disabled = true;

    const cart = getCart();
    if (cart.length === 0) {
        statusEl.textContent = 'Ваша корзина пуста.';
        submitBtn.disabled = false;
        return;
    }
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const orderData = {
        user_name: document.getElementById('user-name').value,
        user_email: document.getElementById('user-email').value,
        payment_method: document.querySelector('input[name="payment"]:checked').value,
        items: cart,
        total_amount: totalAmount,
        card_details: null,
        admitad_uid: getCookie('admitad_aid'),
        deduplication_source: getCookie('deduplication_cookie')
    };
    if (orderData.payment_method === 'card') {
        orderData.card_details = {
            card_number: document.getElementById('card-number').value,
            expiry_date: document.getElementById('expiry-date').value,
            cvv: document.getElementById('cvv').value,
            owner_name: document.getElementById('owner-name').value
        };
    }

    // --- ЯВНАЯ ЦЕПОЧКА ПРОМИСОВ ---
    fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
    })
    .then(response => {
        // Шаг A: Проверяем, успешен ли ответ. Если нет - проваливаемся в .catch
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.detail || 'Неизвестная ошибка сервера') });
        }
        return response.json(); // Если всё хорошо, передаём данные дальше
    })
    .then(result => {
        // Шаг B: Этот блок выполняется ТОЛЬКО при успешном ответе 200 OK
        console.log("УСПЕХ: Сервер вернул данные:", result);
        if (!result || !result.order_id) {
            throw new Error("Сервер вернул некорректный успешный ответ.");
        }
        // 1. Сохраняем данные и чистим корзину
        sessionStorage.setItem('lastOrderDetails', JSON.stringify(result));
        localStorage.removeItem('cart');

        // 2. ОТПРАВЛЯЕМ ДАННЫЕ В ГИБРИДНЫЙ ТРЕКЕР (Fetch POST на шлюз)
        if (window.admitadTracker) {
            window.admitadTracker.track('sale', {
                orderId: result.order_id,
                orderAmount: result.total_amount
            });
        }

        // 3. ОТПРАВЛЯЕМ ДАННЫЕ В СТАРЫЙ ПИКСЕЛЬНЫЙ ТРЕКЕР (IMG-пиксель)
        // Убедитесь, что fireTrackingPixel доступна и правильно настроена
        fireTrackingPixel({
            orderId: result.order_id,
            orderAmount: result.total_amount,
            paymentType: 'sale'
        });

        // 4. Перенаправляем пользователя
        setTimeout(() => {
            window.location.href = 'confirmation.html';
        }, 300); // Небольшая задержка
    })
    .catch(error => {
        // Шаг C: Этот блок ловит ЛЮБУЮ ошибку на всех предыдущих шагах
        console.error("ОШИБКА ПРИ ОТПРАВКЕ ЗАКАЗА:", error);
        statusEl.textContent = `Ошибка: ${error.message}`;
        submitBtn.disabled = false;
    });
}
function handleEventForm(e) {
    e.preventDefault();
    const statusEl = document.getElementById('event-status');
    const submitBtn = document.getElementById('submit-event-btn');
    statusEl.textContent = 'Обрабатываем вашу запись...';
    submitBtn.disabled = true;

    const eventData = {
        user_name: document.getElementById('event-user-name').value,
        user_email: document.getElementById('event-user-email').value,
        event_name: document.getElementById('event-name').value,
        admitad_uid: getCookie('admitad_aid'),
        deduplication_source: getCookie('deduplication_cookie')
    };

    if (!eventData.user_name || !eventData.user_email || !eventData.event_name) {
        statusEl.textContent = 'Пожалуйста, заполните все поля.';
        submitBtn.disabled = false;
        return;
    }

    fetch(`${API_URL}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.detail || 'Неизвестная ошибка сервера') });
        }
        return response.json();
    })
    .then(result => {
        if (!result || !result.registration_id) {
            throw new Error("Сервер вернул некорректный успешный ответ.");
        }
        sessionStorage.setItem('lastEventRegistration', JSON.stringify(result));

        // ОТПРАВЛЯЕМ ДАННЫЕ В ГИБРИДНЫЙ ТРЕКЕР (Fetch POST на шлюз)
        if (window.admitadTracker) {
            window.admitadTracker.track('lead', {
                orderId: result.registration_id,
                orderAmount: 0
            });
        }

        // ОТПРАВЛЯЕМ ДАННЫЕ В СТАРЫЙ ПИКСЕЛЬНЫЙ ТРЕКЕР (IMG-пиксель)
        // Убедитесь, что fireTrackingPixel доступна и правильно настроена
        fireTrackingPixel({
            orderId: result.registration_id,
            orderAmount: 0,
            paymentType: 'lead'
        });
        setTimeout(() => {
        window.location.href = 'event-confirmation.html';
        }, 300); // Даём пикселю 300 мс на отправку
    })
    .catch(error => {
        statusEl.textContent = `Ошибка при записи: ${error.message}`;
        submitBtn.disabled = false;
    });
}
function displayConfirmationDetails() {
    const container = document.getElementById('confirmation-details');
    const orderDetails = JSON.parse(sessionStorage.getItem('lastOrderDetails'));

    if (orderDetails && orderDetails.order_id) {
        container.innerHTML = `
            <h2>Спасибо за ваш заказ!</h2>
            <p>Ваш заказ №<strong>${orderDetails.order_id}</strong> успешно оформлен.</p>
            <p>Итоговая сумма: <strong>${orderDetails.total_amount.toFixed(2)} руб.</strong></p>
            <a href="index.html" class="button">Вернуться на главную</a>`;
        sessionStorage.removeItem('lastOrderDetails');
    } else {
        container.innerHTML = '<h2>Информация о заказе не найдена</h2><a href="index.html" class="button">Вернуться на главную</a>';
    }
}
function displayEventConfirmation() {
    const container = document.getElementById('event-confirmation-details');
    const regDetails = JSON.parse(sessionStorage.getItem('lastEventRegistration'));

    if (regDetails && regDetails.registration_id) {
        container.innerHTML = `
            <h2>Вы успешно записаны!</h2>
            <p><strong>${regDetails.user_name}</strong>, спасибо за запись на "${regDetails.event_name}".</p>
            <p>Номер вашей записи: <strong>${regDetails.registration_id}</strong></p>
            <a href="index.html" class="button">Вернуться на главную</a>`;

        // Этот вызов пикселя здесь теперь не обязателен, если он есть в handleEventForm,
        // но если оставите, он должен выглядеть так:
        fireTrackingPixel(
            {
                orderId: regDetails.registration_id,
                orderAmount: 0,
                paymentType: 'lead'
            },
            () => { console.log('Пиксель для лида отправлен со страницы подтверждения.'); }
        );

        sessionStorage.removeItem('lastEventRegistration');
    } else {
        container.innerHTML = `<h2>Информация о записи не найдена</h2><a href="index.html" class="button">Вернуться на главную</a>`;
    }
}
async function loadTransactions() {
    const container = document.getElementById('transactions-container');
    try {
        const response = await fetch(`${API_URL}/transactions`);
        if (!response.ok) throw new Error('Network response was not ok');
        const transactions = await response.json();
        if (transactions.length === 0) { container.innerHTML = '<p>Транзакций пока нет.</p>'; return; }
        transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        let tableHTML = `<table class="transactions-table"><thead><tr><th>ID Заказа</th><th>ID Транзакции</th><th>Email</th><th>Сумма</th><th>Способ оплаты</th><th>Дата и время</th></tr></thead><tbody>`;
        transactions.forEach(tx => { tableHTML += `<tr><td>${tx.order_id}</td><td>${tx.transaction_id || 'N/A'}</td><td>${tx.user_email}</td><td>${tx.amount.toFixed(2)} руб.</td><td>${tx.payment_method === 'card' ? 'Карта' : 'Наличные'}</td><td>${new Date(tx.timestamp).toLocaleString('ru-RU')}</td></tr>`; });
        tableHTML += '</tbody></table>';
        container.innerHTML = tableHTML;
    } catch (error) { container.innerHTML = `<p class="error-message">Не удалось загрузить транзакции: ${error.message}</p>`; }
}
