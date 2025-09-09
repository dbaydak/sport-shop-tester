/**
 * Renders the shared header component into the placeholder.
 */
function renderHeader() {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (headerPlaceholder) {
        headerPlaceholder.innerHTML = `
            <h1><a href="index.html">Первый Не Спортивный</a></h1>
            <div class="cart-info">
                <a href="cart.html">
                    Корзина: <span id="cart-count">0</span> товаров (<span id="cart-total">0.00</span> руб.)
                </a>
            </div>
        `;
    }
}
