import { toast } from '@/lib/toast';

declare global {
    interface Window {
        ticketViewData: any;
    }
}

declare const gapi: any;
declare const google: any;

let ticketId: number;
let ticket: any;
let statuses: any[];

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

let stagedFiles: { file: File; id: number; isValid: boolean; reason: string | null; }[] = [];
let isDeleteSelectionMode = false;

function validateFile(file: File) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
        return { isValid: false, reason: `supera el límite de ${MAX_FILE_SIZE_MB}MB` };
    }
    if (!ALLOWED_FORMATS.includes(file.type)) {
        return { isValid: false, reason: 'formato no permitido' };
    }
    return { isValid: true, reason: null };
}

function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function renderStagedFiles() {
    const attachmentArea = document.getElementById('attachment-area');
    const deleteFilesButton = document.getElementById('delete-files-button');
    const actionButtonsContainer = document.getElementById('action-buttons-container');

    if (!attachmentArea || !deleteFilesButton || !actionButtonsContainer) return;

    if (stagedFiles.length === 0) {
        attachmentArea.innerHTML = '';
        deleteFilesButton.classList.add('hidden');
        actionButtonsContainer.classList.remove('has-files');
        isDeleteSelectionMode = false;
        deleteFilesButton.textContent = 'Borrar archivos';
        return;
    }

    actionButtonsContainer.classList.add('has-files');
    let listHtml = '';
    if (isDeleteSelectionMode) {
        listHtml = '<h3 class="text-sm font-medium mb-2">Seleccione los archivos a eliminar:</h3><ul class="space-y-1">' +
            stagedFiles.map(fileWrapper => `
                <li>
                    <label class="flex items-center cursor-pointer">
                        <input type="checkbox" class="file-delete-checkbox h-4 w-4 rounded" data-file-id="${fileWrapper.id}">
                        <span class="ml-2 text-sm ${!fileWrapper.isValid ? 'text-red-500' : 'text-muted-foreground'}">
                            ${fileWrapper.file.name} (${formatBytes(fileWrapper.file.size)})
                            ${!fileWrapper.isValid ? `(${fileWrapper.reason})` : ''}
                        </span>
                    </label>
                </li>
            `).join('') + '</ul>';
    } else {
        listHtml = '<h3 class="text-sm font-medium mb-2">Archivos listos para subir:</h3><ul class="list-disc pl-5 space-y-1">' +
            stagedFiles.map(fileWrapper => `
                <li class="text-sm ${!fileWrapper.isValid ? 'text-red-500' : 'text-muted-foreground'}">
                    ${fileWrapper.file.name} (${formatBytes(fileWrapper.file.size)})
                    ${!fileWrapper.isValid ? `(${fileWrapper.reason})` : ''}
                </li>
            `).join('') + '</ul>';
    }

    attachmentArea.innerHTML = listHtml;
    deleteFilesButton.classList.remove('hidden');
}



function showStatusConfirmation(): Promise<boolean | null> {
    return new Promise((resolve) => {
        const modal = document.getElementById('status-change-confirmation-modal');
        const btnYes = document.getElementById('confirm-status-change-yes');
        const btnNo = document.getElementById('confirm-status-change-no');
        const overlay = document.getElementById('status-change-modal-overlay');

        if (!modal || !btnYes || !btnNo) {
            resolve(null);
            return;
        }

        modal.classList.remove('hidden');

        const cleanup = () => {
            btnYes.removeEventListener('click', handleYes);
            btnNo.removeEventListener('click', handleNo);
            overlay?.removeEventListener('click', handleNo);
            modal.classList.add('hidden');
        };

        const handleYes = (e: Event) => {
            e.preventDefault();
            cleanup();
            resolve(true);
        };

        const handleNo = (e: Event) => {
            e.preventDefault();
            cleanup();
            resolve(false);
        };

        btnYes.addEventListener('click', handleYes);
        btnNo.addEventListener('click', handleNo);
        overlay?.addEventListener('click', handleNo);
    });
}

