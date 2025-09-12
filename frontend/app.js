// ====================================================================
// --- ОБЩИЕ КОМПОНЕНТЫ СТРАНИЦЫ ---
// ====================================================================

/**
 * Вставляет общие элементы в <head>, включая стили и трекер.
 */
function renderHeadContent() {
    const head = document.querySelector('head');
    if (!head) return;

    // Аккуратно добавляем стили, если их нет
    if (!head.querySelector('link[href="styles.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'styles.css';
        head.appendChild(link);
    }
    // Аккуратно добавляем трекер, если его нет
    if (!head.querySelector('script[src="/tracker.js"]')) {
        const trackerScript = document.createElement('script');
        trackerScript.src = '/tracker.js';
        trackerScript.async = true;
        trackerScript.defer = true;
        head.appendChild(trackerScript);
    }
}

/**
 * Вставляет шапку сайта в плейсхолдер <header id="header-placeholder">.
 */
function renderHeader() {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    const headerHTML = `
        <div class="logo">
            <a href="index.html">Первый Не Спортивный</a>
        </div>
        <nav class="cart-summary">
            <a href="cart.html">
                Корзина: <span id="cart-count">0</span> товаров (<span id="cart-total">0.00</span> руб.)
            </a>
        </nav>
    `;
    headerPlaceholder.innerHTML = headerHTML;
}

// ====================================================================
// --- ГЛАВНЫЙ ОБРАБОТЧИК ЗАГРУЗКИ ПРИЛОЖЕНИЯ ---
// ====================================================================

const API_URL = 'http://127.0.0.1:8000/api';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Сначала отрисовываем общие компоненты
    renderHeader();
    // Обновляем корзину сразу после отрисовки шапки
    updateCartCountAndTotal();

    // 2. Запускаем логику, специфичную для текущей страницы
    const path = window.location.pathname.split('/').pop();

    if (path === 'index.html' || path === '') {
        loadCategories();
        setupEventForm();
    } else if (path === 'products.html') {
        loadProductsByCategory();
    } else if (path === 'product-detail.html') {
        loadProductDetails();
    } else if (path === 'cart.html') {
        displayCartPage();
    } else if (path === 'checkout.html') {
        displayCheckoutPage();
    } else if (path === 'confirmation.html') {
        displayConfirmationDetails();
    } else if (path === 'event-confirmation.html') {
        displayEventConfirmation();
    } else if (path === 'transactions.html') {
        loadTransactions();
    }

    // 3. Обновляем информацию в корзине (в шапке)
    // updateCartCountAndTotal();
});


// ====================================================================
// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
// ====================================================================

function getCookie(name) {
    const matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : null;
}

function getCart() {
    try {
        const cartData = localStorage.getItem('cart');
        return cartData ? JSON.parse(cartData) : [];
    } catch (e) {
        console.error("Ошибка парсинга корзины из localStorage:", e);
        return []; // Возвращаем пустую корзину в случае ошибки
    }
}function saveCart(cart) { localStorage.setItem('cart', JSON.stringify(cart)); updateCartCountAndTotal(); }

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('show'); }, 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => { document.body.removeChild(toast); }, 500); }, 3000);
}


// ====================================================================
// --- ЛОГИКА КОРЗИНЫ ---
// ====================================================================

function updateCartCountAndTotal() {
    const cart = getCart();
    const cartCountEl = document.getElementById('cart-count');
    const cartTotalEl = document.getElementById('cart-total');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (cartCountEl) cartCountEl.textContent = totalItems;
    if (cartTotalEl) cartTotalEl.textContent = totalPrice.toFixed(2);
}

