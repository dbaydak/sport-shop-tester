// Файл: assets/tracker.js
(function() {
    'use strict';

    // --- Настройки ---
    const UID_COOKIE_NAME = 'admitad_aid';
    const DEDUPLICATION_COOKIE_NAME = 'deduplication_adm';
    const COOKIE_LIFETIME_DAYS = 90;

    // --- Вспомогательные функции ---
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

    /**
     * Получает значение параметра из URL (добавлено из вашего примера).
     */
    function getParamFromURL(paramName) {
        const params = new URLSearchParams(window.location.search);
        return params.get(paramName);
    }

    // --- ОСНОВНАЯ ЛОГИКА ---
    // 1. Установка cookie для admitad_uid (без изменений)
    const admitadUid = getParamFromURL('admitad_uid');
    if (admitadUid) {
        setCookie(UID_COOKIE_NAME, admitadUid, COOKIE_LIFETIME_DAYS);
    }

    // 2. Установка cookie для источника трафика (дедупликация) - ЛОГИКА ОБНОВЛЕНА
    let source = getParamFromURL('utm_source');
    if (!source) {
        if (getParamFromURL('gclid')) source = 'google';
        else if (getParamFromURL('fbclid')) source = 'facebook';
        else if (getParamFromURL('cjevent')) source = 'cj';
        // При необходимости сюда можно добавить другие источники
    }
    // Устанавливаем cookie, только если источник был определён
    if (source) {
        setCookie(DEDUPLICATION_COOKIE_NAME, source, COOKIE_LIFETIME_DAYS);
    }

    // --- Создаём глобальный объект трекера (без изменений) ---
    window.admitadTracker = {
        track: function(type, data) {
            console.log(`[Admitad Tracker] Событие зарегистрировано:
Тип: ${type}
Данные:`, data);
        }
    };

    console.log('[Admitad Tracker] Скрипт успешно инициализирован.');
})();
