import { logoutUser, getCurrentUser, db, auth } from './auth.js';
import { getFirestore, doc, setDoc, serverTimestamp, collection, getDocs, query, where, deleteDoc, updateDoc, getDoc, addDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { saveTemplate, loadTemplatesUI, createFolder } from './templates.js';
import { loadAuditLogs, initAdvancedSettings } from './settings.js';

// Global variable to track if we're editing a user
let editUserId = null;
let roleChartInstance = null;
let uploadTrendChartInstance = null;
let cachedTemplates = []; // Para i-store ang templates data

// ========== TOAST NOTIFICATION SYSTEM ==========
window.showToast = function(message, type = 'success', duration = 4000) {
    const toast = document.getElementById('toast');
    const toastBg = document.getElementById('toastBg');
    const toastIcon = document.getElementById('toastIcon');
    const toastIconBox = document.getElementById('toastIconBox');
    const toastTitle = document.getElementById('toastTitle');
    const toastMsg = document.getElementById('toastMessage');

    if (!toast) {
        console.error('Toast elements not found!');
        return;
    }

    // CONFIGURATION PER TYPE
    const configs = {
        success: {
            bg: 'bg-[#600000]',
            border: 'border-gold-ltd',
            iconBox: 'bg-white/20 text-white',
            title: 'SUCCESS',
            icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>',
            textColor: 'text-white'
        },
        error: {
            bg: 'bg-red-600',
            border: 'border-red-800',
            iconBox: 'bg-white/20 text-white',
            title: 'ERROR',
            icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path>',
            textColor: 'text-white'
        },
        info: {
            bg: 'bg-blue-600',
            border: 'border-blue-800',
            iconBox: 'bg-white/20 text-white',
            title: 'INFO',
            icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>',
            textColor: 'text-white'
        },
        warning: {
            bg: 'bg-orange-500',
            border: 'border-orange-700',
            iconBox: 'bg-white/20 text-white',
            title: 'WARNING',
            icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>',
            textColor: 'text-white'
        },
        danger: {
            bg: 'bg-red-600',
            border: 'border-red-800',
            iconBox: 'bg-white/20 text-white',
            title: 'SYSTEM NOTICE',
            icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>',
            textColor: 'text-white'
        }
    };

    const config = configs[type] || configs.success;

    // APPLY STYLES
    if (toastBg) {
        toastBg.className = `flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border-l-4 ${config.bg} ${config.border}`;
    }
    if (toastIconBox) {
        toastIconBox.className = `p-2 rounded-full ${config.iconBox}`;
    }
    if (toastIcon) {
        toastIcon.innerHTML = config.icon;
    }
    if (toastTitle) {
        toastTitle.innerText = config.title;
        toastTitle.className = `text-xs font-bold tracking-widest uppercase mb-0.5 ${config.iconBox.split(' ')[1]}`;
    }
    if (toastMsg) {
        toastMsg.innerText = message;
        toastMsg.classList.remove('text-white', 'text-gray-600');
        toastMsg.classList.add(config.textColor || 'text-gray-600');
    }

    // SHOW TOAST
    toast.classList.remove('translate-x-full', 'opacity-0');
    toast.classList.add('translate-x-0', 'opacity-100');

    // AUTO HIDE AFTER DURATION
    setTimeout(() => {
        toast.classList.remove('translate-x-0', 'opacity-100');
        toast.classList.add('translate-x-full', 'opacity-0');
    }, duration);
};

// ========== CUSTOM CONFIRMATION DIALOG ==========
window.showConfirm = function(title, message) {
    return new Promise((resolve) => {
        const confirmModal = document.createElement('div');
        confirmModal.className = 'fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300';
        confirmModal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full transform transition-all scale-95 opacity-0" id="confirmContent">
                <div class="p-6 text-center">
                    <div class="w-16 h-16 bg-maroon-ltd/10 text-maroon-ltd rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    </div>
                    <h3 class="text-lg font-bold text-maroon-ltd tracking-tight mb-2 uppercase font-oswald">${title}</h3>
                    <p class="text-gray-500 text-sm leading-relaxed mb-6">${message}</p>
                    <div class="flex gap-3">
                        <button id="cancelBtn" class="flex-1 px-4 py-3 text-xs font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border border-gray-100 rounded-xl uppercase tracking-widest">Cancel</button>
                        <button id="proceedBtn" class="flex-1 px-4 py-3 text-xs font-bold bg-maroon-ltd text-white hover:bg-black transition-colors rounded-xl uppercase tracking-widest shadow-lg shadow-maroon-ltd/20">Confirm Action</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(confirmModal);

        requestAnimationFrame(() => {
            const content = document.getElementById('confirmContent');
            content.classList.remove('scale-95', 'opacity-0');
        });

        const close = (result) => {
            const content = document.getElementById('confirmContent');
            content.classList.add('scale-95', 'opacity-0');
            confirmModal.classList.add('opacity-0');
            setTimeout(() => confirmModal.remove(), 300);
            resolve(result);
        };

        document.getElementById('cancelBtn').onclick = () => close(false);
        document.getElementById('proceedBtn').onclick = () => close(true);
    });
};

// Check if user is authenticated on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log("=== DOM CONTENT LOADED ===");
    
    const isLoggedIn = sessionStorage.getItem('userLoggedIn') === 'true';
    const currentUser = getCurrentUser();
    
    if (!isLoggedIn && !currentUser) {
        console.log("No user found, redirecting to login");
        window.location.replace('../admin/index.html');
        return;
    }

    // --- INITIALIZE UI LISTENERS FIRST (Non-blocking) ---
    
    try {
        const dashboardLink = document.getElementById('dashboardLink');
        const userManagementLink = document.getElementById('userManagementLink');
        const documentsLink = document.getElementById('documentsLink');
        const settingsLink = document.getElementById('settingsLink');
        
        const dashboardSection = document.getElementById('dashboardSection');
        const userManagementSection = document.getElementById('userManagementSection');
        const documentsSection = document.getElementById('documentsSection');
        const settingsSection = document.getElementById('settingsSection');
        
        const pageTitle = document.getElementById('pageTitle');
        
        if (!dashboardLink || !userManagementLink || !documentsLink || !settingsLink || 
            !dashboardSection || !userManagementSection || !documentsSection || !settingsSection) {
            console.error('Navigation elements not found!');
            return;
        }
        
        const links = { dashboard: dashboardLink, users: userManagementLink, documents: documentsLink, settings: settingsLink };
        const sections = { dashboard: dashboardSection, users: userManagementSection, documents: documentsSection, settings: settingsSection };

        dashboardLink.addEventListener('click', (e) => {
            e.preventDefault();
            showSection('dashboard', links, sections, pageTitle);
        });

        userManagementLink.addEventListener('click', (e) => {
            e.preventDefault();
            showSection('users', links, sections, pageTitle);
        });
        
        documentsLink.addEventListener('click', (e) => {
            e.preventDefault();
            showSection('documents', links, sections, pageTitle);
            loadTemplatesUI(null, 'Document Management'); // Siguraduhing root ang simula
        });

        settingsLink.addEventListener('click', (e) => {
            e.preventDefault();
            showSection('settings', links, sections, pageTitle);
            loadAuditLogs(); // Load audit logs when settings is opened
            initAdvancedSettings(); // Initialize advanced settings (e.g., maintenance mode toggle)
        });

        showSection('dashboard', links, sections, pageTitle);
    } catch (error) {
        console.error('Navigation setup error:', error);
    }

    // Real-time Search Logic for User Management Table
    const userSearchInput = document.getElementById('userSearch');
    if (userSearchInput) {
        userSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('#userTableBody tr');
            
            rows.forEach(row => {
                if (row.querySelector('td[colspan]')) return;
                const rowText = row.innerText.toLowerCase();
                row.style.display = rowText.includes(searchTerm) ? '' : 'none';
            });
        });
    }

    // Trend Filter listener
    const trendFilter = document.getElementById('trendFilter');
    if (trendFilter) {
        trendFilter.addEventListener('change', (e) => {
            processTrendData(e.target.value);
        });
    }

    // --- INITIALIZE DATA-HEAVY TASKS (Async) ---
    
    try {
        renderCharts();
        
        setTimeout(async () => {
            await loadDashboardStats().catch(err => console.error("Stats Load Failed:", err));
        }, 500);
    } catch (error) {
        console.error('Async Initialization Error:', error);
    }
});