function addToCart(id, name, price, sku) {
    const quantityInput = document.querySelector(`#quantity-${id}`);
    const quantity = quantityInput ? parseInt(quantityInput.value, 10) : 1;
    if (isNaN(quantity) || quantity <= 0) { showToast('Выберите корректное количество.', 'error'); return; }
    const cart = getCart();
    const existingProduct = cart.find(item => item.id === id);
    if (existingProduct) { existingProduct.quantity += quantity; } else { cart.push({ id, name, price, sku, quantity }); }
    saveCart(cart);
    showToast(`"${name}" (x${quantity}) добавлен в корзину!`);
    if(quantityInput) quantityInput.value = 1;
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


// ====================================================================
// --- ЗАГРУЗЧИКИ ДАННЫХ ДЛЯ СТРАНИЦ ---
// ====================================================================

// Замените эту функцию в app.js

const categoryNameMapping = {
    'Аксессуары': 'Accessories',
    'Обувь': 'Shoes',
    'Гаджеты': 'Gadgets',
    'Одежда': 'Clothes'
};

async function loadCategories() {
    const container = document.getElementById('categories-container');
    if (!container) {
        console.error("Контейнер для категорий не найден!");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/categories`);
        if (!response.ok) {
            throw new Error(`HTTP ошибка: ${response.status}`);
        }
        const categories = await response.json();

        if (!categories || categories.length === 0) {
            container.innerHTML = `<p>Категории не найдены</p>`;
            return;
        }

        container.innerHTML = ''; // Очищаем контейнер

        categories.forEach(categoryNameRU => {
            // Получаем английское название из нашего словаря
            const categoryIdentifierEN = categoryNameMapping[categoryNameRU] || categoryNameRU;

            const categoryCard = document.createElement('a');
            // Используем английское название для URL
            categoryCard.href = `products.html?category=${encodeURIComponent(categoryIdentifierEN)}`;
            categoryCard.className = 'category-card';
            // А русское оставляем для отображения пользователю
            categoryCard.innerHTML = `
                <div class="product-image-placeholder"></div>
                <h3>${categoryNameRU}</h3>
            `;
            container.appendChild(categoryCard);
        });

    } catch (error) {
        console.error("Ошибка при загрузке категорий:", error);
        container.innerHTML = `<p class="error-message">Не удалось загрузить категории. Проверьте консоль сервера (бэкенда) на наличие ошибок.</p>`;
    }
}

async function loadProductsByCategory() {
    const container = document.getElementById('products-list-container');
    const title = document.getElementById('category-title');
    if (!container || !title) return;

    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');
    if (!category) {
        title.textContent = 'Категория не выбрана';
        container.innerHTML = '';
        return;
    }

    title.textContent = `Товары в категории: ${category}`;
    try {
        const response = await fetch(`${API_URL}/products?category=${encodeURIComponent(category)}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const products = await response.json();

        container.innerHTML = '';
        if (products.length === 0) {
            container.innerHTML = '<p>В этой категории пока нет товаров.</p>';
            return;
        }

        products.forEach(product => {
            container.appendChild(createProductCard(product));
        });
    } catch (error) {
        container.innerHTML = `<p class="error-message">Не удалось загрузить товары.</p>`;
    }
}

async function loadProductDetails() {
    // Находим главный контейнер на странице деталей товара
    const container = document.getElementById('product-detail-container');
    if (!container) {
        console.error('Контейнер для деталей товара не найден!');
        return;
    }

    // 1. Получаем ID товара из URL (например, ?id=4)
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    if (!productId) {
        container.innerHTML = '<p class="error-message">ID товара не указан в URL.</p>';
        return;
    }

    container.innerHTML = '<div class="loader">Загрузка информации о товаре...</div>';

    try {
        // 2. Делаем запрос к API по адресу /api/products/{id}
        const response = await fetch(`${API_URL}/products/${productId}`);

        if (!response.ok) {
            // Если сервер вернул 404 или другую ошибку
            throw new Error(`Товар с ID ${productId} не найден`);
        }
        const product = await response.json();

        // 3. Генерируем HTML и отображаем данные на странице
        container.innerHTML = `
            <div class="product-detail-image">
                <img src="https://placehold.co/600x400/EFEFEF/333333?text=${encodeURIComponent(product.category)}" alt="${product.name}">
            </div>
            <div class="product-detail-info">
                <h1>${product.name}</h1>
                <p class="product-category">Артикул: ${product.sku}</p>
                <p>${product.description}</p>
                <div class="product-price"><strong>${product.price.toFixed(2)} руб.</strong></div>
                <div class="product-controls">
                    <label for="quantity-${product.id}" class="visually-hidden">Количество:</label>
                    <input type="number" id="quantity-${product.id}" value="1" min="1" class="quantity-input">
                    <button class="button" onclick="addToCart(${product.id}, '${product.name}', ${product.price}, '${product.sku}')">Добавить в корзину</button>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Ошибка при загрузке деталей товара:', error);
        container.innerHTML = `<p class="error-message">Не удалось загрузить информацию о товаре. ${error.message}</p>`;
    }
}

function createProductCard(product) {
    const cardLink = document.createElement('a');
    cardLink.href = `product-detail.html?id=${product.id}`;
    cardLink.className = 'product-card-link';
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
        <img src="https://placehold.co/300x200/EFEFEF/333333?text=${encodeURIComponent(product.category)}" alt="${product.name}" class="product-image">
        <h3>${product.name}</h3>
        <div class="product-price"><strong>${product.price.toFixed(2)} руб.</strong></div>
    `;

    cardLink.appendChild(card);
    return cardLink;
}

async function loadTransactions() {
    const container = document.getElementById('transactions-container');
    if (!container) return;
    try {
        const response = await fetch(`${API_URL}/transactions`);
        if (!response.ok) throw new Error('Network response was not ok');
        const transactions = await response.json();
        const tableBody = container.querySelector('tbody');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        transactions.reverse().forEach(tx => {
            const row = tableBody.insertRow();
            row.innerHTML = `<td>${new Date(tx.timestamp).toLocaleString()}</td><td>${tx.order_id}</td><td>${tx.amount.toFixed(2)}</td><td>${tx.payment_method}</td><td>${tx.user_email}</td><td>${tx.admitad_uid || 'N/A'}</td>`;
        });
    } catch (error) { container.innerHTML = `<p class="error-message">Не удалось загрузить транзакции.</p>`; }
}

// ====================================================================
// --- ЛОГИКА СТРАНИЦ КОРЗИНЫ И ОФОРМЛЕНИЯ ЗАКАЗА ---
// ====================================================================

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
    const cart = getCart();
    const itemsSummaryContainer = document.getElementById('cart-items-summary');
    const totalAmountEl = document.getElementById('summary-total-amount');
    const submitBtn = document.getElementById('submit-order-btn');

    if (itemsSummaryContainer) {
        itemsSummaryContainer.innerHTML = '';
        if (cart.length === 0) {
            itemsSummaryContainer.innerHTML = '<p>Ваша корзина пуста.</p>';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Корзина пуста';
            }
        } else {
            let total = 0;
            cart.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'summary-item';
                itemEl.innerHTML = `<span>${item.name} (x${item.quantity})</span><span>${(item.price * item.quantity).toFixed(2)} руб.</span>`;
                itemsSummaryContainer.appendChild(itemEl);
                total += item.price * item.quantity;
            });
            if (totalAmountEl) totalAmountEl.textContent = total.toFixed(2);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Оформить заказ';
            }
        }
    }

    if (submitBtn) {
        submitBtn.addEventListener('click', handleCheckoutForm);
    }

    const paymentRadios = document.querySelectorAll('input[name="payment"]');
    const cardDetailsForm = document.getElementById('card-details-form');
    if (paymentRadios.length > 0 && cardDetailsForm) {
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
}