export function initEditForm() {
    const form = document.getElementById('edit-ticket-form') as HTMLFormElement;
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
        const newCommentElement = document.getElementById('new-comment') as HTMLTextAreaElement;
        const estatusSelect = document.getElementById('estatusId') as HTMLSelectElement;

        const validFilesToUpload = stagedFiles.filter(fw => fw.isValid);
        const newComment = newCommentElement ? newCommentElement.value.trim() : '';

        if (validFilesToUpload.length > 0 && newComment.length < 10) {
            toast.warning('Si desea adjuntar archivos, por favor inserte un comentario descriptivo (mínimo 10 caracteres).');
            return;
        }

        // Confirmation Logic for Creator on Closed Tickets
        const isCreator = window.ticketViewData?.isCreator;
        const currentStatus = ticket.estatus.nombre;
        const closedStatuses = ['Cancelado', 'Duplicado', 'Solucionado'];
        let finalStatusId = estatusSelect.value;

        if (isCreator && closedStatuses.includes(currentStatus)) {
            const confirmed = await showStatusConfirmation();
            if (confirmed === true) {
                const enEsperaStatus = statuses.find(s => s.nombre === 'En espera');
                if (enEsperaStatus) {
                    finalStatusId = String(enEsperaStatus.id);
                }
            }
            // If confirmed === false, we keep the current status (do nothing to finalStatusId)
            // If confirmed === null (modal error), we proceed as is
        } else if (closedStatuses.includes(currentStatus) && newComment.length >= 10 && estatusSelect.value === String(ticket.estatusId)) {
            // Logic for Resolvers (or if not caught by above): If adding comment on closed ticket, maybe auto-reopen?
            // User requirement: "Por otro lado si el ticket ya está solucionado y se guarda que el estado permanezca, excepto si se coloca otro estatus"
            // So we actually DON'T want to auto-change to 'En progreso' here for Resolvers if it's solved.
            // The previous logic had:
            /*
            if (closedStatuses.includes(initialStatus) && newComment.length >= 10 && estatusSelect.value === String(ticket.estatusId)) {
               const enProgresoStatus = statuses.find(s => s.nombre === 'En progreso');
               if (enProgresoStatus) finalStatusId = String(enProgresoStatus.id);
            }
            */
            // We should REMOVE or modify this based on "que el estado permanezca".
            // So I will remove the auto-transition to 'En progreso' for closed tickets unless explicitly requested.
            // But wait, the previous code block did exactly that. I should probably remove it to comply with "permanezca".
        } else if (currentStatus === 'Nuevo' && estatusSelect.value === String(ticket.estatusId)) {
            // Auto-transition from 'Nuevo' to 'En progreso' is handled in Backend for Resolvers.
            // For Creators, it should stay 'Nuevo'. Backend handles this too.
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Guardando...';
        }

        let uploadedFileKeys: string[] = [];
        if (validFilesToUpload.length > 0) {
            const uploadPromises = validFilesToUpload.map(async fileWrapper => {
                try {
                    const presignedResponse = await fetch('/api/tickets/generate-upload-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileName: fileWrapper.file.name, fileType: fileWrapper.file.type, ticketId: ticketId })
                    });
                    if (!presignedResponse.ok) throw new Error('Error al obtener URL segura.');
                    const { uploadUrl, key } = await presignedResponse.json();
                    await fetch(uploadUrl, { method: 'PUT', body: fileWrapper.file, headers: { 'Content-Type': fileWrapper.file.type } });
                    return key;
                } catch (error) {
                    console.error(`Upload failed for ${fileWrapper.file.name}:`, error);
                    return null;
                }
            });
            const results = await Promise.all(uploadPromises);
            uploadedFileKeys = results.filter((key): key is string => key !== null);
            if (uploadedFileKeys.length !== validFilesToUpload.length) {
                toast.error('Algunos archivos no se pudieron subir. Por favor, inténtalo de nuevo.');
                if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Guardar cambios'; }
                return;
            }
        }

        const formData = new FormData(form as HTMLFormElement);
        const data = {
            ticketId: ticketId,
            estatusId: finalStatusId,
            prioridad: formData.get('prioridad'),
            atiendeId: formData.get('atiendeId'),
            archivado: (form.elements.namedItem('archivado') as HTMLInputElement).checked,
            newComment: newComment,
            newFiles: uploadedFileKeys,
        };

        try {
            const response = await fetch(`/api/tickets/update`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al actualizar el ticket');
            }
            toast.success('Los cambios han sido guardados.');
            setTimeout(() => {
                window.location.href = `${window.location.pathname}?new_entry=true`;
            }, 1000);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
            toast.error(message);
            if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Guardar cambios'; }
        }
    });
}