// ========== DROPDOWN MENU LOGIC (Moved outside to ensure immediate availability) ==========
const dropdownBtn = document.getElementById('uploadDropdownBtn');
const uploadMenu = document.getElementById('uploadMenu');
const menuUploadFile = document.getElementById('menuUploadFile');
const menuNewFolder = document.getElementById('menuNewFolder');

if (dropdownBtn && uploadMenu) {
    dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!uploadMenu.classList.contains('hidden')) {
            if (!dropdownBtn.contains(e.target) && !uploadMenu.contains(e.target)) {
                uploadMenu.classList.add('hidden');
            }
        }
    });
}

if (menuUploadFile) {
    menuUploadFile.onclick = () => {
        uploadMenu.classList.add('hidden');
        window.openTemplateModal();
    };
}

if (menuNewFolder) {
    menuNewFolder.onclick = () => {
        uploadMenu.classList.add('hidden');
        window.openFolderModal();
    };
}

// ========== NAVIGATION LOGIC ==========
function showSection(section, links, sections, pageTitle) {
    // Hide all sections
    Object.values(sections).forEach(s => s.classList.add('hidden'));
    
    // Reset all link styles
    Object.values(links).forEach(link => {
        link.classList.remove('bg-white/10', 'text-white', 'font-medium');
        link.classList.add('text-white/70', 'hover:bg-white/5');
    });
    
    // Show target section and highlight link
    if (sections[section]) sections[section].classList.remove('hidden');
    if (links[section]) {
        links[section].classList.remove('text-white/70', 'hover:bg-white/5');
        links[section].classList.add('bg-white/10', 'text-white', 'font-medium');
    }

    if (section === 'dashboard') {
        pageTitle.textContent = 'DASHBOARD';
    } else if (section === 'users') {
        pageTitle.textContent = 'USER MANAGEMENT';
    } else if (section === 'documents') {
        pageTitle.textContent = 'DOCUMENTS';
    } else if (section === 'settings') {
        pageTitle.textContent = 'SETTINGS';
    }
}