// ====================================================================
// --- ОБРАБОТЧИКИ ФОРМ ---
// ====================================================================

function buildOrderPayload() {
    const cart = getCart();
    if (cart.length === 0) return null;

    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const orderData = {
        user_name: document.getElementById('user-name').value,
        user_email: document.getElementById('user-email').value,
        payment_method: document.querySelector('input[name="payment"]:checked').value,
        items: cart.map(item => ({
            product_id: item.id,
            sku: item.sku || null,
            name: item.name,
            price: item.price,
            quantity: item.quantity
        })),
        total_amount: totalAmount,
        card_details: null,
    };

    if (orderData.payment_method === 'card') {
        orderData.card_details = {
            card_number: document.getElementById('card-number').value,
            expiry_date: document.getElementById('expiry-date').value,
            cvv: document.getElementById('cvv').value,
            owner_name: document.getElementById('owner-name').value
        };
    }
    return orderData;
}

async function sendOrderToServer(payload) {
    const response = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.detail || 'Неизвестная ошибка сервера');
    }
    return result;
}

function handleSuccessfulOrder(result, payload) {
    if (!result || !result.order_id) {
        throw new Error("Сервер вернул некорректный успешный ответ.");
    }

    // --- ИЗМЕНЁННЫЙ БЛОК ---
    // 1. Создаём объект события
    const dataLayerEvent = {
        'event': 'purchase',
        'ecommerce': {
            'transaction_id': result.order_id,
            'value': payload.total_amount,
            'items': payload.items.map(item => ({
                'item_id': item.product_id,
                'item_name': item.name,
                'price': item.price,
                'quantity': item.quantity
            }))
        }
    };
    // 2. Сохраняем его в sessionStorage для СЛЕДУЮЩЕЙ страницы
    sessionStorage.setItem('dataLayerEvent', JSON.stringify(dataLayerEvent));
    console.log('[App] Событие "purchase" сохранено в sessionStorage для передачи.');
    // --- КОНЕЦ БЛОКА ---
    // Добавляем товары из payload в объект, который сохраним
    const confirmationDetails = {
        ...result,
        items: payload.items
    };
    sessionStorage.setItem('lastOrderDetails', JSON.stringify(confirmationDetails));
    localStorage.removeItem('cart');
    window.location.href = 'confirmation.html';
}

