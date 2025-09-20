import { toast } from "sonner";

document.addEventListener('astro:page-load', () => {
    const { ticketId, isReadOnly } = (window as any).ticketViewData || {};

    let stagedFiles: File[] = [];

    function setElementColor(selectElement: HTMLSelectElement) {
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        if (!selectedOption) return;
        const color = selectedOption.style.backgroundColor;
        selectElement.style.backgroundColor = color || '#f3f4f6';
        selectElement.style.color = color ? 'white' : 'black';
    }

    function initStatusColorizer() {
        const statusSelect = document.getElementById('estatusId') as HTMLSelectElement;
        if (statusSelect) {
            statusSelect.addEventListener('change', () => setElementColor(statusSelect));
            setElementColor(statusSelect);
        }
    }

    function initFileUploads() {
        console.log('[Debug] initFileUploads called.');
        const uploadButton = document.getElementById('upload-files-button') as HTMLButtonElement;
        const fileInput = document.getElementById('file-input') as HTMLInputElement;
        const attachmentArea = document.getElementById('attachment-area') as HTMLElement;

        console.log('[Debug] uploadButton:', uploadButton);
        console.log('[Debug] fileInput:', fileInput);
        console.log('[Debug] attachmentArea:', attachmentArea);

        if (!uploadButton || !fileInput || !attachmentArea) {
            console.error('[Debug] One or more file upload elements are missing from the DOM.');
            return;
        }

        uploadButton.addEventListener('click', () => {
            console.log('[Debug] upload-files-button clicked, triggering fileInput.click()');
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            console.log('[Debug] fileInput change event fired.');
            const target = e.target as HTMLInputElement;
            if (!target || !target.files) return;
            const files = target.files;
            
            stagedFiles = Array.from(files);

            const stagedFilesHtml = '<h3 class="text-sm font-medium mb-2">Archivos listos para subir:</h3>' +
                '<ul class="list-disc pl-5 text-sm text-muted-foreground">' +
                stagedFiles.map(file => `<li>${file.name}</li>`).join('') +
                '</ul>';
            attachmentArea.innerHTML = stagedFilesHtml;
        });
        console.log('[Debug] File upload event listeners attached.');
    }

    function initEditForm() {
        const form = document.getElementById('edit-ticket-form') as HTMLFormElement;
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Guardando...';
            }

            let uploadedFileKeys: string[] = [];

            if (stagedFiles.length > 0) {
                const attachmentArea = document.getElementById('attachment-area');
                if (attachmentArea) {
                    attachmentArea.innerHTML = '<h3 class="text-sm font-medium mb-2">Subiendo archivos...</h3>';
                }
                
                const uploadPromises = stagedFiles.map(async file => {
                    try {
                        const presignedResponse = await fetch('/api/tickets/generate-upload-url', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fileName: file.name, fileType: file.type, ticketId: ticketId })
                        });
                        if (!presignedResponse.ok) throw new Error('Error al obtener URL segura.');
                        const { uploadUrl, key } = await presignedResponse.json();

                        await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
                        return key;
                    } catch (error) {
                        console.error(`Upload failed for ${file.name}:`, error);
                        return null;
                    }
                });

                const results = await Promise.all(uploadPromises);
                uploadedFileKeys = results.filter((key): key is string => key !== null);

                if (uploadedFileKeys.length !== stagedFiles.length) {
                    toast.error('Error de subida', {
                        description: 'Algunos archivos no se pudieron subir. Por favor, inténtalo de nuevo.',
                        style: {
                            background: 'var(--muted-foreground)',
                            color: 'var(--card)',
                            border: 'none',
                            fontFamily: 'var(--font-sans)'
                        }
                    });
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = 'Guardar cambios';
                    }
                    return;
                }
            }

            const formData = new FormData(form);
            const newCommentElement = document.getElementById('new-comment') as HTMLTextAreaElement;
            const data = {
                ticketId: ticketId,
                estatusId: formData.get('estatusId'),
                prioridad: formData.get('prioridad'),
                atiendeId: formData.get('atiendeId'),
                solicitanteId: formData.get('solicitanteId'),
                archivado: (form.elements.namedItem('archivado') as HTMLInputElement).checked,
                newComment: newCommentElement ? newCommentElement.value : null,
                newFiles: uploadedFileKeys,
            };

            try {
                const response = await fetch(`/api/tickets/update`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                if (!response.ok) throw new Error('Error al actualizar el ticket');

                toast.success('Ticket actualizado', {
                    description: 'El ticket ha sido actualizado correctamente.',
                    style: {
                        background: 'var(--primary)',
                        color: 'var(--primary-foreground)',
                        border: 'none',
                        fontFamily: 'var(--font-sans)'
                    }
                });
                setTimeout(() => {
                    window.location.href = `${window.location.pathname}?new_entry=true`;
                }, 1500);

            } catch (error) {
                toast.error('Error de actualización', {
                    description: 'Ocurrió un error al actualizar el ticket.',
                    style: {
                        background: 'var(--muted-foreground)',
                        color: 'var(--card)',
                        border: 'none',
                        fontFamily: 'var(--font-sans)'
                    }
                });
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Guardar cambios';
                }
            }
        });
    }

    function initHistoryToggles() {
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
                const dropdown = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
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
                const key = (e.currentTarget as HTMLElement).dataset.key;
                if (!key) return;

                try {
                    const response = await fetch('/api/tickets/get-download-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key })
                    });
                    if (!response.ok) throw new Error('No se pudo obtener el enlace de descarga.');
                    const { downloadUrl } = await response.json();
                    window.open(downloadUrl, '_blank');
                    closeActiveDropdown();
                } catch (error) {
                    console.error('Error fetching download URL:', error);
                    const message = error instanceof Error ? error.message : 'Error desconocido';
                    toast.error('Error de descarga', {
                        description: message,
                        style: {
                            background: 'var(--muted-foreground)',
                            color: 'var(--card)',
                            border: 'none',
                            fontFamily: 'var(--font-sans)'
                        }
                    });
                }
            });
        });

        document.addEventListener('click', closeActiveDropdown);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeActiveDropdown();
            }
        });
    }

    function handleNewHistoryEntry() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('new_entry')) {
            const newEntry = document.querySelector('[data-history-entry="true"]') as HTMLElement;
            if (newEntry) {
                newEntry.scrollIntoView({ behavior: 'smooth', block: 'center' });
                newEntry.classList.add('flash-animation');
            }
        }
    }

    // Initialize all functionalities
    initEditForm();
    initFileUploads();
    initHistoryToggles();
    initStatusColorizer();
    handleNewHistoryEntry();
});