// ========== PREVENT BACK BUTTON ==========
window.history.pushState(null, null, window.location.href);
window.addEventListener('popstate', function() {
    window.history.pushState(null, null, window.location.href);
});

// ========== LOGOUT FUNCTIONALITY ==========
const logoutBtn = document.getElementById('logoutBtn');

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        const result = await logoutUser();
        
        if (result.success) {
            sessionStorage.clear();
            localStorage.clear();
            window.history.pushState(null, null, window.location.href);
            window.onpopstate = function() {
                window.history.pushState(null, null, window.location.href);
            };
            window.location.replace('../admin/index.html');
        }
    });
}

// ========== CHART INITIALIZATION ==========
function renderCharts() {
    if (typeof Chart === 'undefined') {
        console.log("Chart.js not available yet, retrying...");
        setTimeout(renderCharts, 300);
        return;
    }

    const ctxLine = document.getElementById('lineChart');
    if (ctxLine) {
        uploadTrendChartInstance = new Chart(ctxLine.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
                datasets: [{
                    label: 'Uploads',
                    data: [0, 0, 0, 0, 0, 0, 0],
                    borderColor: '#600000',
                    backgroundColor: 'rgba(96, 0, 0, 0.05)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }
            }
        });
        console.log("Line chart created");
    }

    const ctxDonut = document.getElementById('donutChart');
    if (ctxDonut) {
        roleChartInstance = new Chart(ctxDonut.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: [], // Empty labels initially
                datasets: [{
                    data: [], // Empty data initially
                    backgroundColor: [], // Will be set dynamically
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: { 
                        position: 'bottom', 
                        labels: { 
                            font: { family: 'Oswald', size: 10 },
                            padding: 10,
                            boxWidth: 12
                        } 
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        console.log("Donut chart created");
    }
}

// Helper to update the Donut Chart data with department distribution
function updateRoleChart(departmentCounts) {
    if (!roleChartInstance) {
        console.log("Cannot update chart: roleChartInstance is null");
        return;
    }
    
    // Get all departments and their counts
    const departments = Object.keys(departmentCounts).sort();
    const counts = departments.map(dept => departmentCounts[dept]);
    
    // Generate colors for each department
    const colorPalette = [
        '#600000', // Maroon
        '#C19A6B', // Gold
        '#2C5282', // Navy Blue
        '#2F855A', // Green
        '#9B2C2C', // Red Brown
        '#6B46C1', // Purple
        '#DD6B20', // Orange
        '#319795', // Teal
        '#D53F8C', // Pink
        '#4A5568', // Gray
        '#F6AD55', // Light Orange
        '#48BB78', // Light Green
        '#4299E1', // Blue
        '#ED64A6'  // Hot Pink
    ];
    
    const backgroundColors = departments.map((_, index) => colorPalette[index % colorPalette.length]);
    
    console.log("Updating chart with department distribution:", departmentCounts);
    
    roleChartInstance.data.labels = departments;
    roleChartInstance.data.datasets[0].data = counts;
    roleChartInstance.data.datasets[0].backgroundColor = backgroundColors;
    roleChartInstance.update();
    console.log("Chart updated with department data");
}

// Helper to update the Line Chart data with upload trends
function updateUploadTrendChart(labels, counts) {
    if (!uploadTrendChartInstance) {
        console.log("Cannot update trend chart: uploadTrendChartInstance is null");
        return;
    }
    
    uploadTrendChartInstance.data.labels = labels;
    uploadTrendChartInstance.data.datasets[0].data = counts;
    uploadTrendChartInstance.update();
}

// Helper para i-process ang trend data base sa filter (Weekly/Monthly)
function processTrendData(view) {
    if (!uploadTrendChartInstance || cachedTemplates.length === 0) return;

    let labels = [];
    let counts = [];

    if (view === 'monthly') {
        labels = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        counts = Array(12).fill(0);
        
        cachedTemplates.forEach(doc => {
            const data = doc.data(); // Ito ay gagana na dahil .docs ang laman ng cachedTemplates
            if (data.createdAt && data.createdAt.toDate) {
                const date = data.createdAt.toDate();
                counts[date.getMonth()]++;
            }
        });
    } else {
        // Weekly View (MON-SUN)
        labels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
        counts = Array(7).fill(0);
        
        cachedTemplates.forEach(doc => {
            const data = doc.data();
            if (data.createdAt && data.createdAt.toDate) {
                const date = data.createdAt.toDate();
                const day = date.getDay(); // 0=Sun, 1=Mon...
                const index = day === 0 ? 6 : day - 1; // Gawing 0=Mon, 6=Sun
                counts[index]++;
            }
        });
    }
    updateUploadTrendChart(labels, counts);
}

// Fetch all users to populate total stats and department chart
async function loadDashboardStats() {
    console.log("=== LOADING DASHBOARD STATS ===");
    
    try {
        const usersCollection = collection(db, "users");
        console.log("Fetching users from Firestore...");
        
        const querySnapshot = await getDocs(usersCollection);
        console.log("Query snapshot size:", querySnapshot.size);
        console.log("Is empty?", querySnapshot.empty);
        
        const departmentCounts = {};
        let totalUsers = 0;

        if (querySnapshot.empty) {
            console.warn("No users found in Firestore!");
        } else {
            querySnapshot.forEach((doc) => {
                const user = doc.data();
                const department = user.department || 'UNASSIGNED';
                
                console.log(`User ${totalUsers + 1}:`, {
                    id: doc.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    department: department,
                    role: user.role
                });
                
                departmentCounts[department] = (departmentCounts[department] || 0) + 1;
                totalUsers++;
            });
        }

        console.log("=== SUMMARY ===");
        console.log("Total Users Count:", totalUsers);
        console.log("Department Distribution:", departmentCounts);

        // Update the Total Users card
        let totalUsersCard = document.getElementById('totalUsersCount');
        if (!totalUsersCard) {
            totalUsersCard = document.querySelector('.text-3xl.font-bold');
            console.log("Using fallback selector for total users card");
        }
        
        if (totalUsersCard) {
            totalUsersCard.textContent = totalUsers.toLocaleString();
            console.log("✅ Updated total users card to:", totalUsers);
        } else {
            console.error("❌ Total users card element not found!");
        }

        // --- TEMPLATES STATS ---
        const templatesCollection = collection(db, "templates");
        const templatesSnapshot = await getDocs(templatesCollection);
        const totalTemplates = templatesSnapshot.size;

        // CRITICAL FIX: I-save ang docs sa cachedTemplates para magamit ng processTrendData
        cachedTemplates = templatesSnapshot.docs; 

        // Update Documents count card
        const totalDocsCard = document.getElementById('totalDocumentsCount');
        if (totalDocsCard) {
            totalDocsCard.textContent = totalTemplates.toLocaleString();
            console.log("✅ Updated total documents card to:", totalTemplates);
        }

        // Process upload trends (MON-SUN)
        const uploadCounts = [0, 0, 0, 0, 0, 0, 0]; 
        templatesSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.createdAt && data.createdAt.toDate) {
                const date = data.createdAt.toDate();
                // JS getDay(): 0=Sun, 1=Mon... 6=Sat
                const day = date.getDay();
                // Convert to MON-SUN index (0=Mon, 1=Tue... 6=Sun)
                const index = day === 0 ? 6 : day - 1;
                uploadCounts[index]++;
            }
        });

        // Update the charts
        if (!roleChartInstance || !uploadTrendChartInstance) {
            console.log("Chart not ready yet, retrying in 1 second...");
            setTimeout(() => {
                if (roleChartInstance && uploadTrendChartInstance) {
                    console.log("Retrying chart update...");
                    updateRoleChart(departmentCounts);
                    processTrendData(document.getElementById('trendFilter')?.value || 'weekly');
                } else {
                    console.error("Chart instance still not available after retry!");
                }
            }, 1000);
        } else {
            console.log("Updating charts now...");
            updateRoleChart(departmentCounts);
            processTrendData(document.getElementById('trendFilter')?.value || 'weekly');
        }
        
    } catch (error) {
        console.error("❌ Error loading dashboard stats:", error);
        console.error("Error details:", {
            code: error.code,
            message: error.message
        });
        
        // Show error in UI
        const totalUsersCard = document.getElementById('totalUsersCount') || document.querySelector('.text-3xl.font-bold');
        if (totalUsersCard) {
            totalUsersCard.textContent = "ERROR";
            totalUsersCard.classList.add('text-red-600');
        }
    }
}

// ========== PASSWORD RESET FUNCTION ==========
window.resetUserPassword = async function(email) {
    const confirmed = await window.showConfirm(
        'Password Reset Request',
        `Are you sure you want to send a password reset link to ${email}?`
    );

    if (confirmed) {
        try {
            await sendPasswordResetEmail(auth, email);
            window.showToast('PASSWORD RESET LINK SENT SUCCESSFULLY! 📧', 'success', 3000);
        } catch (error) {
            console.error("Error sending password reset:", error);
            if (error.code === 'auth/user-not-found') {
                window.showToast('User not found in authentication system', 'error', 3000);
            } else {
                window.showToast('Error: ' + error.message, 'error', 3000);
            }
        }
    }
};

// ========== TOGGLE ACCOUNT STATUS ==========
window.toggleAccountStatus = async function(userId, currentStatus, dept) {
    const newStatus = currentStatus === 'disabled' ? 'active' : 'disabled';
    const actionText = newStatus === 'disabled' ? 'disable' : 'activate';

    const confirmed = await window.showConfirm(
        'Account Status Update',
        `Are you sure you want to ${actionText.toUpperCase()} this account? This will affect the user's login access.`
    );

    if (confirmed) {
        try {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, {
                status: newStatus
            });
            
            window.showToast(`Account ${newStatus.toUpperCase()}D successfully`, 'danger', 3000);
            await loadUsersByDept(dept);
            await loadDashboardStats(); // Refresh dashboard stats
        } catch (error) {
            console.error("Error toggling account status:", error);
            window.showToast('Error updating account status: ' + error.message, 'error', 3000);
        }
    }
};

