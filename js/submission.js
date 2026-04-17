// Import Firebase
import { db } from './auth.js';
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

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
    const validateBtn = document.getElementById('validateBtn');
    const finalSubmitBtn = document.getElementById('finalSubmitBtn');
    const formContainer = document.getElementById('formContainer');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const requestTitleInput = document.getElementById('requestTitle');

    let selectedTemplateId = null;
    let selectedTemplateName = null;
    let maxStepReached = 1; // Track the furthest step the user is allowed to access

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
        frameDoc.querySelectorAll('.no-print').forEach(el => {
            el.style.display = readonly ? 'none' : '';
        });
    };

    // --- NAVIGATION LOGIC ---
    const navigateToStep = (targetStep) => {
        // Enforce strict progression: Cannot jump to locked steps
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

            // PDF Style Presentation: Center the document, remove fixed height, remove internal scrolls
            formContainer.style.height = 'auto';
            formContainer.className = "relative bg-white shadow-2xl border-none flex flex-col items-center mb-10";
            iframe.style.height = '2850px'; // Set height large enough to avoid internal scrolling
            iframe.style.width = '100%';
            
            // I-lock ang form para sa review
            toggleIframeReadOnly(true);

            // Itago ang 'Next: Review' at ipakita ang 'Final Submit'
            if (validateBtn) validateBtn.classList.add('hidden');
            if (finalSubmitBtn) finalSubmitBtn.classList.remove('hidden');

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
            const userName = sessionStorage.getItem('userName');
            const userDept = sessionStorage.getItem('userDept');

            // Generate Request ID: LTD-YYYY-XXX
            const year = new Date().getFullYear();
            const qCount = query(collection(db, "submissions"));
            const countSnap = await getDocs(qCount);
            const sequence = (countSnap.size + 1).toString().padStart(3, '0');
            const requestId = `LTD-${year}-${sequence}`;

            // Save to Firestore sa 'submissions' collection
            await addDoc(collection(db, "submissions"), {
                requestId,
                userId: currentUserId,
                requestorName: userName,
                department: userDept,
                templateName: selectedTemplateName,
                title: requestTitle,
                formData: cleanData(formData),
                status: 'pending',
                priority: 'Normal',
                submittedAt: serverTimestamp()
            });

            // Trigger completion logic in new_submission.html (Stepper & Modal)
            if (typeof window.onSubmissionComplete === 'function') {
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

        try {
            const draftRef = doc(db, "draftSubmissions", draftId);
            const draftSnap = await getDoc(draftRef);

            if (draftSnap.exists()) {
                const draft = draftSnap.data();
                selectedTemplateId = draft.templateId;
                selectedTemplateName = draft.templateName;

                if (requestTitleInput) {
                    requestTitleInput.value = draft.requestTitle || '';
                }

                const iframe = document.getElementById('templateFrame');
                if (iframe) {
                    iframe.src = draft.templateUrl;
                    iframe.onload = () => {
                        if (iframe.contentWindow && iframe.contentWindow.setFormData) {
                            iframe.contentWindow.setFormData(draft.draftData);
                            maxStepReached = 2; // Unlock Step 2 for drafts
                            navigateToStep(2); // Navigate to form filling step
                            sessionStorage.setItem('editingDraftId', draftId); // Store draft ID for updates
                            window.showNotice('Draft Loaded!', `"${draft.templateName}" draft has been loaded.`);
                        } else {
                            window.showNotice('Load Draft Failed', 'Template form is not ready or does not support loading drafts.');
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

    // Check if there's a draft to load from sessionStorage on page load
    const draftIdToLoad = sessionStorage.getItem('draftIdToLoad');
    if (draftIdToLoad) {
        sessionStorage.removeItem('draftIdToLoad'); // Clear it immediately
        loadDraft(draftIdToLoad);
    }
    window.loadDraft = loadDraft; // Expose globally for tssodash.html

    const setupFileUpload = (inputId, labelId) => {
        const input = document.getElementById(inputId);
        const label = input?.nextElementSibling?.querySelector('span');

        if (input && label) {
            input.addEventListener('change', (e) => {
                const fileName = e.target.files[0]?.name;
                label.textContent = fileName ? fileName : "Attach File...";
                label.classList.toggle('text-maroon-ltd', !!fileName);
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