async function handleCheckoutForm(e) {
    const statusEl = document.getElementById('checkout-status');
    const submitBtn = document.getElementById('submit-order-btn');
    statusEl.textContent = 'Обрабатываем ваш заказ...';
    submitBtn.disabled = true;

    try {
        const payload = buildOrderPayload();
        if (!payload) {
            throw new Error('Ваша корзина пуста.');
        }

        const result = await sendOrderToServer(payload);
        handleSuccessfulOrder(result, payload);

    } catch (error) {
        console.error("ОШИБКА ПРИ ОТПРАВКЕ ЗАКАЗА:", error);
        statusEl.textContent = `Ошибка: ${error.message}`;
        submitBtn.disabled = false;
    }
}

function setupEventForm() {
    const submitBtn = document.getElementById('submit-event-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', handleEventForm);
    }
}

function buildEventPayload() {
    const eventData = {
        user_name: document.getElementById('event-user-name').value,
        user_email: document.getElementById('event-user-email').value,
        event_name: document.getElementById('event-name').value,
    };
    if (!eventData.user_name || !eventData.user_email || !eventData.event_name) {
        throw new Error('Пожалуйста, заполните все поля.');
    }
    return eventData;
}

async function sendEventToServer(payload) {
    const response = await fetch(`${API_URL}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.detail || 'Неизвестная ошибка сервера');
    }
    return result;
}

function handleSuccessfulEvent(result) {
    if (!result || !result.registration_id) {
        throw new Error("Сервер вернул некорректный успешный ответ.");
    }
    sessionStorage.setItem('lastEventRegistration', JSON.stringify(result));
    window.location.href = 'event-confirmation.html';
}

function handleEventError(error) {
    console.error("ОШИБКА ПРИ ЗАПИСИ НА МЕРОПРИЯТИЕ:", error);
    const statusEl = document.getElementById('event-status');
    const submitBtn = document.getElementById('submit-event-btn');
    statusEl.textContent = `Ошибка: ${error.message}`;
    if(submitBtn) submitBtn.disabled = false;
}

async function handleEventForm(e) {
    const statusEl = document.getElementById('event-status');
    const submitBtn = document.getElementById('submit-event-btn');
    statusEl.textContent = 'Обрабатываем вашу запись...';
    submitBtn.disabled = true;

    try {
        const payload = buildEventPayload();
        const result = await sendEventToServer(payload);
        handleSuccessfulEvent(result);
    } catch (error) {
        handleEventError(error);
    }
}


// ====================================================================
// --- ЛОГИКА СТРАНИЦ ПОДТВЕРЖДЕНИЯ ---
// ====================================================================

function displayConfirmationDetails() {
    const container = document.getElementById('confirmation-details');
    const orderDetails = JSON.parse(sessionStorage.getItem('lastOrderDetails'));
    if (orderDetails && orderDetails.order_id) {
        container.innerHTML = `
            <h2>Спасибо за ваш заказ!</h2>
            <p>Ваш заказ №<strong>${orderDetails.order_id}</strong> успешно оформлен.</p>
            <p>Итоговая сумма: <strong>${orderDetails.total_amount.toFixed(2)} руб.</strong></p>
            <a href="index.html" class="button">Вернуться на главную</a>`;
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
    } else {
        container.innerHTML = '<h2>Информация о записи не найдена</h2><a href="index.html" class="button">Вернуться на главную</a>';
    }
}