// ========== ADD/EDIT USER MODAL FUNCTIONALITY ==========
const addUserModal = document.getElementById('addUserModal');
const addUserBtn = document.getElementById('addUserBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const addUserForm = document.getElementById('addUserForm');
const modalTitle = document.querySelector('#addUserModal h3');

const modalEmail = document.getElementById('modalEmail');
const modalPassword = document.getElementById('modalPassword');
const modalConfirmPassword = document.getElementById('modalConfirmPassword');
const modalDepartment = document.querySelector('select[name="department"]');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const submitUserBtn = document.getElementById('submitUserBtn');

let isEmailValid = false;
let isPasswordValid = false;
let isDepartmentValid = false;

function openModal() {
    emailError.classList.add('hidden');
    passwordError.classList.add('hidden');
    modalEmail.classList.remove('border-green-600', 'border-red-600');
    modalConfirmPassword.classList.remove('border-green-600', 'border-red-600');

    addUserModal.classList.remove('hidden');

    setTimeout(() => {
        addUserModal.classList.remove('opacity-0');
        addUserModal.querySelector('div').classList.remove('scale-95');
    }, 10);
    checkFormValidity();
}

function closeModal() {
    addUserModal.classList.add('opacity-0');
    addUserModal.querySelector('div').classList.add('scale-95');
    
    setTimeout(() => {
        addUserModal.classList.add('hidden');
        resetToAddMode();
    }, 300);
}

function resetToAddMode() {
    addUserForm.reset();
    editUserId = null;
    modalTitle.textContent = "ADD NEW USER";
    submitUserBtn.textContent = "SAVE USER";
    
    modalEmail.disabled = false;
    modalEmail.classList.remove('bg-gray-100', 'cursor-not-allowed');

    modalPassword.required = true;
    modalConfirmPassword.required = true;

    const passwordFields = modalPassword.parentElement.parentElement;
    if (passwordFields) passwordFields.classList.remove('hidden');
    
    isEmailValid = false;
    isPasswordValid = false;
    isDepartmentValid = false;
    checkFormValidity();
}

function checkFormValidity() {
    const fName = addUserForm.firstName.value.trim();
    const lName = addUserForm.lastName.value.trim();
    const dept = modalDepartment.value;
    
    const hasRequiredInfo = fName !== "" && lName !== "" && dept !== "" && dept !== null;

    if (editUserId) {
        submitUserBtn.disabled = !hasRequiredInfo;
    } else {
        submitUserBtn.disabled = !(hasRequiredInfo && isEmailValid && isPasswordValid);
    }
}

// Email Validation
if (modalEmail) {
    modalEmail.addEventListener('input', function() {
        if (modalEmail.disabled) return;
        
        const email = this.value;
        const suffix = "@lancastertechdev.com";
        
        if (email.endsWith(suffix) && email.length > suffix.length) {
            emailError.classList.add('hidden');
            modalEmail.classList.remove('border-red-600');
            modalEmail.classList.add('border-green-600');
            isEmailValid = true;
        } else if (email === "") {
            emailError.classList.add('hidden');
            modalEmail.classList.remove('border-green-600', 'border-red-600');
            isEmailValid = false;
        } else {
            emailError.classList.remove('hidden');
            modalEmail.classList.remove('border-green-600');
            modalEmail.classList.add('border-red-600');
            isEmailValid = false;
        }
        checkFormValidity();
    });
}

// Password Validation
function validatePasswords() {
    const pass = modalPassword.value;
    const confirmPass = modalConfirmPassword.value;
    
    if (confirmPass === "") {
        passwordError.classList.add('hidden');
        modalConfirmPassword.classList.remove('border-green-600', 'border-red-600');
        isPasswordValid = false;
    } else if (pass === confirmPass) {
        passwordError.classList.add('hidden');
        modalConfirmPassword.classList.remove('border-red-600');
        modalConfirmPassword.classList.add('border-green-600');
        isPasswordValid = true;
    } else {
        passwordError.classList.remove('hidden');
        modalConfirmPassword.classList.remove('border-green-600');
        modalConfirmPassword.classList.add('border-red-600');
        isPasswordValid = false;
    }
    checkFormValidity();
}

if (modalPassword && modalConfirmPassword) {
    modalPassword.addEventListener('input', validatePasswords);
    modalConfirmPassword.addEventListener('input', validatePasswords);
}

// Name Input Listeners
if (addUserForm.firstName) addUserForm.firstName.addEventListener('input', checkFormValidity);
if (addUserForm.lastName) addUserForm.lastName.addEventListener('input', checkFormValidity);

// Department Validation
if (modalDepartment) {
    modalDepartment.addEventListener('change', function() {
        isDepartmentValid = this.value !== "" && this.value !== null;
        checkFormValidity();
    });
}

// Modal Event Listeners
if (addUserBtn) {
    addUserBtn.addEventListener('click', () => {
        resetToAddMode();
        openModal();
    });
}

if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

if (addUserModal) {
    addUserModal.addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
}

// ========== FORM SUBMISSION ==========
if (addUserForm) {
    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('submitUserBtn');
        const originalBtnText = submitBtn.textContent;
        
        if (editUserId) {
            // UPDATE MODE
            submitBtn.disabled = true;
            submitBtn.textContent = "UPDATING...";
            
            try {
                const firstName = addUserForm.firstName.value;
                const lastName = addUserForm.lastName.value;
                const department = addUserForm.department.value;
                
                await updateDoc(doc(db, "users", editUserId), {
                    firstName: firstName.toUpperCase(),
                    lastName: lastName.toUpperCase(),
                    department: department
                });
                
                window.showToast('USER INFORMATION UPDATED SUCCESSFULLY! ', 'success', 3000);
                closeModal();
                
                if (typeof window.loadUsersByDept === 'function') {
                    await window.loadUsersByDept(department);
                }
                await loadDashboardStats(); // Refresh dashboard stats
                
            } catch (error) {
                console.error("Error updating user:", error);
                window.showToast('Error updating user: ' + error.message, 'error', 3000);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
            
        } else {
            // ADD MODE
            const firstName = addUserForm.firstName.value;
            const lastName = addUserForm.lastName.value;
            const email = addUserForm.email.value;
            const password = addUserForm.password.value;
            const department = addUserForm.department.value;

            submitBtn.disabled = true;
            submitBtn.textContent = "CHECKING...";

            try {
                const q = query(collection(db, "users"), where("email", "==", email));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    window.showToast('Email already exists in database', 'error', 3000);
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalBtnText;
                    return;
                }

                submitBtn.textContent = "SAVING...";
                
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const uid = userCredential.user.uid;

                await setDoc(doc(db, "users", uid), {
                    firstName: firstName.toUpperCase(),
                    lastName: lastName.toUpperCase(),
                    email: email,
                    department: department,
                    role: "USER",
                    status: "active",
                    createdAt: serverTimestamp()
                });

                window.showToast('NEW USER ADDED SUCCESSFULLY! 🎉', 'success', 3000);
                addUserForm.reset();
                closeModal();

                if (typeof window.loadUsersByDept === 'function') {
                    await window.loadUsersByDept(department);
                }
                await loadDashboardStats(); // Refresh dashboard stats

            } catch (error) {
                console.error("Error adding user:", error);
                
                if (error.code === 'auth/email-already-in-use') {
                    window.showToast('Email already exists in Auth. Please delete from Firebase Console first.', 'warning', 5000);
                } else if (error.code === 'auth/invalid-email') {
                    window.showToast('Invalid email format', 'error', 3000);
                } else if (error.code === 'auth/weak-password') {
                    window.showToast('Password should be at least 6 characters', 'error', 3000);
                } else {
                    window.showToast('Error: ' + error.message, 'error', 3000);
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        }
    });
}

// ========== ADD TEMPLATE MODAL FUNCTIONALITY ==========
const addTemplateModal = document.getElementById('addTemplateModal');
const addTemplateBtn = document.getElementById('addTemplateBtn');
const closeTemplateModalBtn = document.getElementById('closeTemplateModalBtn');
const cancelTemplateModalBtn = document.getElementById('cancelTemplateModalBtn');
const addTemplateForm = document.getElementById('addTemplateForm');
const templateFileInput = document.getElementById('templateFile');
const templateFileNameDisplay = document.getElementById('templateFileName');

function openTemplateModal() {
    addTemplateModal.classList.remove('hidden');
    setTimeout(() => {
        addTemplateModal.classList.remove('opacity-0');
        addTemplateModal.querySelector('div').classList.remove('scale-95');
    }, 10);
}

function closeTemplateModal() {
    addTemplateModal.classList.add('opacity-0');
    addTemplateModal.querySelector('div').classList.add('scale-95');
    
    setTimeout(() => {
        addTemplateModal.classList.add('hidden');
        addTemplateForm.reset();
        if (templateFileNameDisplay) templateFileNameDisplay.textContent = "";
    }, 300);
}

if (addTemplateBtn) {
    addTemplateBtn.addEventListener('click', openTemplateModal);
}

window.openTemplateModal = openTemplateModal;

if (closeTemplateModalBtn) closeTemplateModalBtn.addEventListener('click', closeTemplateModal);
if (cancelTemplateModalBtn) cancelTemplateModalBtn.addEventListener('click', closeTemplateModal);

if (addTemplateModal) {
    addTemplateModal.addEventListener('click', function(e) {
        if (e.target === this) closeTemplateModal();
    });
}

if (templateFileInput) {
    templateFileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            templateFileNameDisplay.textContent = `SELECTED: ${this.files[0].name.toUpperCase()}`;
        }
    });
}

