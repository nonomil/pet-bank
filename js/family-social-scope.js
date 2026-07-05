(function () {
    'use strict';

    const DEFAULT_SCOPE = 'minimal-v1';

    function getScope() {
        const configured = typeof window.APP_FAMILY_SOCIAL_SCOPE === 'string'
            ? window.APP_FAMILY_SOCIAL_SCOPE.trim()
            : '';
        return configured || DEFAULT_SCOPE;
    }

    function isMinimalV1() {
        return getScope() === DEFAULT_SCOPE;
    }

    window.FamilySocialScope = {
        DEFAULT_SCOPE: DEFAULT_SCOPE,
        getScope: getScope,
        isMinimalV1: isMinimalV1,
        shouldShowDiagnostics() {
            return !isMinimalV1();
        },
        shouldShowPKControls() {
            return !isMinimalV1();
        },
        getPhaseLabel() {
            return isMinimalV1() ? '一期最小可用版' : '完整社交版';
        }
    };
})();
