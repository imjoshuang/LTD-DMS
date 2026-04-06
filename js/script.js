import { loginUser, logoutUser, db } from './auth.js';
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// Function para makuha ang tamang path depende sa department
function getRedirectPath(department) {
    switch (department) {
        case 'ADMIN': return 'dboard.html';
        case 'AFD':   return '../afd.html';
        case 'HR':    return '../hr.html';
        case 'ED':    return '../ed.html';
        case 'AGM':   return '../agmdash.html';
        case 'AGSD':  return '../agsd.html';
        case 'PMO':   return '../pmo.html';
        case 'TSD':   return '../tsd.html';
        case 'TSSO':  return '../TSSO/tssodash.html';
        case 'OPCEO': return '../opceo.html';
        case 'OGM':   return '../ogm.html';
        case 'LAS':   return '../las.html';
        case 'COS':   return '../cos.html';
        case 'CLO':   return '../clo.html';
        default:      return '../user-portal.html';
    }
}

// Kapag binuksan ang login page, i-check kung naka-login na.
// Kung oo, i-forward agad sila sa portal nila para hindi sila makabalik dito.
const checkSession = () => {
    const isLoggedIn = sessionStorage.getItem('userLoggedIn') === 'true';
    const userDept = sessionStorage.getItem('userDept');
    
    if (isLoggedIn && userDept) {
        console.log(`User is already logged in as ${userDept}. Redirecting forward...`);
        // Gumamit ng replace para hindi na mag-save ng history entry para sa login page
        window.location.replace(getRedirectPath(userDept));
    }
};

// Patakbuhin agad ang check
checkSession();

const passwordInput = document.getElementById('passwordInput');
const togglePassword = document.getElementById('togglePassword');
const eyeIcon = document.getElementById('eyeIcon');
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('emailInput');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

// Toast notification function with type support
function showToast(message, type = 'success', duration = 3000) {
    toastMessage.textContent = message;
    
    // Update toast styling based on type
    if (type === 'success') {
        toast.classList.remove('bg-red-600');
        toast.classList.add('bg-[#600000]', 'text-white');
        toastIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />';
    } else if (type === 'error') {
        toast.classList.remove('bg-[#600000]');
        toast.classList.add('bg-red-600', 'text-white');
        toastIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 1.677A9 9 0 0112 21c4.486 0 8.441-1.879 11.303-4.908m-10.303-1.677a9.001 9.001 0 01-7.222-3.664M15 9.75l-3-3m0 0l-3 3m3-3v12" />';
    }
    
    toast.classList.remove('opacity-0');
    toast.classList.add('opacity-100');
    
    setTimeout(() => {
        toast.classList.remove('opacity-100');
        toast.classList.add('opacity-0');
    }, duration);
}

// Expose showToast globally so other modules can call it
window.showToast = showToast;

// Eto yung Eye-Slash (Nakatago ang password)
const eyeClosedPath = '<path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />';

// Eto yung Normal Eye (Kita ang password)
const eyeOpenPath = '<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />';

// Sa simula, dapat Eye-Slash ang nakikita dahil hidden ang pass
eyeIcon.innerHTML = eyeClosedPath;

togglePassword.addEventListener('click', () => {
    const isPassword = passwordInput.getAttribute('type') === 'password';
    passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
    
    // Kapag naging 'text' (visible), ipakita ang Normal Eye.
    // Kapag naging 'password' (hidden), ipakita ang Eye-Slash.
    eyeIcon.innerHTML = isPassword ? eyeOpenPath : eyeClosedPath;
});

// Handle login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
        showToast('Please fill in all fields', 'error', 3000);
        return;
    }
    
    try {
        const result = await loginUser(email, password);
        
        if (result.success) {
            let userData = null;
            let department = '';
            let role = '';
            let firstName = '';
            let lastName = '';
            
            // Check if the user exists in Firestore
            try {
                const userDoc = await getDoc(doc(db, "users", result.user.uid));
                
                if (userDoc.exists()) {
                    userData = userDoc.data();
                    
                    // Check if account is disabled
                    if (userData.status === 'disabled') {
                        showToast('Your account has been disabled. Please contact the administrator.', 'error', 5000);
                        await logoutUser();
                        return;
                    }
                    
                    department = userData.department || 'USER';
                    role = userData.role || 'USER';
                    firstName = userData.firstName || '';
                    lastName = userData.lastName || '';
                } else {
                    // User not found in Firestore - could be admin account
                    console.log("User not found in Firestore, checking if admin...");
                    
                    // Check if this is the admin email
                    const adminEmails = ['admin-ltd@lancastertechdev.com', 'admin@lancastertechdev.com'];
                    
                    if (adminEmails.includes(email)) {
                        // This is an admin account
                        department = 'ADMIN';
                        role = 'ADMIN';
                        firstName = 'Admin';
                        lastName = 'User';
                        console.log("Admin account detected, setting department to ADMIN");
                    } else {
                        // Regular user but not in Firestore - shouldn't happen normally
                        showToast('User profile not found. Please contact administrator.', 'error', 3000);
                        await logoutUser();
                        return;
                    }
                }
            } catch (firestoreError) {
                console.error("Firestore error:", firestoreError);
                // If Firestore is unavailable, but user is admin, allow login
                if (email === 'admin-ltd@lancastertechdev.com' || email === 'admin@lancastertechdev.com') {
                    department = 'ADMIN';
                    role = 'ADMIN';
                    firstName = 'Admin';
                    lastName = 'User';
                    console.log("Firestore error but admin account detected, proceeding...");
                } else {
                    showToast('Unable to verify account. Please try again.', 'error', 3000);
                    await logoutUser();
                    return;
                }
            }
            
            console.log(`User logged in: ${email}, Department: ${department}, Role: ${role}`);
            showToast(`Welcome back, ${department} Portal! 🎉`, 'success', 2000);
            
            // Store login state in sessionStorage
            sessionStorage.setItem('userLoggedIn', 'true');
            sessionStorage.setItem('userEmail', result.user.email);
            sessionStorage.setItem('userDept', department);
            sessionStorage.setItem('userRole', role);
            sessionStorage.setItem('userName', `${firstName} ${lastName}`.trim());
            sessionStorage.setItem('userId', result.user.uid);
            
            // Redirect to dashboard after showing toast
            setTimeout(() => {
                const targetPage = getRedirectPath(department);
                console.log(`Redirecting to: ${targetPage} for department: ${department}`);
                window.location.replace(targetPage);
            }, 2000);
        } else {
            showToast('Invalid credentials. Please try again.', 'error', 3000);
        }
    } catch (error) {
        console.error("Login error:", error);
        showToast('Invalid credentials. Please try again.', 'error', 3000);
    }
});