if (addTemplateForm) {
    addTemplateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('submitTemplateBtn');
        const templateName = addTemplateForm.templateName.value.trim();
        const file = document.getElementById('templateFile').files[0];
        
        submitBtn.disabled = true;
        submitBtn.textContent = "SAVING...";

        try {
            await saveTemplate(templateName, file);
            window.showToast('TEMPLATE CREATED SUCCESSFULLY!', 'success', 3000);
            closeTemplateModal();
            loadTemplatesUI();
        } catch (error) {
            console.error("Error creating template:", error);
            window.showToast('Error: ' + error.message, 'error', 3000);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "SAVE TEMPLATE";
        }
    });
}

// ========== ADD FOLDER MODAL FUNCTIONALITY ==========
const addFolderModal = document.getElementById('addFolderModal');
const closeFolderModalBtn = document.getElementById('closeFolderModalBtn');
const cancelFolderModalBtn = document.getElementById('cancelFolderModalBtn');
const addFolderForm = document.getElementById('addFolderForm');

function openFolderModal() {
    addFolderModal.classList.remove('hidden');
    setTimeout(() => {
        addFolderModal.classList.remove('opacity-0');
        addFolderModal.querySelector('div').classList.remove('scale-95');
    }, 10);
}

function closeFolderModal() {
    addFolderModal.classList.add('opacity-0');
    addFolderModal.querySelector('div').classList.add('scale-95');
    
    setTimeout(() => {
        addFolderModal.classList.add('hidden');
        addFolderForm.reset();
    }, 300);
}

