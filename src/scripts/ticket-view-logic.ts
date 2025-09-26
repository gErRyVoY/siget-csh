declare const Swal: any;

declare global {
    interface Window {
        ticketViewData: any;
    }
}

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

export function initFileUploads() {
    const uploadButton = document.getElementById('upload-files-button');
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const deleteFilesButton = document.getElementById('delete-files-button');

    if (!uploadButton || !fileInput || !deleteFilesButton) return;

    uploadButton.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (!target.files) return;

        const newFiles = Array.from(target.files);

        if (stagedFiles.length + newFiles.length > 10) {
            Swal.fire({
                background: '#881912',
                color: '#FFFFFF',
                customClass: { popup: 'Montserrat' },
                icon: 'error',
                iconColor: '#CAAB55',
                position: 'bottom',
                showConfirmButton: false,
                text: 'No puede seleccionar más de 10 archivos en total.',
                timer: 4000,
                timerProgressBar: true,
                title: 'Límite de archivos excedido',
                toast: true
            });
            target.value = '';
            return;
        }

        let hasInvalidFiles = false;
        const newStagedFiles = newFiles.map((file, index) => {
            const validation = validateFile(file);
            if (!validation.isValid) hasInvalidFiles = true;
            const id = Date.now() + index; // Use timestamp for more robust unique ID
            return { file, id, ...validation };
        });

        stagedFiles = stagedFiles.concat(newStagedFiles);

        if (hasInvalidFiles) {
            Swal.fire({
                toast: true, position: 'bottom', showConfirmButton: false, timer: 4000, timerProgressBar: true,
                icon: 'warning', title: 'Valide sus archivos', text: 'Algunos no cumplen con los requisitos y no serán adjuntados.', color: '#FFFFFF', background: '#881912'
            });
        }

        isDeleteSelectionMode = false;
        deleteFilesButton.textContent = 'Borrar archivos';
        renderStagedFiles();
        target.value = '';
    });

    deleteFilesButton.addEventListener('click', () => {
        if (isDeleteSelectionMode) {
            const selectedIds = Array.from(document.querySelectorAll('.file-delete-checkbox:checked')).map(cb => parseInt((cb as HTMLInputElement).dataset.fileId!));
            stagedFiles = stagedFiles.filter(fw => !selectedIds.includes(fw.id));
            isDeleteSelectionMode = false;
            deleteFilesButton.textContent = 'Borrar archivos';
            renderStagedFiles();
        } else {
            Swal.fire({
                title: 'Elige el tipo de borrado:',
                icon: 'warning',
                iconColor: '#CAAB55',
                showCancelButton: true,
                confirmButtonColor: '#881912',
                cancelButtonColor: '#797979',
                confirmButtonText: 'Borrar todos',
                cancelButtonText: 'Seleccionar',
                customClass: {
                    popup: 'Montserrat'
                }
            }).then((result: any) => {
                if (result.isConfirmed) {
                    stagedFiles = [];
                    renderStagedFiles();
                } else if (result.dismiss === Swal.DismissReason.cancel) {
                    stagedFiles = stagedFiles.filter(fw => fw.isValid);
                    if (stagedFiles.length > 0) {
                        isDeleteSelectionMode = true;
                        deleteFilesButton.textContent = 'Borrar selección';
                        renderStagedFiles();
                    } else {
                        renderStagedFiles();
                    }
                }
            });
        }
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
            Swal.fire('Comentario requerido', 'Si desea adjuntar archivos, por favor inserte un comentario descriptivo (mínimo 10 caracteres).', 'warning');
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Guardando...';
        }

        const initialStatus = ticket.estatus.nombre;
        const closedStatuses = ['Cancelado', 'Duplicado', 'Solucionado'];
        let finalStatusId = estatusSelect.value;

        if (closedStatuses.includes(initialStatus) && newComment.length >= 10 && estatusSelect.value === String(ticket.estatusId)) {
            const enProgresoStatus = statuses.find(s => s.nombre === 'En progreso');
            if (enProgresoStatus) {
                finalStatusId = String(enProgresoStatus.id);
            }
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
                Swal.fire('Error de subida', 'Algunos archivos no se pudieron subir. Por favor, inténtalo de nuevo.', 'error');
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
            Swal.fire({
                background: '#CAAB55',
                color: '#FFFFFF',
                customClass: { popup: 'Montserrat' },
                icon: 'success',
                iconColor: '#FFFFFF',
                position: 'bottom',
                showConfirmButton: false,
                text: 'Los cambios han sido guardados.',
                timer: 4000,
                timerProgressBar: true,
                title: 'Ticket actualizado',
                toast: true
            }).then(() => {
                window.location.href = `${window.location.pathname}?new_entry=true`;
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
            Swal.fire({
                background: '#881912',
                color: '#FFFFFF',
                customClass: { popup: 'Montserrat' },
                icon: 'error',
                iconColor: '#CAAB55',
                position: 'bottom',
                showConfirmButton: false,
                text: message,
                timer: 4000,
                timerProgressBar: true,
                title: 'Error',
                toast: true
            });
            if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Guardar cambios'; }
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
                Swal.fire('Error', message, 'error');
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

export function init() {
    if (!window.ticketViewData) return;
    ticketId = window.ticketViewData.ticketId;
    ticket = window.ticketViewData.ticket;
    statuses = window.ticketViewData.statuses;
}