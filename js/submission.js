// Import Firebase
import { db } from './auth.js';
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// Cloudinary Constants (Matching templates.js)
const CLOUD_NAME = "dnch13q6f";
const UPLOAD_PRESET = "pdfs_dms";
const API_KEY = "rPmHgHmJ44keF5Y5JjNPVMPaWaQ";

// Form Interactivity
document.addEventListener('DOMContentLoaded', async () => {
    const currentUserId = sessionStorage.getItem('userId');
    const templatesContainer = document.getElementById('templatesListGrid');
    const formSection = document.getElementById('interactiveFormSection');
    const templateSection = document.getElementById('templateSelectionSection');
    const stepperProgress = document.getElementById('stepperProgress');
    const submissionContent = document.getElementById('submissionContent');
    const footerActions = document.getElementById('footerActions');
    const reviewSection = document.getElementById('reviewSection');
    const supportingDocsReviewSection = document.getElementById('supportingDocsReviewSection');
    const validateBtn = document.getElementById('validateBtn');
    const finalSubmitBtn = document.getElementById('finalSubmitBtn');
    const formContainer = document.getElementById('formContainer');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const requestTitleInput = document.getElementById('requestTitle');

    let selectedTemplateId = null;
    let selectedTemplateName = null;
    let maxStepReached = 1; // Track the furthest step the user is allowed to access
    let supportingDocsData = [];
    let supportingDocsPreviewUrls = [];

    const revokeSupportingDocsPreviewUrls = () => {
        supportingDocsPreviewUrls.forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch (error) {
                // ignore revoke failures
            }
        });
        supportingDocsPreviewUrls = [];
    };

    const renderSupportingDocuments = (docs = []) => {
        const docsList = document.getElementById('supportingDocsList');
        const docsCount = document.getElementById('supportingDocsCount');

        supportingDocsData = Array.isArray(docs) ? docs.filter(Boolean) : [];

        if (docsCount) {
            docsCount.textContent = `${supportingDocsData.length} File${supportingDocsData.length === 1 ? '' : 's'}`;
        }

        if (!docsList) return;

        revokeSupportingDocsPreviewUrls();

        if (supportingDocsData.length === 0) {
            docsList.innerHTML = '<p class="col-span-full text-center text-gray-400 italic py-6 uppercase text-[10px] font-bold tracking-widest">No supporting documents attached.</p>';
            return;
        }

        docsList.innerHTML = supportingDocsData.map((doc, index) => {
            const isFileObject = doc?.file instanceof File;
            const url = typeof doc === 'string' ? doc : (doc?.url || (isFileObject ? URL.createObjectURL(doc.file) : ''));
            const name = typeof doc === 'string' ? `Attachment ${index + 1}` : (doc?.name || (isFileObject ? doc.file.name : `Attachment ${index + 1}`));
            const ext = name.includes('.') ? name.split('.').pop() : 'FILE';

            if (isFileObject && url) {
                supportingDocsPreviewUrls.push(url);
            }

            return `
                <div class="flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-100 bg-gray-50/80">
                    <div class="min-w-0">
                        <p class="text-xs font-bold text-gray-900 uppercase tracking-wide truncate" title="${name}">${name}</p>
                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">${ext.toUpperCase()}</p>
                    </div>
                    ${url ? `
                        <a href="${url}" target="_blank" rel="noopener noreferrer" class="shrink-0 px-3 py-2 rounded-xl bg-maroon-ltd text-white text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-colors">View</a>
                    ` : `
                        <span class="shrink-0 px-3 py-2 rounded-xl bg-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-widest">Attached</span>
                    `}
                </div>
            `;
        }).join('');
    };

    const getSelectedSupportingDocuments = () => {
        const file1 = document.getElementById('file1')?.files?.[0];
        const file2 = document.getElementById('file2')?.files?.[0];
        const selectedFiles = [file1, file2].filter(Boolean);

        return selectedFiles.map(file => ({
            name: file.name,
            url: ''
        }));
    };

    const normalizeSupportingDocument = (doc, index) => {
        if (!doc) return null;

        if (typeof doc === 'string') {
            return {
                name: `Attachment ${index + 1}`,
                url: doc
            };
        }

        return {
            name: doc.name || `Attachment ${index + 1}`,
            url: doc.url || ''
        };
    };

    const buildMergedSupportingDocuments = (overrides = {}) => {
        const existingDocs = Array.isArray(supportingDocsData)
            ? supportingDocsData.map((doc, index) => normalizeSupportingDocument(doc, index)).filter(Boolean)
            : [];

        const mergedDocs = [...existingDocs];
        const slotEntries = [
            { index: 0, file: document.getElementById('file1')?.files?.[0] || null },
            { index: 1, file: document.getElementById('file2')?.files?.[0] || null }
        ];

        slotEntries.forEach(({ index, file }) => {
            const overrideDoc = overrides[index];
            const baseDoc = normalizeSupportingDocument(mergedDocs[index], index);

            if (overrideDoc) {
                mergedDocs[index] = normalizeSupportingDocument(overrideDoc, index);
                return;
            }

            if (file) {
                mergedDocs[index] = {
                    name: file.name,
                    file,
                    url: ''
                };
                return;
            }

            if (baseDoc) {
                mergedDocs[index] = baseDoc;
            }
        });

        return mergedDocs.filter(Boolean);
    };

    const setRevisionUIVisibility = (isRevisionMode) => {
        const notificationBanner = document.getElementById('revisionNotificationBanner');
        const remarksBox = document.getElementById('verifierRemarksDisplay');
        const justSection = document.getElementById('justificationSection');
        const uploadSection = document.getElementById('uploadAttachmentSection');

        if (notificationBanner) notificationBanner.classList.toggle('hidden', !isRevisionMode);
        if (remarksBox) remarksBox.classList.toggle('hidden', !isRevisionMode);
        if (justSection) justSection.classList.toggle('hidden', !isRevisionMode);

        // Supporting documents must be available in the normal new submission flow as well.
        // Keep the upload section visible for both new submissions and revisions.
        if (uploadSection) uploadSection.classList.remove('hidden');

        if (!isRevisionMode) {
            const remarksText = document.getElementById('verifierRemarksText');
            const notificationText = document.getElementById('revisionNotificationText');
            const justificationInput = document.getElementById('requestorJustification');

            if (remarksText) remarksText.textContent = '';
            if (notificationText) notificationText.textContent = '';
            if (justificationInput) justificationInput.value = '';
        }
    };

    const clearRevisionSession = () => {
        sessionStorage.removeItem('editingRevisionId');
        sessionStorage.removeItem('currentStatus');
        setRevisionUIVisibility(false);

        ['file1', 'file2'].forEach((inputId) => {
            const input = document.getElementById(inputId);
            if (input) input.value = '';
        });

        supportingDocsData = [];
        revokeSupportingDocsPreviewUrls();
        renderSupportingDocuments([]);
    };

    const isRevisionModeActive = () => {
        return !!sessionStorage.getItem('editingRevisionId');
    };

    // --- STEPPER LOGIC ---
    const updateStepper = (step, status = 'active') => {
        const stepEl = document.getElementById(`step${step}`);
        const circle = stepEl.querySelector('.step-circle');
        const num = stepEl.querySelector('.step-num');
        const text = stepEl.querySelector('.step-text');

        if (status === 'completed') {
            circle.className = "step-circle w-10 h-10 bg-maroon-ltd text-white rounded-full flex items-center justify-center border-4 border-white shadow-sm";
            num.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>';
            text.classList.add('text-maroon-ltd');
            text.classList.remove('text-gray-300');
        } else if (status === 'active') {
            circle.className = "step-circle w-10 h-10 bg-white text-maroon-ltd rounded-full flex items-center justify-center border-4 border-maroon-ltd shadow-lg scale-110";
            num.textContent = step;
            text.classList.add('text-maroon-ltd');
            text.classList.remove('text-gray-300');
        } else if (status === 'inactive') {
            circle.className = "step-circle w-10 h-10 bg-white text-gray-300 rounded-full flex items-center justify-center border-4 border-gray-100 shadow-sm scale-100";
            num.textContent = step;
            text.classList.add('text-gray-300');
            text.classList.remove('text-maroon-ltd');
        }
    };

    // Helper function to lock/unlock iframe inputs
    const toggleIframeReadOnly = (readonly) => {
        const iframe = document.getElementById('templateFrame');
        const frameDoc = iframe?.contentDocument || iframe?.contentWindow?.document;
        if (!frameDoc) return;

        const elements = frameDoc.querySelectorAll('input, textarea, select');
        elements.forEach(el => {
            if (el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT') {
                el.disabled = readonly;
            } else {
                // Siguraduhin na hindi natin binubuksan ang mga naturally readonly fields (totals)
                if (readonly) {
                    if (!el.readOnly) {
                        el.dataset.wasMutable = "true";
                        el.readOnly = true;
                    }
                } else {
                    if (el.dataset.wasMutable === "true") {
                        el.readOnly = false;
                    }
                }
            }
        });

        // Itago ang lahat ng interactive elements (Buttons, controls) sa Review Mode
        frameDoc.querySelectorAll('button.no-print, input[type="file"]').forEach(el => {
            if (readonly) {
                el.style.display = 'none';
            } else {
                // Panatilihing nakatago ang signature file input (Choose File) dahil may custom button tayo
                if (el.id === 'requestedByInput') {
                    el.style.display = 'none';
                } else {
                    el.style.display = '';
                }
            }
        });
    };

    // --- NAVIGATION LOGIC ---
    const navigateToStep = (targetStep) => {
        // Enforce strict progression: Cannot jump to locked steps
        const isRevisionMode = isRevisionModeActive();

        if (isRevisionMode && targetStep === 1) {
            window.showNotice?.('Action Blocked', 'You cannot change the template while in Revision Mode.');
            return;
        }

        // Enforce progression for forward steps
        if (targetStep > maxStepReached) return;

        // Step 1: Template Selection
        if (targetStep === 1) {
            templateSection.classList.remove('hidden');
            formSection.classList.add('hidden');
            reviewSection.classList.add('hidden');
            footerActions.classList.add('hidden');
            
            // Reset Form Container Styles
            if (formContainer) {
                formContainer.style.height = '900px';
                formContainer.className = "relative bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden";
                document.getElementById('templateFrame').style.height = '100%';
            }

            updateStepper(1, 'active');
            updateStepper(2, 'inactive');
            updateStepper(3, 'inactive');
            if (stepperProgress) stepperProgress.style.width = '0%';
        } 
        // Step 2: Form Filling (Drafting)
        else if (targetStep === 2) {
            const iframe = document.getElementById('templateFrame');
            // Bawal lumipat sa Step 2 kung wala pang napipiling template
            if (!iframe.src || iframe.src === 'about:blank') return; 

            templateSection.classList.add('hidden');
            formSection.classList.remove('hidden');
            reviewSection.classList.add('hidden');
            footerActions.classList.remove('hidden');
            
            // --- REVISION MODE UI: Ipakita ang Verify Section habang nagfi-fill out ---
            const isRev = isRevisionModeActive();
            setRevisionUIVisibility(isRev);
            if (supportingDocsReviewSection) supportingDocsReviewSection.classList.add('hidden');

            // Restore Interactive/Drafting View
            formContainer.style.height = '900px';
            formContainer.className = "relative bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden";
            iframe.style.height = '100%';

            // Gawing editable ulit ang form
            toggleIframeReadOnly(false);

            // Ipakita ang 'Next: Review' button at itago ang 'Final Submit'
            if (validateBtn) validateBtn.classList.remove('hidden');
            if (finalSubmitBtn) finalSubmitBtn.classList.add('hidden');

            updateStepper(1, 'completed');
            updateStepper(2, 'active');
            updateStepper(3, 'inactive');
            if (stepperProgress) stepperProgress.style.width = '33.33%';
        }
        // Step 3: Review Mode
        else if (targetStep === 3) {
            const iframe = document.getElementById('templateFrame');
            if (!iframe.src || iframe.src === 'about:blank') return;

            templateSection.classList.add('hidden');
            formSection.classList.remove('hidden'); // Manatiling visible ang form para ma-review
            reviewSection.classList.remove('hidden'); // Ipakita ang "Review Mode" banner
            footerActions.classList.remove('hidden');

            // --- REVISION MODE UI: Panatilihing visible ang Verify Section sa Review step ---
            const isRev = isRevisionModeActive();
            setRevisionUIVisibility(isRev);
            if (supportingDocsReviewSection) supportingDocsReviewSection.classList.remove('hidden');

            // PDF Style Presentation: Center the document, remove fixed height, remove internal scrolls
            formContainer.style.height = 'auto';
            formContainer.className = "relative bg-white shadow-2xl border-none flex flex-col items-center mb-10";
            iframe.style.height = '2850px'; // Set height large enough to avoid internal scrolling
            iframe.style.width = '100%';
            
            // I-lock ang form para sa review
            toggleIframeReadOnly(true);

            const selectedFilesForReview = buildMergedSupportingDocuments();
            if (selectedFilesForReview.length > 0) {
                renderSupportingDocuments(selectedFilesForReview);
            } else if (supportingDocsData.length > 0) {
                renderSupportingDocuments(supportingDocsData);
            }

            // Itago ang 'Next: Review' at ipakita ang 'Final Submit'
            if (validateBtn) validateBtn.classList.add('hidden');
            if (finalSubmitBtn) {
                finalSubmitBtn.classList.remove('hidden');
                // Palitan ang label kung ito ay resubmission
                finalSubmitBtn.textContent = isRevisionMode ? "RESUBMIT REQUEST" : "FINAL SUBMISSION";
            }

            updateStepper(1, 'completed');
            updateStepper(2, 'completed');
            updateStepper(3, 'active');
            if (stepperProgress) stepperProgress.style.width = '66.66%';
        }
    };

    // Gawing clickable ang stepper items para sa madaling navigation
    [1, 2, 3, 4].forEach(stepNum => {
        const el = document.getElementById(`step${stepNum}`);
        if (el) {
            el.classList.add('cursor-pointer');
            el.onclick = () => {
                if (stepNum <= maxStepReached) navigateToStep(stepNum);
            };
        }
    });

    // I-expose ang functions sa window
    window.navigateToStep = navigateToStep;
    window.setAllowedStep = (step) => { maxStepReached = step; };

    // --- DRAFT MANAGEMENT ---
    // I-expose ang function sa window para matawag ng handleValidateAndSubmit()
    window.navigateToStep = navigateToStep;

    // --- LOAD TEMPLATES WITH ACCESS ---
    const loadTemplates = async () => {
        if (!currentUserId) return;
        
        try {
            const q = query(collection(db, "templates"), where("sharedWithUids", "array-contains", currentUserId));
            const snap = await getDocs(q);
            
            // I-filter sa JS para siguradong accurate at tanging BTAF file lang ang lalabas
            // Iniiwasan nito ang paglabas ng folders o ibang dokumento na hindi fillable
            const availableTemplates = snap.docs.filter(doc => {
                const data = doc.data();
                const nameUpper = data.name ? data.name.toUpperCase() : "";
                return (data.type === 'file' || !data.type) && 
                       data.status === 'published' && 
                       nameUpper.includes("BTAF");
            });

            if (availableTemplates.length === 0) {
                templatesContainer.innerHTML = '<p class="text-xs text-gray-400 uppercase italic">No fillable templates shared with you.</p>';
                return;
            }

            templatesContainer.innerHTML = '';
            availableTemplates.forEach(doc => {
                const data = doc.data();
                const card = document.createElement('div');
                card.className = "bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-maroon-ltd/20 transition-all cursor-pointer group";
                card.innerHTML = `
                    <div class="flex items-center gap-4">
                        <div class="p-3 bg-gray-50 rounded-xl group-hover:bg-maroon-ltd group-hover:text-white transition-all text-maroon-ltd">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        </div>
                        <div>
                            <h4 class="font-bold text-sm text-gray-900 uppercase font-oswald tracking-tight">${data.name}</h4>
                            <p class="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Interactive Template</p>
                        </div>
                    </div>
                `;
                
                card.onclick = () => selectTemplate(doc.id, data.name, data.fileUrl);
                templatesContainer.appendChild(card);
            });
        } catch (err) {
            console.error(err);
        }
    };

    const selectTemplate = (id, name, url) => {
        selectedTemplateId = id;
        selectedTemplateName = name;

        // Unlock and navigate to Step 2
        maxStepReached = 2;
        navigateToStep(2);
        
        // Switch View
        templateSection.classList.add('hidden');
        formSection.classList.remove('hidden');
        
        // Show Footer Buttons
        if (footerActions) footerActions.classList.remove('hidden');
        
        // Load the actual template URL into the inline iframe
        const templateFrame = document.getElementById('templateFrame');
        if (templateFrame && url) {
            let cleanUrl = url.trim();
            
            // Hotfix: Siguraduhin na BTAF.html ang gagamitin imbes na BTAForm.html
            if (cleanUrl.includes('BTAForm.html')) {
                cleanUrl = cleanUrl.replace('BTAForm.html', 'BTAF.html');
            }

            templateFrame.src = cleanUrl.startsWith('/') ? `..${cleanUrl}` : cleanUrl;
        }
    };

    // Cloudinary Upload Helper
    const uploadToCloudinary = async (file) => {
        if (!file) return null;
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);
        formData.append('api_key', API_KEY);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            console.error('Cloudinary Error:', err);
            throw new Error(`Failed to upload ${file.name}`);
        }

        const data = await response.json();
        return { url: data.secure_url, name: file.name };
    };

    // --- FINAL SUBMISSION LOGIC ---
    window.handleFinalSubmission = async () => {
        const btn = document.getElementById('finalSubmitBtn');
        if (!btn) return;

        const confirmed = await window.showConfirm('Final Submission', 'Are you sure you want to submit this request to the verifier?');
        if (!confirmed) return;

        // 1. Loading State
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.classList.add('opacity-80', 'cursor-not-allowed');
        btn.innerHTML = `
            <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            PROCESSING...
        `;

        try {
            const iframe = document.getElementById('templateFrame');
            if (!iframe || !iframe.contentWindow || !iframe.contentWindow.getFormData) {
                throw new Error("Form is not ready or does not support submission.");
            }

            const requestTitle = requestTitleInput?.value.trim();
            const formData = iframe.contentWindow.getFormData();
            const justification = document.getElementById('requestorJustification')?.value.trim() || "";
            const userName = sessionStorage.getItem('userName');
            const userDept = sessionStorage.getItem('userDept');

            // 2. HANDLE FILE UPLOADS (For Proof/Justification)
            const file1 = document.getElementById('file1')?.files[0];
            const file2 = document.getElementById('file2')?.files[0];
            
            const slotUploads = await Promise.all([
                file1 ? uploadToCloudinary(file1) : Promise.resolve(null),
                file2 ? uploadToCloudinary(file2) : Promise.resolve(null)
            ]);

            const proofUrls = buildMergedSupportingDocuments({
                0: slotUploads[0],
                1: slotUploads[1]
            });
            renderSupportingDocuments(proofUrls);

            // Generate Request ID: LTD-YYYY-XXX
            const year = new Date().getFullYear();
            const qCount = query(collection(db, "submissions"));
            const countSnap = await getDocs(qCount);
            const sequence = (countSnap.size + 1).toString().padStart(3, '0');
            const requestId = `LTD-${year}-${sequence}`;

            const editingRevisionId = sessionStorage.getItem('editingRevisionId');
            const submissionPayload = {
                userId: currentUserId,
                requestorName: userName,
                department: userDept,
                templateName: selectedTemplateName,
                title: requestTitle,
                requestorJustification: justification,
                proofUrls: proofUrls, // Save the array of {url, name}
                formData: cleanData(formData),
                status: 'pending',
                priority: 'Normal',
                submittedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            if (editingRevisionId) {
                // UPDATE EXISTING RECORD (Keep original Request ID)
                const docRef = doc(db, "submissions", editingRevisionId);
                const originalSnap = await getDoc(docRef);
                const finalRequestId = originalSnap.exists() ? originalSnap.data().requestId : requestId;
                
                await updateDoc(docRef, { ...submissionPayload, requestId: finalRequestId });
                clearRevisionSession();
                window.onSubmissionComplete(finalRequestId);
            } else {
                // CREATE NEW SUBMISSION
                await addDoc(collection(db, "submissions"), { ...submissionPayload, requestId });
                window.onSubmissionComplete(requestId);
            }

        } catch (error) {
            console.error(error);
            btn.disabled = false;
            btn.innerHTML = originalContent;
            window.showNotice('Submission Failed', error.message);
        }
    };

    // Helper function to remove undefined values before sending to Firestore
    const cleanData = (obj) => {
        return JSON.parse(JSON.stringify(obj, (key, value) => {
            if (value === undefined) return null;
            return value;
        }));
    };

    // Function to save current form data as a draft
    window.handleSaveDraft = async () => {
        if (!currentUserId || !selectedTemplateId || !selectedTemplateName) {
            window.showNotice('Save Draft Failed', 'Please select a template first before saving a draft.');
            return;
        }

        const iframe = document.getElementById('templateFrame');
        if (!iframe || !iframe.contentWindow || !iframe.contentWindow.getFormData) {
            window.showNotice('Save Draft Failed', 'Template form is not ready or does not support saving drafts.');
            return;
        }

        const requestTitle = requestTitleInput?.value.trim();
        if (!requestTitle) {
            window.showNotice('Title Required', 'Please provide a title for your request before saving as a draft.');
            return;
        }

        // Get and sanitize form data
        const draftData = cleanData(iframe.contentWindow.getFormData());
        const draftIdToUpdate = sessionStorage.getItem('editingDraftId');

        loadingOverlay.classList.remove('hidden');
        loadingOverlay.querySelector('p').textContent = "Saving your draft...";

        try {
            if (draftIdToUpdate) {
                // Update existing draft
                const draftRef = doc(db, "draftSubmissions", draftIdToUpdate);
                await updateDoc(draftRef, {
                    requestTitle: requestTitle,
                    draftData: draftData,
                    updatedAt: serverTimestamp()
                });
            } else {
                // Create new draft
                const docRef = await addDoc(collection(db, "draftSubmissions"), {
                    userId: currentUserId,
                    requestTitle: requestTitle,
                    templateId: selectedTemplateId,
                    templateName: selectedTemplateName,
                    templateUrl: iframe.src, // Save the actual URL for loading
                    draftData: draftData,
                    status: 'draft',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                // I-save ang ID para sa susunod na update
                sessionStorage.setItem('editingDraftId', docRef.id);
            }

            // Itago agad ang loading bago ipakita ang modal para hindi magmukhang nag-hang
            loadingOverlay.classList.add('hidden');
            
            await window.showNotice('Draft Saved!', `Your draft "${requestTitle}" has been successfully updated.`);
            redirectToDashboard();

        } catch (error) {
            loadingOverlay.classList.add('hidden');
            console.error("Error saving draft:", error);
            window.showNotice('Save Draft Failed', 'There was an error saving your draft. Please try again.');
        }
    };

    // Helper function to redirect back to the New Submission tab in dashboard
    const redirectToDashboard = () => {
        sessionStorage.setItem('activeTab', 'newSubmission');
        window.location.href = 'tssodash.html';
    };

    // Function to load a draft into the form
    const loadDraft = async (draftId) => {
        loadingOverlay.classList.remove('hidden');
        loadingOverlay.querySelector('p').textContent = "Loading your draft...";

        let isRevision = false;

        try {
            // Subukan munang hanapin sa 'submissions' collection (para sa mga Revisions)
            let draftRef = doc(db, "submissions", draftId);
            let draftSnap = await getDoc(draftRef);

            // Kung wala sa submissions, hanapin sa 'draftSubmissions'
            if (!draftSnap.exists()) {
                draftRef = doc(db, "draftSubmissions", draftId);
                draftSnap = await getDoc(draftRef);
                isRevision = false;
            } else {
                // I-check kung ito ay tunay na Revision base sa status sa database
                const data = draftSnap.data();
                if (data.status === 'returned' || data.status === 'revision') {
                    isRevision = true;
                    sessionStorage.setItem('editingRevisionId', draftId);
                    sessionStorage.setItem('currentStatus', data.status);
                }
            }

            if (draftSnap.exists()) {
                const draft = draftSnap.data();
                selectedTemplateId = draft.templateId || 'st-btaf';
                selectedTemplateName = draft.templateName;

                if (requestTitleInput) {
                    requestTitleInput.value = draft.requestTitle || draft.title || '';
                }

                renderSupportingDocuments(draft.proofUrls || draft.supportingDocs || []);
                
                // --- REVISION MODE UI ENHANCEMENTS ---
                if (isRevision || draft.status === 'returned' || draft.status === 'revision') {
                    // 1. Ipakita ang status notification para malinaw na returned ang file
                    const notificationBanner = document.getElementById('revisionNotificationBanner');
                    const notificationText = document.getElementById('revisionNotificationText');
                    if (notificationBanner && notificationText) {
                        const currentStatus = (draft.status || '').toLowerCase();
                        notificationText.textContent = currentStatus === 'returned'
                            ? 'This file was returned by the verifier. Please check the remarks below, update the document, and resubmit after completing the required changes.'
                            : 'This request is currently under revision. Please review the remarks below, update the document, and submit again once resolved.';
                        notificationBanner.classList.remove('hidden');
                    }

                    // 2. Ipakita ang Justification Section (Remarks ni Requestor) - Sa itaas ng form
                    const justSection = document.getElementById('justificationSection');
                    if (justSection) {
                        justSection.classList.remove('hidden');
                    }

                    // 3. Ipakita ang Verifier Remarks Display (Feedback banner sa itaas ng Request Title)
                    const remarksBox = document.getElementById('verifierRemarksDisplay');
                    const remarksText = document.getElementById('verifierRemarksText');
                    if (remarksBox && remarksText) {
                        remarksText.textContent = draft.verifierRemarks || draft.remarks || "Please review the feedback and update your request.";
                        remarksBox.classList.remove('hidden');
                    }

                    // 4. Ipakita ang Upload Section (Para sa supporting documents)
                    const uploadSection = document.getElementById('uploadAttachmentSection');
                    if (uploadSection) {
                        uploadSection.classList.remove('hidden');
                        const uploadHeader = uploadSection.querySelector('h4');
                        if (uploadHeader) {
                            uploadHeader.textContent = "Upload Justification / Supporting Documents";
                        }
                    }
                }

                const iframe = document.getElementById('templateFrame');
                if (iframe) {
                    iframe.src = draft.templateUrl || '../BTAF.html';
                    iframe.onload = () => {
                        if (iframe.contentWindow && iframe.contentWindow.setFormData) {
                            // Gamitin ang formData kung revision, draftData kung normal draft
                            iframe.contentWindow.setFormData(draft.formData || draft.draftData);
                            maxStepReached = 2; // Unlock Step 2 for drafts
                            navigateToStep(2); // Navigate to form filling step
                            if (!isRevision) sessionStorage.setItem('editingDraftId', draftId);
                            window.showNotice(isRevision ? 'Revision Mode' : 'Data Restored!', `"${draft.templateName}" data has been loaded. ${isRevision ? 'Please review the verifier remarks and update your request.' : ''}`);
                        } else {
                            window.showNotice('Load Error', 'Template form is not ready.');
                        }
                        loadingOverlay.classList.add('hidden');
                    };
                }
            } else {
                window.showNotice('Load Draft Failed', 'Draft not found.');
                loadingOverlay.classList.add('hidden');
            }
        } catch (error) {
            console.error("Error loading draft:", error);
            window.showNotice('Load Draft Failed', 'There was an error loading your draft. Please try again.');
            loadingOverlay.classList.add('hidden');
        }
    };

    clearRevisionSession();
    setRevisionUIVisibility(false);

    // Check if there's a draft to load from sessionStorage on page load
    const draftIdToLoad = sessionStorage.getItem('draftIdToLoad');
    if (draftIdToLoad) {
        sessionStorage.removeItem('draftIdToLoad'); // Clear it immediately
        loadDraft(draftIdToLoad);
    }
    window.loadDraft = loadDraft; // Expose globally for tssodash.html

    const setupFileUpload = (inputId, labelId) => {
        const input = document.getElementById(inputId);
        const label = input?.nextElementSibling; // Ang span na katabi mismo ng input

        if (input && label) {
            input.addEventListener('change', (e) => {
                const fileName = e.target.files[0]?.name;
                label.textContent = fileName ? fileName : "Attach File...";
                
                label.classList.toggle('text-maroon-ltd', !!fileName);
                label.classList.toggle('text-gray-400', !fileName);

                // Keep Step 2 clean: do not render the supporting documents preview here.
                // The uploaded files will be displayed in Step 3 review mode.
            });
        }
    };

    setupFileUpload('file1');
    setupFileUpload('file2');

    // Clear editingDraftId if user navigates away from new_submission.html without saving/submitting
    window.addEventListener('beforeunload', () => {
        if (sessionStorage.getItem('editingDraftId')) {
            // Optionally, prompt user here if they want to save changes
            // For now, just clear it to avoid confusion if they abandon the draft
            sessionStorage.removeItem('editingDraftId');
        }
    });

    loadTemplates();
});
