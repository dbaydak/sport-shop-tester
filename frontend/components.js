/*
function renderHeadContent() {
    const head = document.querySelector('head');
    if (!head) return;
    // Все общие теги, которые должны быть на каждой странице
    const commonHeadHTML = `
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="styles.css">
        <script src="/tracker.js" async defer></script>
    `;
    // Вставляем общие теги в начало <head>, сохраняя уникальный <title>
    const title = head.querySelector('title');
    head.innerHTML = '';
    head.insertAdjacentHTML('afterbegin', commonHeadHTML);
    if (title) head.appendChild(title);
}

function renderHeader() {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;
    // HTML-код для шапки сайта
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
*/