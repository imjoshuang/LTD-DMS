/* ============================================================
   PRE-DEPLOYMENT REPORT — JavaScript
   File: pre_deployment_scripts.js
   ============================================================ */

'use strict';

/* ── Default values to restore on reset ── */
const DEFAULTS = {
    pdrNo:        '',
    pdrDate:      '',
    projName:     '',
    docRefCode:   '',
    deployDuration: '',
    venue:        '',
    deployOverview: '',
    preparedName: '',
    preparedPos:  '',
    preparedDate: '',
    reviewedName: '',
    reviewedPos:  '',
    reviewedDate: '',
    approvedName: '',
    approvedPos:  '',
    approvedDate: '',
};

/* ── Reset form ── */
function resetForm() {
    if (!confirm('Reset all fields?')) return;

    /* Clear all text inputs */
    document.querySelectorAll('input[type="text"], textarea').forEach(el => {
        el.value = '';
    });

    /* Restore any explicit defaults */
    Object.entries(DEFAULTS).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    });
}

/* ── Auto-resize textareas ── */
function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

function attachAutoResize() {
    document.querySelectorAll('textarea').forEach(ta => {
        ta.addEventListener('input', () => autoResize(ta));
    });
}

/* ── Init ── */
window.addEventListener('load', () => {
    attachAutoResize();
});