export function initFileUploads() {
    const uploadButton = document.getElementById('upload-files-button');
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const deleteFilesButton = document.getElementById('delete-files-button');
    const dropZone = document.getElementById('drop-zone');
    const googleDriveButton = document.getElementById('google-drive-button');

    if (!uploadButton || !fileInput || !deleteFilesButton) return;

    uploadButton.addEventListener('click', () => fileInput.click());

    if (googleDriveButton) {
        googleDriveButton.addEventListener('click', () => {
            handleAuthClick();
        });
    }

    // Initialize Google Drive API
    initGoogleDrive();

    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('bg-muted/50', 'border-primary');
        }, { passive: false });
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('bg-muted/50', 'border-primary');
        }, { passive: false });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('bg-muted/50', 'border-primary');
            if (e.dataTransfer?.files) {
                fileInput.files = e.dataTransfer.files;
                fileInput.dispatchEvent(new Event('change'));
            }
        }, { passive: false });
        dropZone.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            // Prevent opening file dialog if clicking on a delete checkbox or inside the attachment area (except if empty area)
            // Actually, if we click on the list items we don't want to open the dialog.
            if (target.closest('.file-delete-checkbox') || target.closest('#attachment-area')) {
                return;
            }
            fileInput.click();
        });
    }

    fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (!target.files) return;

        const newFiles = Array.from(target.files);

        if (stagedFiles.length + newFiles.length > 10) {
            toast.error('No puede seleccionar más de 10 archivos en total.');
            target.value = '';
            return;
        }

        let hasInvalidFiles = false;
        const newStagedFiles = newFiles.map((file, index) => {
            const validation = validateFile(file);
            if (!validation.isValid) hasInvalidFiles = true;
            const id = Date.now() + index;
            return { file, id, ...validation };
        });

        stagedFiles = stagedFiles.concat(newStagedFiles);

        if (hasInvalidFiles) {
            toast.warning('Algunos archivos no cumplen con los requisitos y no serán adjuntados.');
        }

        isDeleteSelectionMode = false;
        deleteFilesButton.textContent = 'Borrar archivos';
        renderStagedFiles();
        target.value = '';
    });

    // Modal elements
    const modal = document.getElementById('delete-confirmation-modal');
    const overlay = document.getElementById('delete-modal-overlay');
    const btnAll = document.getElementById('confirm-delete-all');
    const btnSelect = document.getElementById('confirm-delete-select');
    const btnCancel = document.getElementById('cancel-delete-modal');

    const closeModal = () => modal?.classList.add('hidden');

    // Attach modal listeners only once
    if (btnAll && !btnAll.dataset.listenerAttached) {
        btnAll.addEventListener('click', () => {
            stagedFiles = [];
            renderStagedFiles();
            closeModal();
        });
        btnAll.dataset.listenerAttached = 'true';
    }

    if (btnSelect && !btnSelect.dataset.listenerAttached) {
        btnSelect.addEventListener('click', () => {
            stagedFiles = stagedFiles.filter(fw => fw.isValid);
            if (stagedFiles.length > 0) {
                isDeleteSelectionMode = true;
                deleteFilesButton.textContent = 'Borrar selección';
                renderStagedFiles();
            } else {
                renderStagedFiles();
            }
            closeModal();
        });
        btnSelect.dataset.listenerAttached = 'true';
    }

    if (btnCancel && !btnCancel.dataset.listenerAttached) {
        btnCancel.addEventListener('click', closeModal);
        btnCancel.dataset.listenerAttached = 'true';
    }
    if (overlay && !overlay.dataset.listenerAttached) {
        overlay.addEventListener('click', closeModal);
        overlay.dataset.listenerAttached = 'true';
    }

    deleteFilesButton.addEventListener('click', () => {
        if (isDeleteSelectionMode) {
            const selectedIds = Array.from(document.querySelectorAll('.file-delete-checkbox:checked')).map(cb => parseInt((cb as HTMLInputElement).dataset.fileId!));
            stagedFiles = stagedFiles.filter(fw => !selectedIds.includes(fw.id));
            isDeleteSelectionMode = false;
            deleteFilesButton.textContent = 'Borrar archivos';
            renderStagedFiles();
        } else {
            modal?.classList.remove('hidden');
        }
    });
}

