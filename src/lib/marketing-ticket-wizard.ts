import { toast } from './toast';

// --- Type Definitions ---
interface SubcategoriaNode {
    id: number;
    nombre: string;
    children: SubcategoriaNode[];
}

interface CategoriaNode {
    id: number;
    nombre: string;
    subcategorias: SubcategoriaNode[];
}

/**
 * Initializes the wizard specifically for Marketing tickets.
 * @param marketingCategory The Marketing category object containing all its subcategories.
 */
export function initMarketingTicketWizard(marketingCategory: CategoriaNode) {
    if (!marketingCategory) {
        console.error('Marketing category data is missing.');
        return;
    }

    // --- State Management ---
    const selection = {
        categoria: marketingCategory, // Pre-selected
        nodes: [] as SubcategoriaNode[], // Path of selected subcategory nodes
    };

    // --- DOM Element Cache ---
    const wizard = document.getElementById('marketing-wizard');
    const descripcionArea = document.getElementById('descripcion-area');
    const descripcionTitle = document.getElementById('descripcion-title');
    const descripcionInput = document.getElementById('descripcion') as HTMLTextAreaElement;
    const closeDescripcionBtn = document.getElementById('close-descripcion-btn');

    // Afectado fields
    const afectadoFields = document.getElementById('afectado-fields');
    const afectadoClave = document.getElementById('afectado_clave') as HTMLInputElement;
    const afectadoNombre = document.getElementById('afectado_nombre') as HTMLInputElement;
    const lblClave = document.getElementById('lbl-clave');

    const submitButton = document.getElementById('submit-ticket') as HTMLButtonElement;
    const ticketForm = document.getElementById('ticket-form');

    // File Upload Elements
    const dropZone = document.getElementById('drop-zone');
    const attachmentArea = document.getElementById('attachment-area');
    const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
    const uploadButton = document.getElementById('upload-files-button');
    const googleDriveButton = document.getElementById('google-drive-button');

    if (!wizard || !descripcionArea || !descripcionTitle || !descripcionInput || !submitButton || !ticketForm || !afectadoFields || !afectadoClave || !afectadoNombre || !lblClave) {
        console.error('Marketing Wizard initialization failed: One or more required DOM elements are missing.');
        return;
    }

    // --- Upload State & Constants ---
    const MAX_FILE_SIZE_MB = 5;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
    const ALLOWED_FORMATS = [
        'image/jpeg',
        'image/png',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip',
        'video/mp4' // Usualmente Marketing manda videos o zips
    ];
    let stagedFiles: Array<{ file: File; id: number; isValid: boolean; reason: string | null }> = [];

    // Google API Credentials
    const GOOGLE_API_KEY = ticketForm.dataset.googleApiKey;
    const GOOGLE_CLIENT_ID = ticketForm.dataset.googleClientId;
    const GOOGLE_APP_ID = ticketForm.dataset.googleAppId;

    let tokenClient: any;
    let accessToken: string | null = null;
    let pickerInited = false;
    let gisInited = false;
    const SCOPES = "https://www.googleapis.com/auth/drive.readonly";
    const allowedMimeTypes = ALLOWED_FORMATS.join(",");

    // --- Core Functions ---

    function removeColumns(fromIndex: number) {
        const columns = Array.from(wizard!.querySelectorAll('[data-col-index]'));
        columns.forEach(col => {
            const colIndex = parseInt(col.getAttribute('data-col-index')!, 10);
            if (colIndex >= fromIndex) {
                col.remove();
            }
        });
    }

    function renderColumn(items: SubcategoriaNode[], colIndex: number, title: string) {
        removeColumns(colIndex);

        const columnDiv = document.createElement('div');
        columnDiv.setAttribute('data-col-index', String(colIndex));
        columnDiv.className = 'p-4 bg-card border rounded-lg flex flex-col flex-shrink-0 min-w-[250px]';

        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-2';

        const h3 = document.createElement('h3');
        h3.className = 'font-semibold text-card-foreground truncate';
        h3.textContent = title;
        h3.title = title;
        header.appendChild(h3);

        if (colIndex > 1) {
            const closeButton = document.createElement('button');
            closeButton.className = 'p-1 rounded-md hover:bg-accent text-muted-foreground';
            closeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
            closeButton.setAttribute('data-close-col', String(colIndex));
            header.appendChild(closeButton);
        }

        const list = document.createElement('ul');
        list.className = 'space-y-2 overflow-y-auto max-h-[400px]';

        items.forEach(item => {
            const li = document.createElement('li');
            const button = document.createElement('button');
            button.dataset.id = String(item.id);
            button.dataset.colIndex = String(colIndex);
            button.className = "w-full text-left p-2 rounded-md text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-secondary hover:bg-secondary hover:text-secondary-foreground";
            button.textContent = item.nombre;
            li.appendChild(button);
            list.appendChild(li);
        });

        columnDiv.appendChild(header);
        columnDiv.appendChild(list);
        wizard!.appendChild(columnDiv);

        wizard!.scrollTo({
            left: wizard!.scrollWidth,
            behavior: 'smooth'
        });
    }

    function hideDescriptionArea() {
        if (descripcionArea) descripcionArea.classList.add('hidden');
        // Quitar opacidad a los demas botones del primer nivel si existiera opacidad
        const allListItems = wizard!.querySelectorAll('li');
        allListItems.forEach(li => {
            li.classList.remove('hidden');
        });
    }

    function showDescriptionArea() {
        if (!descripcionArea || !descripcionTitle || !descripcionInput) return;
        descripcionArea.classList.remove('hidden');
        descripcionTitle.textContent = `Describe tu solicitud`;

        // Ocultar botones no seleccionados para limpiar la vista
        const allListItems = wizard!.querySelectorAll('li');
        allListItems.forEach(li => {
            const btn = li.querySelector('button');
            if (btn && !btn.classList.contains('bg-secondary')) {
                li.classList.add('hidden');
            }
        });

        afectadoFields!.classList.add('hidden');
        afectadoClave.value = '';
        afectadoNombre.value = '';

        validateForm();
        descripcionArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        descripcionInput.focus();
    }

    function handleSelection(selectedButton: HTMLButtonElement) {
        const id = parseInt(selectedButton.dataset.id!, 10);
        const colIndex = parseInt(selectedButton.dataset.colIndex!, 10);

        // Highlight selection
        const allButtons = wizard!.querySelectorAll(`button[data-col-index="${colIndex}"]`);
        allButtons.forEach(btn => {
            btn.classList.remove('bg-secondary', 'text-secondary-foreground');
        });
        selectedButton.classList.add('bg-secondary', 'text-secondary-foreground');

        removeColumns(colIndex + 1);
        hideDescriptionArea();

        let parentNode: CategoriaNode | SubcategoriaNode;
        if (colIndex === 1) {
            parentNode = selection.categoria;
        } else {
            parentNode = selection.nodes[colIndex - 2];
        }

        const itemsToSearch = 'subcategorias' in parentNode ? parentNode.subcategorias : parentNode.children;
        const subcatNode = itemsToSearch.find(s => s.id === id);

        if (!subcatNode) return;

        // Update selection state
        selection.nodes = selection.nodes.slice(0, colIndex - 1);
        selection.nodes.push(subcatNode);

        if (subcatNode.children && subcatNode.children.length > 0) {
            renderColumn(subcatNode.children, colIndex + 1, subcatNode.nombre);
        } else {
            showDescriptionArea();
        }

        validateForm();
    }

    function validateForm() {
        const hasDescription = descripcionInput.value.trim().length > 0;
        const lastSelectedNode = selection.nodes[selection.nodes.length - 1];
        const isSelectionFinal = lastSelectedNode && lastSelectedNode.children.length === 0;

        submitButton.disabled = !(isSelectionFinal && hasDescription);
    }

    // --- Google Drive & File Logic ---
    const initGoogleDrive = () => {
        if (!document.querySelector('script[src="https://apis.google.com/js/api.js"]')) {
            const script1 = document.createElement("script");
            script1.src = "https://apis.google.com/js/api.js";
            script1.async = true;
            script1.defer = true;
            script1.onload = () => {
                (window as any).gapi.load('picker', () => {
                    pickerInited = true;
                });
            };
            document.body.appendChild(script1);
        } else {
            pickerInited = true;
        }

        if (!document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
            const script2 = document.createElement("script");
            script2.src = "https://accounts.google.com/gsi/client";
            script2.async = true;
            script2.defer = true;
            script2.onload = () => {
                if (!(window as any).google) return;
                tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: SCOPES,
                    callback: "",
                });
                gisInited = true;
            };
            document.body.appendChild(script2);
        } else {
            if ((window as any).google?.accounts) {
                tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: SCOPES,
                    callback: "",
                });
                gisInited = true;
            }
        }
    };

    const handleAuthClick = () => {
        if (!GOOGLE_API_KEY || !GOOGLE_CLIENT_ID || !GOOGLE_APP_ID) {
            toast.error("Faltan credenciales de Google Drive.");
            return;
        }

        if (accessToken) {
            createPicker();
            return;
        }

        tokenClient.callback = async (response: any) => {
            if (response.error !== undefined) {
                throw response;
            }
            accessToken = response.access_token;
            createPicker();
        };

        if (accessToken === null) {
            tokenClient.requestAccessToken({ prompt: "consent" });
        } else {
            tokenClient.requestAccessToken({ prompt: "" });
        }
    };

    const createPicker = () => {
        if (!pickerInited || (!accessToken && !gisInited)) {
            toast.error("Google API no está lista aún.");
            return;
        }

        const view = new (window as any).google.picker.DocsView();
        view.setIncludeFolders(true);
        view.setMimeTypes(allowedMimeTypes);
        view.setSelectFolderEnabled(false);
        view.setParent("root");

        const picker = new (window as any).google.picker.PickerBuilder()
            .enableFeature((window as any).google.picker.Feature.NAV_HIDDEN)
            .enableFeature((window as any).google.picker.Feature.MULTISELECT_ENABLED)
            .setAppId(GOOGLE_APP_ID)
            .setOAuthToken(accessToken!)
            .addView(view)
            .addView(new (window as any).google.picker.DocsUploadView())
            .setDeveloperKey(GOOGLE_API_KEY)
            .setCallback(pickerCallback)
            .build();
        picker.setVisible(true);
    };

    const pickerCallback = async (data: any) => {
        if (data.action === (window as any).google.picker.Action.PICKED) {
            const documents = data[(window as any).google.picker.Response.DOCUMENTS];
            const newFiles: File[] = [];

            toast.info("Procesando archivos de Drive...");

            try {
                for (const doc of documents) {
                    const fileId = doc[(window as any).google.picker.Document.ID];
                    const name = doc[(window as any).google.picker.Document.NAME];
                    const mimeType = doc[(window as any).google.picker.Document.MIME_TYPE];

                    const response = await fetch(
                        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                        {
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                            },
                        }
                    );

                    if (!response.ok) {
                        toast.error(`Error al descargar ${name} de Drive.`);
                        continue;
                    }

                    const blob = await response.blob();
                    const file = new File([blob], name, { type: mimeType });
                    newFiles.push(file);
                }

                if (newFiles.length > 0) {
                    processNewFiles(newFiles);
                }
            } catch (e) {
                console.error(e);
                toast.error("Error al procesar archivos de Drive.");
            }
        }
    };

    const validateFile = (file: File) => {
        if (file.size > MAX_FILE_SIZE_BYTES) {
            return {
                isValid: false,
                reason: `supera ${MAX_FILE_SIZE_MB}MB`,
            };
        }
        if (!ALLOWED_FORMATS.includes(file.type)) {
            return { isValid: false, reason: "formato no permitido" };
        }
        return { isValid: true, reason: null };
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const renderStagedFiles = () => {
        if (!attachmentArea) return;
        if (stagedFiles.length === 0) {
            attachmentArea.innerHTML = "";
            return;
        }

        const listConfig = stagedFiles
            .map(
                (fw) => `
            <div class="flex items-center justify-between p-2 bg-muted/20 rounded border border-border">
                <span class="text-sm ${!fw.isValid ? "text-destructive" : "text-foreground"} truncate max-w-[80%]">
                    ${fw.file.name} (${formatBytes(fw.file.size)})
                    ${!fw.isValid ? `(${fw.reason})` : ""}
                </span>
                <button type="button" class="text-xs text-muted-foreground hover:text-destructive remove-file-btn" data-id="${fw.id}">
                    ✕
                </button>
            </div>
        `
            )
            .join("");

        attachmentArea.innerHTML = listConfig;

        document.querySelectorAll(".remove-file-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const id = parseInt((e.target as HTMLElement).dataset.id || "0");
                stagedFiles = stagedFiles.filter((f) => f.id !== id);
                renderStagedFiles();
            });
        });
    };

    const processNewFiles = (files: File[]) => {
        if (stagedFiles.length + files.length > 10) {
            toast.error("Máximo 10 archivos permitidos.");
            return;
        }

        const newStaged = files.map((file, index) => {
            const validation = validateFile(file);
            return { file, id: Date.now() + index, ...validation };
        });

        stagedFiles = [...stagedFiles, ...newStaged];
        renderStagedFiles();
    };


    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';

        const lastSelectedNode = selection.nodes[selection.nodes.length - 1];

        try {
            // 1. Create Ticket
            const response = await fetch('/api/tickets/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categoriaId: selection.categoria.id,
                    subcategoriaId: lastSelectedNode?.id || null,
                    descripcion: descripcionInput.value,
                    afectado_clave: null,
                    afectado_nombre: null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Error en la respuesta del servidor.' }));
                throw new Error(errorData.message);
            }

            const resData = await response.json();
            const ticketId = resData.id;

            // 2. Upload Files (if any)
            const validFiles = stagedFiles.filter((f) => f.isValid);
            if (validFiles.length > 0) {
                submitButton.innerHTML = `<span class="animate-spin mr-2">⏳</span> Subiendo archivos...`;

                const uploadPromises = validFiles.map(async (fw) => {
                    try {
                        const presigned = await fetch("/api/tickets/generate-upload-url", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                fileName: fw.file.name,
                                fileType: fw.file.type,
                                ticketId: ticketId,
                            }),
                        });
                        if (!presigned.ok) throw new Error("Error URL firma");

                        const { uploadUrl, key } = await presigned.json();
                        await fetch(uploadUrl, {
                            method: "PUT",
                            body: fw.file,
                            headers: { "Content-Type": fw.file.type },
                        });
                        return key;
                    } catch (err) {
                        console.error(err);
                        return null;
                    }
                });

                const keys = (await Promise.all(uploadPromises)).filter((k) => k !== null);

                // 3. Update Ticket with files
                if (keys.length > 0) {
                    await fetch("/api/tickets/update", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            ticketId: ticketId,
                            newFiles: keys,
                            newComment: "Archivos adjuntos provistos en la creación del ticket.",
                        }),
                    });
                }
            }

            toast.success('¡Ticket de Marketing Creado!', { duration: 3000 });

            setTimeout(() => {
                window.location.href = '/tickets/marketing/usuario';
            }, 1500);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'No se pudo crear el ticket.';
            toast.error(errorMessage);
            submitButton.disabled = false;
            submitButton.textContent = 'Crear Ticket';
        }
    }

    // --- Event Listeners ---
    wizard.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button[data-id]') as HTMLButtonElement | null;
        const closeButton = target.closest('button[data-close-col]') as HTMLButtonElement | null;

        if (button) {
            handleSelection(button);
        } else if (closeButton) {
            const colIndex = parseInt(closeButton.dataset.closeCol!, 10);
            removeColumns(colIndex);
            selection.nodes.splice(colIndex - 2); // clear selection of the left column
            hideDescriptionArea();
            validateForm();
            
            // clear active UI on the previous column
            const prevColButtons = wizard.querySelectorAll(`button[data-col-index="${colIndex - 1}"]`);
            prevColButtons.forEach(btn => {
                btn.classList.remove('bg-secondary', 'text-secondary-foreground');
            });
        }
    });

    if (closeDescripcionBtn) {
        closeDescripcionBtn.addEventListener('click', () => {
            hideDescriptionArea();
            
            const colIndexToClear = selection.nodes.length;
            
            if (selection.nodes.length > 0) {
                selection.nodes.pop(); // Remove the leaf subcategory from path
            }

            // Clear the active UI on the column of the leaf node we just deselected
            const buttonsToClear = wizard.querySelectorAll(`button[data-col-index="${colIndexToClear}"]`);
            buttonsToClear.forEach(btn => {
                btn.classList.remove('bg-secondary', 'text-secondary-foreground');
            });
            
            validateForm();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!descripcionArea!.classList.contains('hidden')) {
                hideDescriptionArea();
                
                const colIndexToClear = selection.nodes.length;
                if (selection.nodes.length > 0) {
                    selection.nodes.pop();
                }

                const buttonsToClear = wizard!.querySelectorAll(`button[data-col-index="${colIndexToClear}"]`);
                buttonsToClear.forEach(btn => {
                    btn.classList.remove('bg-secondary', 'text-secondary-foreground');
                });
                
                validateForm();
            } else {
                // If description area is closed, close the rightmost open column
                const columns = Array.from(wizard!.querySelectorAll('[data-col-index]'));
                if (columns.length > 1) {
                    const lastColIndex = parseInt(columns[columns.length - 1].getAttribute('data-col-index')!, 10);
                    removeColumns(lastColIndex);
                    selection.nodes.splice(lastColIndex - 2);
                    hideDescriptionArea();
                    validateForm();

                    const prevColButtons = wizard!.querySelectorAll(`button[data-col-index="${lastColIndex - 1}"]`);
                    prevColButtons.forEach(btn => {
                        btn.classList.remove('bg-secondary', 'text-secondary-foreground');
                    });
                }
            }
        }
    });

    descripcionInput.addEventListener('input', validateForm);
    ticketForm.addEventListener('submit', handleSubmit);

    // --- File Listeners ---
    if (dropZone) {
        dropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropZone.classList.add("bg-muted/50", "border-primary");
        });
        dropZone.addEventListener("dragleave", (e) => {
            e.preventDefault();
            dropZone.classList.remove("bg-muted/50", "border-primary");
        });
        dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropZone.classList.remove("bg-muted/50", "border-primary");
            if (e.dataTransfer?.files) {
                processNewFiles(Array.from(e.dataTransfer.files));
            }
        });
    }

    if (uploadButton && fileInput) {
        uploadButton.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", (e) => {
            const target = e.target as HTMLInputElement;
            if (target.files) {
                processNewFiles(Array.from(target.files));
                target.value = "";
            }
        });
    }

    if (googleDriveButton) {
        googleDriveButton.addEventListener("click", handleAuthClick);
        initGoogleDrive();
    }

    // --- Initial Render ---
    if (selection.categoria.subcategorias.length > 0) {
        renderColumn(selection.categoria.subcategorias, 1, 'Área de Marketing');
    } else {
        showDescriptionArea();
    }
}
