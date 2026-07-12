/* time-utils.js - shared business-time primitives */
(function (root) {
    'use strict';

    function asDate(value) {
        const date = value == null
            ? new Date()
            : (value instanceof Date ? new Date(value.getTime()) : new Date(value));
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function localDate(value) {
        const date = asDate(value);
        if (!date) return '';
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function unixSeconds(value) {
        const milliseconds = value == null
            ? Date.now()
            : (value instanceof Date ? value.getTime() : Number(value));
        return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1000) : 0;
    }

    function isDateKey(value) {
        return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
    }

    root.PetBankTime = Object.freeze({ localDate, unixSeconds, isDateKey });
})(typeof window !== 'undefined' ? window : globalThis);