window.openFolderModal = openFolderModal; // Make it globally accessible
if (closeFolderModalBtn) closeFolderModalBtn.addEventListener('click', closeFolderModal);
if (cancelFolderModalBtn) cancelFolderModalBtn.addEventListener('click', closeFolderModal);

if (addFolderModal) {
    addFolderModal.addEventListener('click', function(e) {
        if (e.target === this) closeFolderModal();
    });
}

if (addFolderForm) {
    addFolderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('submitFolderBtn');
        const folderName = addFolderForm.folderName.value.trim();
        
        submitBtn.disabled = true;
        submitBtn.textContent = "CREATING...";

        try {
            await createFolder(folderName);
            window.showToast('FOLDER CREATED SUCCESSFULLY!', 'success', 3000);
            closeFolderModal();
            loadTemplatesUI();
        } catch (error) {
            console.error("Error creating folder:", error);
            window.showToast('Error: ' + error.message, 'error', 3000);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "CREATE FOLDER";
        }
    });
}


// ========== EDIT USER FUNCTION ==========
window.editUser = async function(userId) {
    editUserId = userId;
    
    try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const data = userSnap.data();
            
            modalTitle.textContent = "UPDATE USER INFORMATION";
            submitUserBtn.textContent = "UPDATE DETAILS";
            
            addUserForm.firstName.value = data.firstName;
            addUserForm.lastName.value = data.lastName;
            addUserForm.department.value = data.department;
            modalEmail.value = data.email;
            
            modalEmail.disabled = true;
            modalEmail.classList.add('bg-gray-100', 'cursor-not-allowed');
            
            modalPassword.required = false;
            modalConfirmPassword.required = false;

            const passwordFields = modalPassword.parentElement.parentElement;
            if (passwordFields) passwordFields.classList.add('hidden');

            isEmailValid = true;
            isPasswordValid = true;
            isDepartmentValid = true;
            
            openModal();
            
        } else {
            window.showToast('User not found', 'error', 3000);
        }
    } catch (error) {
        console.error("Error fetching user:", error);
        window.showToast('Error loading user data: ' + error.message, 'error', 3000);
    }
};

