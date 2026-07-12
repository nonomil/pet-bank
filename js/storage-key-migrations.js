(function (global) {
    'use strict';

    function migrateKey(storage, legacyKey, currentKey) {
        if (!storage || !legacyKey || !currentKey || legacyKey === currentKey) return false;

        let legacyValue;
        try {
            legacyValue = storage.getItem(legacyKey);
        } catch (_) {
            return false;
        }
        if (legacyValue === null) return false;

        try {
            if (storage.getItem(currentKey) !== null) {
                storage.removeItem(legacyKey);
                return false;
            }
            storage.setItem(currentKey, legacyValue);
            storage.removeItem(legacyKey);
            return true;
        } catch (_) {
            return false;
        }
    }

    global.PetBankStorageMigrations = Object.freeze({ migrateKey });
})(typeof window !== 'undefined' ? window : globalThis);