export function initHistoryToggles() {
    let activeDropdown: HTMLElement | null = null;
    const closeActiveDropdown = () => {
        if (activeDropdown) {
            activeDropdown.classList.add('hidden');
            activeDropdown = null;
        }
    };
    document.querySelectorAll('.attachment-clip').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const target = e.currentTarget as HTMLElement;
            if (!target) return;
            const dropdown = target.nextElementSibling as HTMLElement | null;
            if (dropdown) {
                if (dropdown === activeDropdown) {
                    closeActiveDropdown();
                } else {
                    closeActiveDropdown();
                    dropdown.classList.remove('hidden');
                    activeDropdown = dropdown;
                }
            }
        });
    });
    document.querySelectorAll('.attachment-link').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const target = e.currentTarget as HTMLElement;
            if (!target) return;
            const key = target.dataset.key;
            if (!key) return;
            try {
                const response = await fetch('/api/tickets/get-download-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
                if (!response.ok) throw new Error('No se pudo obtener el enlace de descarga.');
                const { downloadUrl } = await response.json();
                window.open(downloadUrl, '_blank');
                closeActiveDropdown();
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Error desconocido';
                console.error('Error fetching download URL:', error);
                toast.error(message);
            }
        });
    });
    document.addEventListener('click', closeActiveDropdown);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeActiveDropdown();
    });
}

export function handleNewHistoryEntry() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('new_entry')) {
        const newEntry = document.querySelector('[data-history-entry="true"]');
        if (newEntry) {
            newEntry.scrollIntoView({ behavior: 'smooth', block: 'center' });
            newEntry.classList.add('flash-animation');
        }
    }
}

function setElementColor(selectElement: HTMLSelectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    if (!selectedOption) return;
    const color = selectedOption.style.backgroundColor;
    selectElement.style.backgroundColor = color || '#f3f4f6';
    selectElement.style.color = color ? 'white' : 'black';
}

export function initStatusColorizer() {
    const statusSelect = document.getElementById('estatusId') as HTMLSelectElement;
    if (statusSelect) {
        statusSelect.addEventListener('change', () => setElementColor(statusSelect));
        setElementColor(statusSelect);
    }
}

// Google Drive Integration
let tokenClient: any;
let accessToken: string | null = null;
let pickerInited = false;
let gisInited = false;

const GOOGLE_API_KEY = import.meta.env.PUBLIC_GOOGLE_API_KEY;
const GOOGLE_CLIENT_ID = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_APP_ID = import.meta.env.PUBLIC_GOOGLE_APP_ID;

// Scopes for Drive API (drive.file is safer, but we need to download)
// drive.readonly allows reading all files, which is needed if we want to pick any file.
// drive.file only allows accessing files created by this app or opened with it.
// Since we want to pick ANY file, we might need drive.readonly.
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

export function initGoogleDrive() {
    const script1 = document.createElement('script');
    script1.src = 'https://apis.google.com/js/api.js';
    script1.async = true;
    script1.defer = true;
    script1.onload = () => {
        gapi.load('client:picker', async () => {
            await gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
            pickerInited = true;
        });
    };
    document.body.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = 'https://accounts.google.com/gsi/client';
    script2.async = true;
    script2.defer = true;
    script2.onload = () => {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: '', // defined later
        });
        gisInited = true;
    };
    document.body.appendChild(script2);
}

