import { getFirestore, collection, getDocs, query, orderBy, limit, serverTimestamp, addDoc, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { getCurrentUser, db } from './auth.js';

/**
 * Logs an action to the Firestore audit_logs collection
 */
export async function logAction(action, details = "") {
    const user = getCurrentUser();
    try {
        await addDoc(collection(db, "audit_logs"), {
            action: action.toUpperCase(),
            details: details,
            performedBy: user ? user.email : "System",
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Failed to log action:", error);
    }
}

/**
 * Fetches and displays the Audit Logs
 */
export async function loadAuditLogs() {
    const logContainer = document.getElementById('auditLogBody');
    if (!logContainer) return;

    logContainer.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-gray-400">Loading logs...</td></tr>';

    try {
        const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(50));
        const snap = await getDocs(q);

        if (snap.empty) {
            logContainer.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-gray-400 italic">No logs found.</td></tr>';
            return;
        }

        logContainer.innerHTML = snap.docs.map(doc => {
            const data = doc.data();
            const time = data.timestamp?.toDate() ? data.timestamp.toDate().toLocaleString() : 'Recent';
            return `
                <tr class="border-b border-gray-50 text-[11px]">
                    <td class="px-4 py-3 font-bold text-gray-700">${data.action}</td>
                    <td class="px-4 py-3 text-gray-500">${data.performedBy}<br><span class="text-[9px] text-gray-400">${data.details}</span></td>
                    <td class="px-4 py-3 text-gray-400 text-right">${time}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error("Error loading logs:", error);
        logContainer.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-red-500">Error loading logs.</td></tr>';
    }
}

/**
 * Handles Advanced Settings (Maintenance Mode Toggle)
 */
export async function initAdvancedSettings() {
    const maintenanceToggle = document.getElementById('maintenanceModeToggle');
    const userRegistrationToggle = document.getElementById('userRegistrationToggle');
    if (!maintenanceToggle) return;

    // Load current state
    try {
        const configRef = doc(db, "system", "settings");
        const configSnap = await getDoc(configRef);
        
        if (configSnap.exists()) {
            const settings = configSnap.data();
            maintenanceToggle.checked = settings.maintenanceMode || false;
            if (userRegistrationToggle) {
                userRegistrationToggle.checked = settings.enableUserRegistration !== false;
            }
        }
    } catch (e) {
        console.warn("System config not initialized yet.");
    }

    maintenanceToggle.onchange = async (e) => {
        const isEnabled = e.target.checked;
        const confirmed = await window.showConfirm(
            'Update System Status',
            `Are you sure you want to ${isEnabled ? 'ENABLE' : 'DISABLE'} Maintenance Mode?`
        );

        if (confirmed) {
            try {
                await updateDoc(doc(db, "system", "settings"), { maintenanceMode: isEnabled });
                await logAction("SETTINGS_UPDATE", `Maintenance mode set to ${isEnabled}`);
                window.showToast(`Maintenance Mode ${isEnabled ? 'Enabled' : 'Disabled'}`, 'info');
            } catch (err) {
                window.showToast("Error updating settings", "error");
                e.target.checked = !isEnabled; // Revert UI
            }
        } else {
            e.target.checked = !isEnabled; // Revert UI
        }
    };

    if (userRegistrationToggle) {
        userRegistrationToggle.onchange = async (e) => {
            const isEnabled = e.target.checked;
            const confirmed = await window.showConfirm(
                'Update System Setting',
                `Are you sure you want to ${isEnabled ? 'ENABLE' : 'DISABLE'} User Registration?`
            );
            if (confirmed) {
                try {
                    await updateDoc(doc(db, "system", "settings"), { enableUserRegistration: isEnabled });
                    await logAction("SETTINGS_UPDATE", `User registration set to ${isEnabled}`);
                    window.showToast(`User Registration ${isEnabled ? 'Enabled' : 'Disabled'}`, 'info');
                } catch (err) {
                    window.showToast("Error updating settings", "error");
                    e.target.checked = !isEnabled;
                }
            } else {
                e.target.checked = !isEnabled;
            }
        };
    }
}
 