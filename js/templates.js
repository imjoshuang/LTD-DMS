import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, where, setDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { getCurrentUser, db } from './auth.js';

let currentFolderId = null;
let currentFolderName = "Document Management";

const CLOUD_NAME = "dnch13q6f";
const UPLOAD_PRESET = "pdfs_dms";
const API_KEY = "rPmHgHmJ44keF5Y5JjNPVMPaWaQ";

/**
 * Share Modal Functionality
 */
window.openShareModal = async function(data, docId) {
    const modal = document.getElementById('shareModal');
    const title = document.getElementById('shareModalTitle');
    const searchInput = document.getElementById('userSearchInput');
    const searchResults = document.getElementById('searchResults');
    const accessList = document.getElementById('accessList');
    
    title.textContent = `Share "${data.name}"`;
    searchInput.value = '';
    searchResults.classList.add('hidden');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);

    const renderAccess = () => {
        const sharedWith = data.sharedWith || [];
        if (sharedWith.length === 0) {
            accessList.innerHTML = '<p class="text-[10px] text-gray-400 italic text-center py-4 uppercase">Only you have access</p>';
            return;
        }
        accessList.innerHTML = sharedWith.map(user => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-maroon-ltd text-white flex items-center justify-center text-[10px] font-bold">
                        ${user.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                        <p class="text-xs font-bold text-gray-900 uppercase">${user.name}</p>
                        <p class="text-[9px] text-gray-400 uppercase">${user.email} • ${user.dept}</p>
                    </div>
                </div>
                <button onclick="window.removeAccess('${docId}', '${user.uid}')" class="text-gray-300 hover:text-red-600 transition-colors p-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
        `).join('');
    };

    renderAccess();

    searchInput.oninput = async () => {
        const term = searchInput.value.toLowerCase().trim();
        if (term.length < 2) { searchResults.classList.add('hidden'); return; }

        const usersSnap = await getDocs(collection(db, "users"));
        const matches = [];
        usersSnap.forEach(uDoc => {
            const u = uDoc.data();
            const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
            if (fullName.includes(term) || u.email.toLowerCase().includes(term)) {
                matches.push({ uid: uDoc.id, ...u });
            }
        });

        if (matches.length > 0) {
            searchResults.innerHTML = matches.map(m => `
                <button onclick="window.grantAccess('${docId}', '${m.uid}', '${m.firstName} ${m.lastName}', '${m.email}', '${m.department}')" 
                        class="w-full text-left p-3 hover:bg-maroon-ltd/5 rounded-xl transition-colors flex items-center justify-between group">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-gray-100 text-maroon-ltd flex items-center justify-center text-[10px] font-bold uppercase group-hover:bg-maroon-ltd group-hover:text-white transition-colors">
                            ${m.firstName[0]}${m.lastName[0]}
                        </div>
                        <div>
                            <p class="text-xs font-bold text-gray-900 uppercase">${m.firstName} ${m.lastName}</p>
                            <p class="text-[9px] text-gray-400 uppercase">${m.email} • ${m.department}</p>
                        </div>
                    </div>
                    <svg class="w-4 h-4 text-maroon-ltd opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                </button>
            `).join('');
            searchResults.classList.remove('hidden');
        } else {
            searchResults.innerHTML = '<p class="p-4 text-xs text-gray-400 text-center uppercase font-bold tracking-widest">No matching employee found</p>';
            searchResults.classList.remove('hidden');
        }
    };
};

window.grantAccess = async function(docId, uid, name, email, dept) {
    try {
        let docRef = doc(db, "templates", docId);
        let targetDocId = docId;

        // Handle Materialization for Interactive Forms (Static items starting with st-)
        // Ginagawa nating permanenteng record sa DB ang static forms para gumana ang sharing
        if (docId.startsWith('st-')) {
            const staticMap = {
                'st-btaf': { name: 'BTAF FORM (INTERACTIVE)', fileUrl: '/BTAForm.html' },
                'st-breakdown': { name: 'TRAVEL EXPENSES BREAKDOWN (INTERACTIVE)', fileUrl: '/travel_expense_breakdown.html' },
                'st-predeploy': { name: 'PRE-DEPLOYMENT REPORT (INTERACTIVE)', fileUrl: '/pre_deployment.html' }
            };
            
            const toolInfo = staticMap[docId];
            if (toolInfo) {
                // I-check kung may existing record na para hindi doble
                const q = query(collection(db, "templates"), where("name", "==", toolInfo.name));
                const existingDocs = await getDocs(q);
                
                if (existingDocs.empty) {
                    const user = getCurrentUser();
                    const newDoc = await addDoc(collection(db, "templates"), {
                        ...toolInfo,
                        type: 'file',
                        sharedWith: [],
                        sharedWithUids: [],
                        createdAt: serverTimestamp(),
                        createdBy: user ? user.uid : 'admin',
                        parentId: null,
                        status: 'published'
                    });
                    docRef = doc(db, "templates", newDoc.id);
                    targetDocId = newDoc.id;
                } else {
                    docRef = doc(db, "templates", existingDocs.docs[0].id);
                    targetDocId = existingDocs.docs[0].id;
                }
            }
        }

        // I-save ang sharing access. Gumagamit tayo ng sharedWithUids para sa mabilis na query ni TSSO.
        await updateDoc(docRef, {
            sharedWith: arrayUnion({ uid, name, email, dept }),
            sharedWithUids: arrayUnion(uid)
        });

        window.showToast(`DOCUMENT SHARED SUCCESSFULLY WITH ${name.toUpperCase()} (${dept})`, 'success');
        document.getElementById('searchResults').classList.add('hidden');
        
        // I-refresh ang UI at ang Share Modal para makita ang updated list
        loadTemplatesUI();
        const updatedSnap = await getDocs(query(collection(db, "templates")));
        updatedSnap.forEach(d => { 
            if(d.id === targetDocId) window.openShareModal(d.data(), d.id); 
        });
    } catch (error) {
        console.error("Share error:", error);
        window.showToast("UNABLE TO SHARE DOCUMENT. PLEASE TRY AGAIN.", "error");
    }
};

/**
 * Ise-save ang template metadata sa Firestore at file sa Storage (kung may napili).
 */
export async function saveTemplate(templateName, file) {
    const user = getCurrentUser();
    let fileUrl = null;
    let filePath = null;

    if (file) {
        // Validation: Only allow PDF and Word
        const allowedExtensions = ['pdf', 'doc', 'docx'];
        const fileExt = file.name.split('.').pop().toLowerCase();
        
        if (!allowedExtensions.includes(fileExt)) {
            throw new Error('Only PDF and Word documents (.doc, .docx) are allowed.');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);
        formData.append('api_key', API_KEY);

        // GAMITIN ANG 'auto' ENDPOINT para suportahan ang Word at PDF
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            console.error('Cloudinary Error:', err);
            throw new Error('Failed to upload file to Cloudinary');
        }

            const data = await response.json();

            // Siguraduhin na may extension sa dulo para makilala ng openPreviewModal
            let finalUrl = data.secure_url;
            if (!finalUrl.toLowerCase().endsWith(`.${data.format}`)) {
                finalUrl = `${data.secure_url}.${data.format}`;
            }

            fileUrl = finalUrl; 
            filePath = data.public_id;
    }

    const docRef = await addDoc(collection(db, "templates"), {
        name: templateName,
        fileUrl: fileUrl,
        filePath: filePath,
        sharedWith: [],
        content: `\n<div class='p-8'>\n  <h1 class='text-2xl font-bold'>New Template: ${templateName}</h1>\n</div>`,
        createdAt: serverTimestamp(),
        createdBy: user ? user.uid : 'admin',
        parentId: currentFolderId || null,
        status: 'published'
    });

    return docRef.id;
}

/**
 * Creates a new folder entry in Firestore.
 */
export async function createFolder(folderName) {
    const user = getCurrentUser();
    const docRef = await addDoc(collection(db, "templates"), {
        name: folderName,
        type: 'folder',
        sharedWith: [],
        createdAt: serverTimestamp(),
        createdBy: user ? user.uid : 'admin',
        parentId: currentFolderId || null,
        status: 'published'
    });
    return docRef.id;
}

/**
 * Deletes a template and its associated file from storage.
 */
export async function deleteTemplate(templateId, filePath, templateName) {
    const confirmed = await window.showConfirm(
        'Delete Template',
        `Are you sure you want to delete "${templateName}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
        // Delete from Firestore
        await deleteDoc(doc(db, "templates", templateId));

        window.showToast('Template deleted successfully', 'success');
        loadTemplatesUI(); // Refresh UI
    } catch (error) {
        console.error("Error deleting template:", error);
        window.showToast('Error deleting template', 'error');
    }
}

/**
 * Renames a folder or file in Firestore.
 */
window.renameTemplate = async function(id, currentName) {
    const newName = prompt("Enter new name:", currentName);
    
    if (newName === null) return; // Cancelled
    
    const trimmedName = newName.trim();
    if (trimmedName === "" || trimmedName === currentName) return;

    try {
        const docRef = doc(db, "templates", id);
        await updateDoc(docRef, { 
            name: trimmedName,
            updatedAt: serverTimestamp() 
        });
        
        window.showToast('Renamed successfully', 'success');
        loadTemplatesUI();
    } catch (error) {
        console.error("Error renaming:", error);
        window.showToast('Error renaming item', 'error');
    }
};

/**
 * Kukunin ang listahan ng templates at i-re-render sa "documentsList" container.
 */
export async function loadTemplatesUI(folderId = currentFolderId, folderName = currentFolderName) {
    currentFolderId = folderId;
    currentFolderName = folderName;

    const container = document.getElementById('documentsList');
    if (!container) return;

    // I-update ang Title at mag-add ng Back button kung nasa loob ng folder
    const pageTitle = document.querySelector('#documentsSection h3');
    if (pageTitle) {
        if (currentFolderId) {
            pageTitle.innerHTML = `
                <div class="flex items-center gap-2">
                    <button onclick="loadTemplatesUI(null, 'Document Management')" class="hover:text-maroon-ltd transition-colors p-1 rounded-lg hover:bg-gray-100" title="Back to Root">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                    <span class="truncate">${currentFolderName.toUpperCase()}</span>
                </div>
            `;
        } else {
            pageTitle.textContent = "Document Management";
        }
    }

    container.innerHTML = `
        <div class="col-span-full py-20 text-center">
            <div class="animate-spin inline-block w-8 h-8 border-4 border-maroon-ltd border-t-transparent rounded-full mb-4"></div>
            <p class="text-gray-400 font-bold uppercase tracking-widest text-xs">Loading Templates...</p>
        </div>
    `;

    try {
        // Kukuhanin lahat at i-fi-filter sa JS para iwas sa index requirement sa initial setup
        const q = query(collection(db, "templates"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        
        // Listahan ng templates na papayagan lang makita
        const allowedTemplates = [
            "BTAF",
            "TRAVEL",
            "DEPLOYMENT"
        ];

        let filteredDocs = snap.docs.filter(doc => {
            const data = doc.data();
            const nameUpper = data.name ? data.name.toUpperCase() : "";
            return (data.parentId || null) === currentFolderId && (allowedTemplates.some(t => nameUpper.includes(t)) || data.type === 'folder');
        }).map(doc => ({ id: doc.id, ...doc.data() }));

        // Magdagdag ng Static HTML Forms kung nasa root folder
        if (!currentFolderId) {
            // Kuhanin ang mga pangalan na nasa database na para hindi mag-duplicate
            const existingNames = new Set(filteredDocs.map(d => d.name));

            const staticTools = [
                { id: 'st-btaf', name: 'BTAF FORM (INTERACTIVE)', fileUrl: '/BTAForm.html', type: 'file', isStatic: true, createdAt: { toDate: () => new Date() } },
                { id: 'st-breakdown', name: 'TRAVEL EXPENSES BREAKDOWN (INTERACTIVE)', fileUrl: '/travel_expense_breakdown.html', type: 'file', isStatic: true, createdAt: { toDate: () => new Date() } },
                { id: 'st-predeploy', name: 'PRE-DEPLOYMENT REPORT (INTERACTIVE)', fileUrl: '/pre_deployment.html', type: 'file', isStatic: true, createdAt: { toDate: () => new Date() } }
            ].filter(tool => !existingNames.has(tool.name)); // Pakita lang kung wala pa sa DB

            // I-prepend para laging nasa taas ang mga tools
            filteredDocs = [...staticTools, ...filteredDocs];
        }

        // Sort: Folders first, then files (including static ones)
        filteredDocs.sort((a, b) => {
            const aType = a.type || 'file';
            const bType = b.type || 'file';
            if (aType === 'folder' && bType !== 'folder') return -1;
            if (aType !== 'folder' && bType === 'folder') return 1;
            return 0;
        });

        if (filteredDocs.length === 0) {
            container.innerHTML = '<p class="col-span-full text-center text-gray-400 italic py-10 uppercase text-[10px] font-bold tracking-widest">No items found in this location.</p>';
            return;
        }

        container.innerHTML = '';
        filteredDocs.forEach((data) => {
            const date = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : 'N/A';
            
            // Detect File Extension for specific icons and colors
            let iconClass = 'bg-maroon-ltd/5 text-maroon-ltd';
            let iconSvg = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>'; // Default Template icon

            if (data.type === 'folder') {
                iconClass = 'bg-gold-ltd/10 text-gold-ltd';
                iconSvg = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>';
            } else if (data.fileUrl) {
                const ext = data.fileUrl.split('.').pop().toLowerCase().split(/[?#]/)[0] || 'html';
                if (ext === 'pdf') {
                    iconClass = 'bg-red-50 text-red-600';
                    iconSvg = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
                } else if (ext === 'html') {
                    iconClass = 'bg-amber-50 text-amber-600';
                    iconSvg = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>';
                } else if (['doc', 'docx'].includes(ext)) {
                    iconClass = 'bg-blue-50 text-blue-600';
                    iconSvg = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
                } else {
                    iconClass = 'bg-blue-50 text-blue-600';
                    iconSvg = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
                }
            }
            
            const card = document.createElement('div');
            
            // CHECK IF FOLDER OR FILE FOR STYLING
            const isFolder = data.type === 'folder';
            
            // Double Click logic: Kapag folder, pumasok sa loob
            card.ondblclick = () => {
                if (isFolder) {
                    window.loadTemplatesUI(data.id, data.name);
                }
            };

            // SETUP DROPDOWN ITEMS BASED ON TYPE
            const menuItems = `
                ${data.fileUrl ? `
                    <button onclick="window.openPreviewModal('${data.fileUrl}')" class="w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        Preview File
                    </button>` : ''}
                <button class="details-btn w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <svg class="w-3.5 h-3.5 text-gold-ltd" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    See Details
                </button>
                ${!data.isStatic ? `
                    <button onclick="window.renameTemplate('${data.id}', '${data.name}')" class="w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        Rename File
                    </button>
                    <button class="delete-btn w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-red-600 hover:bg-red-50 flex items-center gap-2">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        Delete Item
                    </button>
                ` : ''}
            `;

            if (isFolder) {
                // BOX TYPE FOR FOLDERS
                card.className = `bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-maroon-ltd/20 transition-all group flex flex-col items-start gap-4 cursor-pointer select-none relative h-44`;
                card.innerHTML = `
                    <div class="flex justify-between items-start w-full">
                        <div class="p-3 ${iconClass} rounded-2xl group-hover:bg-maroon-ltd group-hover:text-white transition-all duration-300">
                            ${iconSvg}
                        </div>
                        <div class="flex items-center gap-1 relative">
                            <button class="share-btn p-1.5 text-gray-400 hover:text-blue-600 transition-all opacity-0 invisible group-hover:opacity-100 group-hover:visible" title="Share to People">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                                </svg>
                            </button>
                            <button class="menu-trigger p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                            </button>
                            <div class="menu-dropdown hidden absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1 overflow-hidden">
                                ${menuItems}
                            </div>
                        </div>
                    </div>
                    <div class="mt-auto w-full">
                        <h4 class="font-bold text-xs text-gray-900 uppercase tracking-tight truncate w-full mb-1">${data.name}</h4>
                        <p class="text-[9px] text-gray-400 uppercase tracking-widest">Added: ${date}</p>
                    </div>
                `;
            } else {
                // LONG (HORIZONTAL) PRESENTATION FOR FILES
                card.className = `bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group flex items-center gap-4 cursor-pointer select-none col-span-full`;
                card.innerHTML = `
                    <div class="p-3 ${iconClass} rounded-xl group-hover:bg-maroon-ltd group-hover:text-white transition-all shrink-0">
                        ${iconSvg}
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="font-bold text-sm text-gray-900 uppercase tracking-tight truncate">${data.name}</h4>
                        <p class="text-[9px] text-gray-400 uppercase tracking-widest">Added: ${date}</p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <button class="share-btn p-1.5 text-gray-400 hover:text-blue-600 transition-all opacity-0 invisible group-hover:opacity-100 group-hover:visible" title="Share to People">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                            </svg>
                        </button>
                        <div class="relative">
                            <button class="menu-trigger p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                            </button>
                            <div class="menu-dropdown hidden absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1 overflow-hidden">
                                ${menuItems}
                            </div>
                        </div>
                    </div>
                `;
            }

            // Dropdown Menu Logic
            const trigger = card.querySelector('.menu-trigger');
            const dropdown = card.querySelector('.menu-dropdown');
            
            trigger.onclick = (e) => {
                e.stopPropagation();
                document.querySelectorAll('.menu-dropdown').forEach(d => {
                    if (d !== dropdown) d.classList.add('hidden');
                });
                dropdown.classList.toggle('hidden');
            };

            // Share listener (Only if button exists)
            const shareBtn = card.querySelector('.share-btn');
            if (shareBtn) {
                shareBtn.onclick = (e) => {
                    e.stopPropagation();
                    window.openShareModal(data, data.id);
                };
            }

            // Details listener
            const detailsBtn = card.querySelector('.details-btn');
            if (detailsBtn) {
                detailsBtn.onclick = () => {
                    dropdown.classList.add('hidden');
                    window.openDetailsModal(data);
                };
            }

            // Delete listener
            const deleteBtn = card.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.onclick = () => {
                    dropdown.classList.add('hidden');
                    const deleteTitle = isFolder ? "Delete Folder" : "Delete Template";
                    deleteTemplate(data.id, data.filePath, data.name, deleteTitle);
                };
            }

            container.appendChild(card);
        });
    } catch (e) {
        container.innerHTML = '<p class="text-red-600 uppercase text-xs font-bold">Error loading templates.</p>';
    }
}


/**
 * Opens the preview modal and loads the document URL.
 * FIXED: Better handling for PDFs and Office documents
 */
window.openPreviewModal = function(url) {
    const modal = document.getElementById('previewModal');
    const frame = document.getElementById('previewFrame');
    const downloadBtn = document.getElementById('downloadPreviewBtn');
    
    if (!modal || !frame) return;

    // 1. Linisin ang URL
    const cleanUrl = url.trim();
    
    // 2. Kunin ang extension nang tama (kahit may query params)
    const fileExtension = cleanUrl.split('.').pop().toLowerCase().split(/[?#]/)[0];
    
    let displayUrl = cleanUrl;

    if (fileExtension === 'pdf') {
        // NATIVE BROWSER PREVIEW (Pinaka-stable para sa PDF)
        displayUrl = cleanUrl; 
    } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileExtension)) {
        // GOOGLE DOCS VIEWER (Kailangan ito para sa Word/Excel)
        // Nagdagdag tayo ng random query para iwas sa "No Preview" cache error ng Google
        const cacheBuster = `&_cb=${Date.now()}`;
        displayUrl = `https://docs.google.com/gview?url=${encodeURIComponent(cleanUrl)}&embedded=true${cacheBuster}`;
    }

    // 3. I-clear ang frame bago mag-load ng bago (importante para hindi mag-flicker ang lumang file)
    frame.src = 'about:blank';
    
    setTimeout(() => {
        frame.src = displayUrl;
    }, 200);
    
    if (downloadBtn) downloadBtn.href = cleanUrl;

    // 4. I-show ang modal
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
};

/**
 * Opens the document details modal
 */
window.openDetailsModal = function(data) {
    const modal = document.getElementById('detailsModal');
    const content = document.getElementById('detailsContent');
    if (!modal || !content) return;

    const date = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : 'Just now';

    content.innerHTML = `
        <div class="space-y-4">
            <div class="bg-gray-50 p-4 rounded-2xl">
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Document Name</p>
                <p class="text-sm font-bold text-gray-900 uppercase">${data.name}</p>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Date Created</p>
                    <p class="text-xs font-semibold text-gray-700">${date}</p>
                </div>
                <div>
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
                    <span class="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[9px] font-bold uppercase">${data.status}</span>
                </div>
            </div>
            <div>
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Created By (UID)</p>
                <p class="text-[11px] font-mono text-gray-500 break-all">${data.createdBy}</p>
            </div>
            ${data.filePath ? `
            <div>
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Cloudinary Public ID</p>
                <p class="text-[11px] font-mono text-gray-500 break-all">${data.filePath}</p>
            </div>
            ` : ''}
            ${data.fileUrl ? `
            <div>
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Secure URL</p>
                <a href="${data.fileUrl}" target="_blank" class="text-xs text-blue-600 hover:underline break-all">${data.fileUrl}</a>
            </div>
            ` : ''}
        </div>
    `;

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
};

window.closeDetailsModal = function() {
    const modal = document.getElementById('detailsModal');
    if (modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
};

/**
 * Closes the preview modal
 */
window.closePreviewModal = function() {
    const modalElement = document.getElementById('previewModal');
    const frame = document.getElementById('previewFrame');
    
    if (modalElement) {
        modalElement.classList.add('opacity-0');
        if (frame) {
            // Stop loading and clear content
            frame.src = 'about:blank';
        }
        setTimeout(() => {
            modalElement.classList.add('hidden');
        }, 300);
    }
};

window.closeShareModal = function() {
    const modal = document.getElementById('shareModal');
    if (modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
};

window.removeAccess = async function(docId, uid) {
    const docRef = doc(db, "templates", docId);
    const snap = await getDocs(query(collection(db, "templates")));
    let userDataToRemove = null;
    snap.forEach(d => { if(d.id === docId) userDataToRemove = d.data().sharedWith.find(u => u.uid === uid); });
    
    if (userDataToRemove) {
        await updateDoc(docRef, { 
            sharedWith: arrayRemove(userDataToRemove),
            sharedWithUids: arrayRemove(uid)
        });
        window.showToast('Access removed', 'warning');
        loadTemplatesUI();
        window.closeShareModal();
    }
};

// I-expose sa window para matawag ng back button at double click
window.loadTemplatesUI = loadTemplatesUI;

// Re-initialize close listener (mas safe kaysa sa DOMContentLoaded sa loob ng module)
const initPreviewLogic = () => {
    const closeBtn = document.getElementById('closePreviewBtn');
    const modalElement = document.getElementById('previewModal');
    const closeShareBtn = document.getElementById('closeShareModalBtn');
    const doneShareBtn = document.getElementById('doneShareBtn');
    
    // Close details modal listeners
    const closeDetailsBtn = document.getElementById('closeDetailsModalBtn');
    const closeDetailsBtn2 = document.getElementById('closeDetailsBtn');
    const detailsModal = document.getElementById('detailsModal');
    
    if (closeBtn && modalElement) {
        // Remove existing listeners to prevent duplicates
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        
        newCloseBtn.onclick = () => {
            window.closePreviewModal();
        };
    }
    
    if (closeShareBtn) closeShareBtn.onclick = window.closeShareModal;
    if (doneShareBtn) doneShareBtn.onclick = window.closeShareModal;
    
    if (closeDetailsBtn) closeDetailsBtn.onclick = window.closeDetailsModal;
    if (closeDetailsBtn2) closeDetailsBtn2.onclick = window.closeDetailsModal;
    if (detailsModal) {
        detailsModal.onclick = (e) => {
            if (e.target === detailsModal) window.closeDetailsModal();
        };
    }
    
    // Also close modal when clicking outside (optional)
    const modalContainer = document.getElementById('previewModal');
    if (modalContainer) {
        modalContainer.onclick = (e) => {
            if (e.target === modalContainer) {
                window.closePreviewModal();
            }
        };
    }

    if (document.getElementById('shareModal')) {
        document.getElementById('shareModal').onclick = (e) => {
            if (e.target === document.getElementById('shareModal')) window.closeShareModal();
        };
    }

    // Close all menus when clicking anywhere else
    window.addEventListener('click', (e) => {
        if (!e.target.closest('.menu-trigger')) {
            document.querySelectorAll('.menu-dropdown').forEach(d => d.classList.add('hidden'));
        }
    });
};

initPreviewLogic();