function handleAuthClick() {
    if (!GOOGLE_API_KEY || !GOOGLE_CLIENT_ID || !GOOGLE_APP_ID) {
        toast.error('Faltan credenciales de Google Drive.');
        return;
    }

    if (accessToken) {
        createPicker();
        return;
    }

    tokenClient.callback = async (response: any) => {
        if (response.error !== undefined) {
            throw (response);
        }
        accessToken = response.access_token;
        createPicker();
    };

    if (accessToken === null) {
        // Prompt the user to select a Google Account and ask for consent to share their data
        // when establishing a new session.
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        // Skip display of account chooser and consent dialog for an existing session.
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

function createPicker() {
    // If we have an access token, we only need the picker lib to be ready.
    // If we don't have a token, we need GIS to be ready to get one.
    if (!pickerInited || (!accessToken && !gisInited)) {
        toast.error('Google API no está lista aún. Intente de nuevo en unos segundos.');
        return;
    }

    // Use DocsView to allow folder navigation and better structure
    const view = new google.picker.DocsView();
    view.setIncludeFolders(true);
    view.setMimeTypes(ALLOWED_FORMATS.join(','));
    view.setSelectFolderEnabled(false);
    view.setParent('root'); // Start at root to show "My Drive" structure

    const picker = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.NAV_HIDDEN)
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setAppId(GOOGLE_APP_ID)
        .setOAuthToken(accessToken!)
        .addView(view)
        .addView(new google.picker.DocsUploadView())
        .setDeveloperKey(GOOGLE_API_KEY)
        .setCallback(pickerCallback)
        .build();
    picker.setVisible(true);
}

async function pickerCallback(data: any) {
    if (data.action === google.picker.Action.PICKED) {
        const documents = data[google.picker.Response.DOCUMENTS];
        const newFiles: File[] = [];

        toast.info('Procesando archivos de Drive... espere un momento.');

        try {
            for (const doc of documents) {
                const fileId = doc[google.picker.Document.ID];
                const name = doc[google.picker.Document.NAME];
                const mimeType = doc[google.picker.Document.MIME_TYPE];

                // We need to fetch the file content.
                // Using gapi.client.drive.files.get with alt=media
                const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (!response.ok) {
                    console.error(`Error downloading ${name}:`, response.statusText);
                    toast.error(`Error al descargar ${name} de Drive.`);
                    continue;
                }

                const blob = await response.blob();
                const file = new File([blob], name, { type: mimeType });
                newFiles.push(file);
            }

            if (newFiles.length > 0) {
                // Add to staged files using existing logic
                const fileInput = document.getElementById('file-input') as HTMLInputElement;
                // We can't set fileInput.files directly with File objects created manually easily without DataTransfer
                // But our logic uses stagedFiles array. We just need to push to it and call render.

                if (stagedFiles.length + newFiles.length > 10) {
                    toast.error('No puede seleccionar más de 10 archivos en total.');
                } else {
                    let hasInvalidFiles = false;
                    const newStagedFiles = newFiles.map((file, index) => {
                        const validation = validateFile(file);
                        if (!validation.isValid) hasInvalidFiles = true;
                        const id = Date.now() + index; // Ensure integer ID for delete logic
                        return { file, id, ...validation };
                    });

                    stagedFiles = stagedFiles.concat(newStagedFiles);

                    if (hasInvalidFiles) {
                        toast.warning('Algunos archivos no cumplen con los requisitos y no serán adjuntados.');
                    }

                    const deleteFilesButton = document.getElementById('delete-files-button');
                    if (deleteFilesButton) {
                        isDeleteSelectionMode = false;
                        deleteFilesButton.textContent = 'Borrar archivos';
                    }
                    renderStagedFiles();
                }
            }
        } catch (e) {
            console.error(e);
            toast.error('Error al procesar archivos de Drive.');
        } finally {
            // Dismiss loading toast (if toast library supports it, otherwise just ignore)
            // Assuming toast.dismiss or similar exists, or just let it be replaced by success/error
        }
    }
}

export function init() {
    if (window.ticketViewData) {
        ticketId = window.ticketViewData.ticketId;
        ticket = window.ticketViewData.ticket;
        statuses = window.ticketViewData.statuses;
        if (window.ticketViewData.accessToken) {
            accessToken = window.ticketViewData.accessToken;
        }
    }
}