// ========== LOAD USERS BY DEPARTMENT ==========
async function loadUsersByDept(deptName) {
    const userTableBody = document.getElementById('userTableBody');
    
    const userSearchInput = document.getElementById('userSearch');
    if (userSearchInput) userSearchInput.value = '';

    if (!userTableBody) {
        console.error("User table body not found");
        return;
    }

    userTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-10 italic text-gray-400">Loading users...</td></tr>';

    try {
        const q = query(collection(db, "users"), where("department", "==", deptName));
        const querySnapshot = await getDocs(q);
        
        const roleCounts = {};
        
        userTableBody.innerHTML = '';

        if (querySnapshot.empty) {
            userTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-gray-400 font-bold uppercase">No Users found in ${deptName}</td></tr>`;
            return;
        }

        querySnapshot.forEach((doc) => {
            const user = doc.data();
            const userId = doc.id;
            const userStatus = user.status || 'active';
            const statusColor = userStatus === 'disabled' ? 'text-red-600' : 'text-gray-400';
            const disableLabel = userStatus === 'disabled' ? 'ENABLE' : 'DISABLE';
            
            const role = user.role || 'USER';
            roleCounts[role] = (roleCounts[role] || 0) + 1;

            const rowClass = userStatus === 'disabled' ? 'opacity-50 bg-gray-100' : '';

            const row = `
                <tr class="hover:bg-gray-50/50 transition-colors border-b border-gray-50 ${rowClass}">
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-maroon-ltd text-white flex items-center justify-center font-bold text-xs uppercase">
                                ${user.firstName ? user.firstName[0] : ''}${user.lastName ? user.lastName[0] : ''}
                            </div>
                            <div>
                                <p class="font-bold text-sm uppercase ${userStatus === 'disabled' ? 'text-gray-500' : ''}">${user.firstName || ''} ${user.lastName || ''}</p>
                                <p class="text-[10px] ${userStatus === 'disabled' ? 'text-gray-400' : 'text-gray-500'}">${user.email || ''}</p>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm font-bold text-gold-ltd">${user.department || ''}</td>
                    <td class="px-6 py-4">
                        <span class="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-bold uppercase">
                            ${user.role || 'USER'}
                        </span>
                        ${userStatus === 'disabled' ? '<span class="ml-2 px-2 py-1 bg-red-100 text-red-600 rounded-full text-[9px] font-bold uppercase">DISABLED</span>' : ''}
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex items-center justify-center gap-3">
                            <button onclick="resetUserPassword('${user.email}')" 
                                    class="text-blue-500 hover:text-blue-700 p-1.5 rounded-lg hover:bg-blue-50 transition-colors" 
                                    title="Send Reset Password Email">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
                                </svg>
                            </button>

                            <button onclick="editUser('${userId}')" 
                                    class="text-maroon-ltd hover:text-maroon-600 p-1.5 rounded-lg hover:bg-maroon-ltd/5 transition-colors" 
                                    title="Edit User Details">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                                </svg>
                            </button>

                            <button onclick="toggleAccountStatus('${userId}', '${userStatus}', '${user.department}')" 
                                    class="${statusColor} p-1.5 rounded-lg hover:bg-red-50 transition-colors group" 
                                    title="Toggle Account Status">
                                <div class="flex items-center gap-1.5">
                                    <span class="text-[11px] font-bold tracking-tighter uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                                        ${disableLabel}
                                    </span>
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                </div>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            userTableBody.innerHTML += row;
        });

        // Update the chart with department distribution from this department only
        // Or keep global view - your choice
        // For now, we'll update with global stats
        await loadDashboardStats();

    } catch (error) {
        console.error("Error loading users:", error);
        userTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-red-600 font-bold">Error loading users</td></tr>`;
    }
}

// Make functions global
window.loadUsersByDept = loadUsersByDept;
window.editUser = editUser;
window.resetUserPassword = resetUserPassword;
window.toggleAccountStatus = toggleAccountStatus;

// Add test function to console
window.testFirebaseConnection = async function() {
    console.log("Testing Firebase connection...");
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        console.log(`Found ${querySnapshot.size} users in Firestore`);
        querySnapshot.forEach((doc) => {
            console.log("-", doc.id, doc.data());
        });
        return querySnapshot.size;
    } catch (error) {
        console.error("Firebase error:", error);
        return 0;
    }
};
