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

type CategoriesTreeData = CategoriaNode[];

// --- Flat search result ---
interface FlatSearchResult {
    path: string;         // 'Alumno > Correo institucional > Restablecer contraseña'
    pathParts: string[];  // ['Alumno', 'Correo institucional', 'Restablecer contraseña']
    categoria: CategoriaNode;
    subcatPath: SubcategoriaNode[]; // ordered path of subcategory nodes
}

/**
 * Initializes the dynamic and responsive ticket creation wizard.
 * @param treeData The static, pre-built tree of categories and subcategories.
 */
/** Recursively flattens tree into all leaf-or-internal paths for search. */
function flattenTree(treeData: CategoriesTreeData): FlatSearchResult[] {
    const results: FlatSearchResult[] = [];

    function walkSubs(categoria: CategoriaNode, subs: SubcategoriaNode[], parentPath: string[], parentSubcatPath: SubcategoriaNode[]) {
        for (const sub of subs) {
            const currentPath = [...parentPath, sub.nombre];
            const currentSubcatPath = [...parentSubcatPath, sub];
            if (sub.children.length === 0) {
                // Leaf: add to results
                results.push({
                    path: currentPath.join(' > '),
                    pathParts: currentPath,
                    categoria,
                    subcatPath: currentSubcatPath,
                });
            } else {
                // Non-leaf: recurse into children
                walkSubs(categoria, sub.children, currentPath, currentSubcatPath);
            }
        }
    }

    for (const cat of treeData) {
        if (cat.subcategorias.length === 0) {
            // Category itself is the leaf
            results.push({
                path: cat.nombre,
                pathParts: [cat.nombre],
                categoria: cat,
                subcatPath: [],
            });
        } else {
            walkSubs(cat, cat.subcategorias, [cat.nombre], []);
        }
    }

    return results;
}

export function initTicketWizard(treeData: CategoriesTreeData) {
    // --- State Management ---
    const selection = {
        categoria: null as CategoriaNode | null,
        nodes: [] as SubcategoriaNode[], // Path of selected subcategory nodes
    };

    // --- Pre-compute flat search index ---
    const flatResults = flattenTree(treeData);

    // --- DOM Element Cache ---
    const wizard = document.getElementById('wizard');
    const descripcionArea = document.getElementById('descripcion-area');
    const descripcionInput = document.getElementById('descripcion') as HTMLTextAreaElement;
    const closeDescripcionBtn = document.getElementById('close-descripcion-btn');

    // Afectado fields
    const afectadoFields = document.getElementById('afectado-fields');
    const afectadoCampus = document.getElementById('afectado_campus') as HTMLSelectElement | HTMLInputElement | null;
    const containerAfectadoClave = document.getElementById('container-afectado-clave');
    const containerAfectadoEmail = document.getElementById('container-afectado-email');
    const afectadoClave = document.getElementById('afectado_clave') as HTMLInputElement;
    const afectadoEmailUser = document.getElementById('afectado_email_user') as HTMLInputElement | null;
    const afectadoNombre = document.getElementById('afectado_nombre') as HTMLInputElement;
    const lblClave = document.getElementById('lbl-clave');
    const claveSearchSpinner = document.getElementById('clave-search-spinner');
    const emailSearchSpinner = document.getElementById('email-search-spinner');

    const submitButton = document.getElementById('submit-ticket') as HTMLButtonElement;
    const ticketForm = document.getElementById('ticket-form') as HTMLElement | null;
    
    // File Upload Elements
    const dropZone = document.getElementById('drop-zone');
    const attachmentArea = document.getElementById('attachment-area');
    const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
    const uploadButton = document.getElementById('upload-files-button');
    const googleDriveButton = document.getElementById('google-drive-button');

    if (!wizard || !descripcionArea || !descripcionInput || !submitButton || !ticketForm || !afectadoFields || !afectadoClave || !afectadoNombre || !lblClave) {
        console.error('Wizard initialization failed: One or more required DOM elements are missing.', {
            wizard, descripcionArea, descripcionInput, submitButton, ticketForm, 
            afectadoFields, afectadoClave, afectadoNombre, lblClave
        });
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

    // --- Dirty Tracking (Datos no guardados) & Modal de Confirmación ---
    let isSubmitting = false;
    let unsavedDataToast: { dismiss: () => void } | null = null;
    let pendingNavigationUrl: string | null = null;
    let pendingNavigationIsBack = false;

    function hasUnsavedData(): boolean {
        if (isSubmitting) return false;
        const hasDesc = (descripcionInput?.value.trim().length || 0) > 0;
        const hasClave = (afectadoClave?.value.trim().length || 0) > 0;
        const hasEmail = (afectadoEmailUser?.value.trim().length || 0) > 0;
        const hasNombre = (afectadoNombre?.value.trim().length || 0) > 0;
        const hasFiles = stagedFiles.length > 0;

        return hasDesc || hasClave || hasEmail || hasNombre || hasFiles;
    }

    function evaluateUnsavedDataState() {
        if (isSubmitting) {
            if (unsavedDataToast) {
                unsavedDataToast.dismiss();
                unsavedDataToast = null;
            }
            return;
        }

        const isDirty = hasUnsavedData();
        if (isDirty) {
            if (!unsavedDataToast) {
                unsavedDataToast = toast.info('Tienes información sin enviar en tu solicitud.', {
                    duration: 0,
                    closeable: true,
                });
            }
        } else {
            if (unsavedDataToast) {
                unsavedDataToast.dismiss();
                unsavedDataToast = null;
            }
        }
    }

    const unsavedModal = document.getElementById('unsaved-ticket-modal');
    const unsavedOverlay = document.getElementById('unsaved-ticket-overlay');
    const btnCancelTicketLeave = document.getElementById('cancel-ticket-leave');
    const btnConfirmDiscardTicket = document.getElementById('confirm-discard-ticket');

    function showUnsavedTicketModal(url?: string | null, isBack: boolean = false) {
        pendingNavigationUrl = url || null;
        pendingNavigationIsBack = isBack;
        if (unsavedModal) {
            unsavedModal.classList.remove('hidden');
            unsavedModal.classList.add('flex');
        }
    }

    function hideUnsavedTicketModal() {
        pendingNavigationUrl = null;
        pendingNavigationIsBack = false;
        if (unsavedModal) {
            unsavedModal.classList.add('hidden');
            unsavedModal.classList.remove('flex');
        }
    }

    if (btnCancelTicketLeave) {
        btnCancelTicketLeave.addEventListener('click', hideUnsavedTicketModal);
    }
    if (unsavedOverlay) {
        unsavedOverlay.addEventListener('click', hideUnsavedTicketModal);
    }

    if (btnConfirmDiscardTicket) {
        btnConfirmDiscardTicket.addEventListener('click', () => {
            isSubmitting = true;
            if (unsavedDataToast) {
                unsavedDataToast.dismiss();
                unsavedDataToast = null;
            }
            const navUrl = pendingNavigationUrl;
            const isBack = pendingNavigationIsBack;
            hideUnsavedTicketModal();

            if (isBack) {
                window.history.back();
            } else if (navUrl) {
                window.location.assign(navUrl);
            }
        });
    }

    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedData()) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    document.addEventListener('click', (e) => {
        if (!hasUnsavedData()) return;

        const target = e.target as HTMLElement;
        const link = target.closest('a') as HTMLAnchorElement | null;

        if (link && link.href) {
            if (link.target === '_blank' || link.href.startsWith('javascript:') || link.getAttribute('href') === '#') {
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            showUnsavedTicketModal(link.href, false);
        }
    }, true);

    document.addEventListener('astro:before-preparation', (ev: any) => {
        if (hasUnsavedData()) {
            ev.cancel();
            showUnsavedTicketModal(ev.to?.href, false);
        }
    });

    window.addEventListener('popstate', () => {
        if (hasUnsavedData()) {
            window.history.pushState(null, '', window.location.href);
            showUnsavedTicketModal(null, true);
        }
    });

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

    function renderColumn(items: (CategoriaNode | SubcategoriaNode)[], colIndex: number, title: string, type: 'categoria' | 'subcategoria') {
        removeColumns(colIndex);

        const columnDiv = document.createElement('div');
        columnDiv.setAttribute('data-col-index', String(colIndex));
        columnDiv.className = 'p-4 bg-card border rounded-lg flex flex-col flex-shrink-0 min-w-[200px]';

        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-2';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'font-semibold text-card-foreground text-sm truncate';
        titleSpan.textContent = title;
        header.appendChild(titleSpan);

        if (colIndex > 0) {
            const closeBtn = document.createElement('button');
            closeBtn.setAttribute('type', 'button');
            closeBtn.setAttribute('data-close-col', String(colIndex));
            closeBtn.className = 'text-muted-foreground hover:text-foreground text-sm leading-none p-1 rounded hover:bg-muted transition-colors';
            closeBtn.innerHTML = '&times;';
            header.appendChild(closeBtn);
        }

        const list = document.createElement('ul');
        list.className = 'space-y-2';

        items.forEach(item => {
            const li = document.createElement('li');
            const button = document.createElement('button');
            button.setAttribute('type', 'button');
            button.setAttribute('data-id', String(item.id));
            button.setAttribute('data-col-index', String(colIndex));
            button.setAttribute('data-type', type);
            button.className = 'w-full text-left p-2 rounded-md hover:bg-muted text-card-foreground text-sm transition-colors flex justify-between items-center';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'truncate';
            nameSpan.textContent = item.nombre;
            button.appendChild(nameSpan);

            const hasChildren = 'subcategorias' in item ? item.subcategorias.length > 0 : (item.children && item.children.length > 0);
            if (hasChildren) {
                const arrow = document.createElement('span');
                arrow.className = 'text-muted-foreground text-xs ml-1 flex-shrink-0';
                arrow.textContent = '>';
                button.appendChild(arrow);
            }

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
        // Mostrar nuevamente todos los elementos de las listas
        const allListItems = wizard!.querySelectorAll('li');
        allListItems.forEach(li => {
            li.classList.remove('hidden');
        });

        // Limpiar inputs del formulario y resetear estados
        if (descripcionInput) descripcionInput.value = '';
        if (afectadoClave) {
            afectadoClave.value = '';
            afectadoClave.placeholder = 'Ingresa matrícula...';
        }
        if (afectadoEmailUser) afectadoEmailUser.value = '';
        if (afectadoNombre) {
            afectadoNombre.value = '';
            afectadoNombre.readOnly = false;
            afectadoNombre.classList.remove('bg-muted', 'cursor-not-allowed', 'opacity-80');
        }
        if (claveSearchSpinner) claveSearchSpinner.classList.add('hidden');
        if (emailSearchSpinner) emailSearchSpinner.classList.add('hidden');

        // Limpiar adjuntos
        stagedFiles = [];
        if (attachmentArea) attachmentArea.innerHTML = '';

        evaluateUnsavedDataState();
        validateForm();
    }

    function showDescriptionArea() {
        if (!descripcionArea || !descripcionInput) return;
        descripcionArea.classList.remove('hidden');

        // Ocultar los elementos no seleccionados en todas las columnas activas
        const allListItems = wizard!.querySelectorAll('li');
        allListItems.forEach(li => {
            const btn = li.querySelector('button');
            if (btn && !btn.classList.contains('bg-secondary')) {
                li.classList.add('hidden');
            }
        });

        // Logic for affected fields
        if (selection.categoria) {
            const catId = selection.categoria.id;
            // 1: Alumno, 2: Aspirante, 3: Colaborador, 4: Docente
            if ([1, 2, 3, 4].includes(catId)) {
                afectadoFields!.classList.remove('hidden');
                afectadoFields!.classList.add('grid');

                if (catId === 1) {
                    // Alumno
                    containerAfectadoClave?.classList.remove('hidden');
                    containerAfectadoEmail?.classList.add('hidden');
                    lblClave!.innerHTML = 'Matrícula <span class="text-destructive">*</span>';
                    afectadoClave.placeholder = 'Ingresa matrícula...';
                    afectadoNombre.readOnly = afectadoNombre.value.trim().length > 0;
                    if (afectadoNombre.readOnly) {
                        afectadoNombre.classList.add('bg-muted', 'cursor-not-allowed', 'opacity-80');
                    } else {
                        afectadoNombre.classList.remove('bg-muted', 'cursor-not-allowed', 'opacity-80');
                    }
                } else if (catId === 2) {
                    // Aspirante
                    containerAfectadoClave?.classList.remove('hidden');
                    containerAfectadoEmail?.classList.add('hidden');
                    lblClave!.innerHTML = 'Folio <span class="text-destructive">*</span>';
                    afectadoClave.placeholder = 'Ingresa folio...';
                    afectadoNombre.readOnly = afectadoNombre.value.trim().length > 0;
                    if (afectadoNombre.readOnly) {
                        afectadoNombre.classList.add('bg-muted', 'cursor-not-allowed', 'opacity-80');
                    } else {
                        afectadoNombre.classList.remove('bg-muted', 'cursor-not-allowed', 'opacity-80');
                    }
                } else if (catId === 3) {
                    // Colaborador
                    containerAfectadoClave?.classList.add('hidden');
                    containerAfectadoEmail?.classList.remove('hidden');
                    afectadoNombre.readOnly = afectadoNombre.value.trim().length > 0;
                    if (afectadoNombre.readOnly) {
                        afectadoNombre.classList.add('bg-muted', 'cursor-not-allowed', 'opacity-80');
                    } else {
                        afectadoNombre.classList.remove('bg-muted', 'cursor-not-allowed', 'opacity-80');
                    }
                } else if (catId === 4) {
                    // Docente
                    containerAfectadoClave?.classList.remove('hidden');
                    containerAfectadoEmail?.classList.add('hidden');
                    lblClave!.innerHTML = 'Clave <span class="text-destructive">*</span>';
                    afectadoClave.placeholder = 'Ingresa clave docente...';
                    afectadoNombre.readOnly = false;
                    afectadoNombre.classList.remove('bg-muted', 'cursor-not-allowed', 'opacity-80');
                }
            } else {
                afectadoFields!.classList.add('hidden');
                afectadoFields!.classList.remove('grid');
                afectadoClave.value = '';
                if (afectadoEmailUser) afectadoEmailUser.value = '';
                afectadoNombre.value = '';
                afectadoNombre.readOnly = false;
                afectadoNombre.classList.remove('bg-muted', 'cursor-not-allowed', 'opacity-80');
            }
        }

        validateForm();
        descripcionArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        descripcionInput.focus();
    }

    function handleSelection(selectedButton: HTMLButtonElement) {
        const id = parseInt(selectedButton.dataset.id!, 10);
        const type = selectedButton.dataset.type as 'categoria' | 'subcategoria';
        const colIndex = parseInt(selectedButton.dataset.colIndex!, 10);

        // New, more robust selection logic
        const allButtons = wizard!.querySelectorAll(`button[data-col-index="${colIndex}"]`);
        allButtons.forEach(btn => {
            btn.classList.remove('bg-secondary', 'text-secondary-foreground');
        });
        selectedButton.classList.add('bg-secondary', 'text-secondary-foreground');

        removeColumns(colIndex + 1);
        hideDescriptionArea();

        if (type === 'categoria') {
            const categoria = treeData.find(c => c.id === id);
            if (!categoria) return;

            selection.categoria = categoria;
            selection.nodes = [];

            if (categoria.subcategorias.length > 0) {
                renderColumn(categoria.subcategorias, 1, categoria.nombre, 'subcategoria');
            } else {
                showDescriptionArea();
            }
        } else if (type === 'subcategoria') {
            const parentNode = colIndex === 1 ? selection.categoria : selection.nodes[colIndex - 2];
            const itemsToSearch = parentNode ? ('subcategorias' in parentNode ? parentNode.subcategorias : parentNode.children) : [];
            const subcatNode = itemsToSearch.find(s => s.id === id);

            if (!subcatNode) return;

            // Redirección para Traslado
            if (subcatNode.id === 58) {
                window.location.href = "/tickets/soporte/traslado";
                return;
            }

            selection.nodes.splice(colIndex - 1);
            selection.nodes.push(subcatNode);

            if (subcatNode.children.length > 0) {
                renderColumn(subcatNode.children, colIndex + 1, subcatNode.nombre, 'subcategoria');
            } else {
                showDescriptionArea();
            }
        }
        validateForm();
    }

    function formatCapitalizedName(str: string): string {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(w => {
            if (!w) return '';
            return w.charAt(0).toUpperCase() + w.slice(1);
        }).join(' ').trim();
    }

    async function consultarAlumno() {
        if (!selection.categoria || selection.categoria.id !== 1) return;
        const campus = afectadoCampus?.value?.trim() || '';
        const matricula = afectadoClave?.value?.trim() || '';

        if (!matricula) return;

        if (!campus) {
            toast.warning('Por favor selecciona un Campus primero.');
            return;
        }

        // Validar solo letras y números
        if (!/^[a-zA-Z0-9]+$/.test(matricula)) {
            toast.error('La matrícula solo debe contener letras y números.');
            return;
        }

        if (claveSearchSpinner) claveSearchSpinner.classList.remove('hidden');

        try {
            const url = `https://pz3bmmqsty.us-east-1.awsapprunner.com/api/alumnos/consultar-detalle?campus=${encodeURIComponent(campus)}&matricula=${encodeURIComponent(matricula)}`;
            const res = await fetch(url, {
                headers: {
                    'x-api-key': 'CHURRUMAIS-1979',
                },
            });

            let json: any = null;
            try {
                json = await res.json();
            } catch (_) {}

            if (res.ok && json?.status === 'success' && json?.data?.Alumno) {
                const nombreFormatted = formatCapitalizedName(json.data.Alumno);
                afectadoNombre.value = nombreFormatted;
                afectadoNombre.readOnly = true;
                afectadoNombre.classList.add('bg-muted', 'cursor-not-allowed', 'opacity-80');
                toast.success(`Alumno encontrado: ${nombreFormatted}`);
            } else if (json?.detail) {
                toast.error(json.detail);
                afectadoNombre.value = '';
                afectadoNombre.readOnly = false;
                afectadoNombre.classList.remove('bg-muted', 'cursor-not-allowed', 'opacity-80');
            } else {
                toast.error('No se encontró al alumno con la matrícula especificada.');
                afectadoNombre.value = '';
                afectadoNombre.readOnly = false;
                afectadoNombre.classList.remove('bg-muted', 'cursor-not-allowed', 'opacity-80');
            }
        } catch (err) {
            console.error('Error al consultar alumno:', err);
            toast.error('Error de conexión al consultar el alumno.');
        } finally {
            if (claveSearchSpinner) claveSearchSpinner.classList.add('hidden');
            validateForm();
        }
    }

    async function consultarAspirante() {
        if (!selection.categoria || selection.categoria.id !== 2) return;
        const campus = afectadoCampus?.value?.trim() || '';
        const folio = afectadoClave?.value?.trim() || '';

        if (!folio) return;

        if (!campus) {
            toast.warning('Por favor selecciona un Campus primero.');
            return;
        }

        // Validar solo letras y números
        if (!/^[a-zA-Z0-9]+$/.test(folio)) {
            toast.error('El folio solo debe contener letras y números.');
            return;
        }

        if (claveSearchSpinner) claveSearchSpinner.classList.remove('hidden');

        try {
            const url = `https://pz3bmmqsty.us-east-1.awsapprunner.com/api/aspirantes/consultar-detalle?campus=${encodeURIComponent(campus)}&folio=${encodeURIComponent(folio)}`;
            const res = await fetch(url, {
                headers: {
                    'accept': 'application/json',
                    'x-api-key': 'CHURRUMAIS-1979',
                },
            });

            let json: any = null;
            try {
                json = await res.json();
            } catch (_) {}

            if (res.ok && json?.status === 'success' && json?.data) {
                const nombreParts = [
                    json.data.nombre,
                    json.data.ap_paterno,
                    json.data.ap_materno
                ].filter(Boolean).join(' ');

                const nombreFormatted = formatCapitalizedName(nombreParts);
                afectadoNombre.value = nombreFormatted;
                afectadoNombre.readOnly = true;
                afectadoNombre.classList.add('bg-muted', 'cursor-not-allowed', 'opacity-80');
                toast.success(`Aspirante encontrado: ${nombreFormatted}`);
            } else if (json?.detail) {
                const msg = typeof json.detail === 'string' ? json.detail : (Array.isArray(json.detail) ? json.detail.map((d: any) => d.msg).join(', ') : 'Error de validación');
                toast.error(msg);
                afectadoNombre.value = '';
                afectadoNombre.readOnly = false;
                afectadoNombre.classList.remove('bg-muted', 'cursor-not-allowed', 'opacity-80');
            } else {
                toast.error('No se encontró al aspirante con el folio especificado.');
                afectadoNombre.value = '';
                afectadoNombre.readOnly = false;
                afectadoNombre.classList.remove('bg-muted', 'cursor-not-allowed', 'opacity-80');
            }
        } catch (err) {
            console.error('Error al consultar aspirante:', err);
            toast.error('Error de conexión al consultar el aspirante.');
        } finally {
            if (claveSearchSpinner) claveSearchSpinner.classList.add('hidden');
            validateForm();
        }
    }

    async function consultarColaborador() {
        if (!selection.categoria || selection.categoria.id !== 3) return;
        const emailUser = afectadoEmailUser?.value?.trim() || '';

        if (!emailUser) return;

        // Validar formato de la parte previa al dominio: solo letras, números, punto y guión medio
        if (!/^[a-zA-Z0-9.-]+$/.test(emailUser)) {
            toast.error('El usuario de correo solo debe contener letras, números, puntos y guiones.');
            return;
        }

        const fullEmail = `${emailUser}@humanitas.edu.mx`;
        if (emailSearchSpinner) emailSearchSpinner.classList.remove('hidden');

        try {
            const url = `https://pz3bmmqsty.us-east-1.awsapprunner.com/api/rh/consultar-trabajador?email=${encodeURIComponent(fullEmail)}`;
            const res = await fetch(url, {
                headers: {
                    'accept': 'application/json',
                    'x-api-key': 'CHURRUMAIS-1979',
                },
            });

            let json: any = null;
            try {
                json = await res.json();
            } catch (_) {}

            if (res.ok && json?.status === 'success' && json?.data?.Nombre) {
                const nombreFormatted = formatCapitalizedName(json.data.Nombre);
                afectadoNombre.value = nombreFormatted;
                afectadoNombre.readOnly = true;
                afectadoNombre.classList.add('bg-muted', 'cursor-not-allowed', 'opacity-80');
                toast.success(`Colaborador encontrado: ${nombreFormatted}`);
            } else {
                toast.error('No se encontró al colaborador o no se encuentra activo.');
                afectadoNombre.value = '';
                afectadoNombre.readOnly = false;
                afectadoNombre.classList.remove('bg-muted', 'cursor-not-allowed', 'opacity-80');
            }
        } catch (err) {
            console.error('Error al consultar trabajador:', err);
            toast.error('Error de conexión al consultar colaborador.');
        } finally {
            if (emailSearchSpinner) emailSearchSpinner.classList.add('hidden');
            validateForm();
        }
    }

    function validateForm() {
        const hasDescription = descripcionInput.value.trim().length > 0;
        const lastSelectedNode = selection.nodes[selection.nodes.length - 1];
        const isSelectionFinal =
            (selection.categoria && selection.categoria.subcategorias.length === 0) ||
            (lastSelectedNode && lastSelectedNode.children.length === 0);

        let areAfectadoFieldsValid = true;
        if (afectadoFields && !afectadoFields.classList.contains('hidden') && selection.categoria) {
            const catId = selection.categoria.id;
            const hasCampus = afectadoCampus ? afectadoCampus.value.trim().length > 0 : true;
            const hasNombre = afectadoNombre.value.trim().length > 0;

            if (catId === 3) {
                // Colaborador
                const hasEmail = afectadoEmailUser ? afectadoEmailUser.value.trim().length > 0 : false;
                areAfectadoFieldsValid = hasCampus && hasEmail && hasNombre;
            } else if ([1, 2, 4].includes(catId)) {
                // Alumno, Aspirante, Docente
                const hasClave = afectadoClave.value.trim().length > 0;
                areAfectadoFieldsValid = hasCampus && hasClave && hasNombre;
            }
        }

        submitButton.disabled = !(isSelectionFinal && hasDescription && areAfectadoFieldsValid);
    }

    // --- File Upload Logic ---
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
                        },
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
        `,
            )
            .join("");

        attachmentArea.innerHTML = listConfig;

        // Re-attach listeners for remove buttons
        document.querySelectorAll(".remove-file-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation(); // prevent triggering dropzone select
                const id = parseInt((e.target as HTMLElement).dataset.id || "0");
                stagedFiles = stagedFiles.filter((f) => f.id !== id);
                renderStagedFiles();
                evaluateUnsavedDataState();
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
        evaluateUnsavedDataState();
    };

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        isSubmitting = true;
        if (unsavedDataToast) {
            unsavedDataToast.dismiss();
            unsavedDataToast = null;
        }
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';

        const lastSelectedNode = selection.nodes[selection.nodes.length - 1];

        const isAfectadoVisible = !afectadoFields!.classList.contains('hidden');
        let claveValue: string | null = null;
        let campusValue: string | null = null;

        if (isAfectadoVisible && selection.categoria) {
            campusValue = afectadoCampus?.value.trim() || null;
            if (selection.categoria.id === 3) {
                claveValue = afectadoEmailUser?.value.trim() ? `${afectadoEmailUser.value.trim()}@humanitas.edu.mx` : null;
            } else {
                claveValue = afectadoClave.value.trim() || null;
            }
        }

        try {
            const response = await fetch('/api/tickets/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categoriaId: selection.categoria?.id,
                    subcategoriaId: lastSelectedNode?.id || null,
                    descripcion: descripcionInput.value,
                    afectado_campus: campusValue,
                    afectado_clave: claveValue,
                    afectado_nombre: isAfectadoVisible ? afectadoNombre.value.trim() : null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Error en la respuesta del servidor.' }));
                throw new Error(errorData.message);
            }

            const resData = await response.json();
            const ticketId = resData.id;

            // --- 2. Upload Files (if any) ---
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

                // --- 3. Update Ticket with files ---
                if (keys.length > 0) {
                    await fetch("/api/tickets/update", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            ticketId: ticketId,
                            newFiles: keys,
                            newComment: "Archivos adjuntos en creación.",
                        }),
                    });
                }
            }

            toast.success('¡Ticket Enviado!', { duration: 3000 });

            setTimeout(() => {
                const redirectUrl = ticketForm!.dataset.redirectUrl || '/tickets/soporte';
                window.location.href = redirectUrl;
            }, 1500);

        } catch (error) {
            isSubmitting = false;
            evaluateUnsavedDataState();
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
            selection.nodes.splice(colIndex - 1);
            hideDescriptionArea();
            validateForm();
        }
    });

    descripcionInput.addEventListener('input', () => {
        validateForm();
        evaluateUnsavedDataState();
    });
    afectadoNombre.addEventListener('input', () => {
        validateForm();
        evaluateUnsavedDataState();
    });

    if (afectadoClave) {
        afectadoClave.addEventListener('input', () => {
            validateForm();
            evaluateUnsavedDataState();
        });
        afectadoClave.addEventListener('blur', () => {
            if (selection.categoria?.id === 1) {
                consultarAlumno();
            } else if (selection.categoria?.id === 2) {
                consultarAspirante();
            }
        });
        afectadoClave.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (selection.categoria?.id === 1) {
                    consultarAlumno();
                } else if (selection.categoria?.id === 2) {
                    consultarAspirante();
                }
            }
        });
    }

    if (afectadoEmailUser) {
        afectadoEmailUser.addEventListener('input', () => {
            validateForm();
            evaluateUnsavedDataState();
        });
        afectadoEmailUser.addEventListener('blur', () => {
            if (selection.categoria?.id === 3) {
                consultarColaborador();
            }
        });
        afectadoEmailUser.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (selection.categoria?.id === 3) {
                    consultarColaborador();
                }
            }
        });
    }

    if (afectadoCampus) {
        afectadoCampus.addEventListener('change', () => {
            validateForm();
            evaluateUnsavedDataState();
            if (selection.categoria?.id === 1 && afectadoClave?.value.trim()) {
                consultarAlumno();
            } else if (selection.categoria?.id === 2 && afectadoClave?.value.trim()) {
                consultarAspirante();
            }
        });
    }

    // --- File Listeners ---
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
    }

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
        dropZone.addEventListener("click", (e) => {
            if (!(e.target as HTMLElement).closest(".remove-file-btn")) {
                fileInput?.click();
            }
        });
    }

    if (closeDescripcionBtn) {
        closeDescripcionBtn.addEventListener('click', () => {
            hideDescriptionArea();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (descripcionArea && !descripcionArea.classList.contains('hidden')) {
                hideDescriptionArea();
            } else {
                const closeBtns = Array.from(wizard!.querySelectorAll('button[data-close-col]')) as HTMLButtonElement[];
                if (closeBtns.length > 0) {
                    const lastCloseBtn = closeBtns.reduce((prev, current) => {
                        const prevIdx = parseInt(prev.getAttribute('data-close-col')!, 10);
                        const currIdx = parseInt(current.getAttribute('data-close-col')!, 10);
                        return (currIdx > prevIdx) ? current : prev;
                    });
                    lastCloseBtn.click();
                }
            }
        }
    });

    initGoogleDrive();

    ticketForm.addEventListener('submit', handleSubmit);

    // --- Search Bar ---
    function initSearchBar() {
        const searchContainer = document.getElementById('category-search-container');
        if (!searchContainer) return;

        // Build the UI: max-w-[1280px], input h-[42px]
        searchContainer.innerHTML = `
            <div class="relative w-full max-w-[1280px]">
                <div class="relative">
                    <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <input
                        id="category-search-input"
                        type="text"
                        placeholder="Buscar categoría o subcategoría... (Ctrl + B)"
                        autocomplete="off"
                        class="w-full h-[42px] pl-10 pr-10 rounded-md border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-muted-foreground transition-all shadow-sm"
                    />
                    <button id="category-search-clear" type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors hidden" title="Limpiar búsqueda">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>
                <div id="category-search-dropdown" class="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-xl hidden max-h-72 overflow-y-auto">
                </div>
            </div>
        `;

        const input = document.getElementById('category-search-input') as HTMLInputElement | null;
        const dropdown = document.getElementById('category-search-dropdown');
        const clearBtn = document.getElementById('category-search-clear');

        if (!input || !dropdown || !clearBtn) return;

        let activeIndex = -1;
        let currentResults: FlatSearchResult[] = [];

        // Atajo de teclado: Ctrl + B para hacer focus en el buscador
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
                e.preventDefault();
                input.focus();
                input.select();
            }
        });

        function highlightQuery(text: string, query: string): string {
            if (!query) return text;
            const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return text.replace(
                new RegExp(`(${escaped})`, 'gi'),
                '<mark class="match-mark bg-secondary/20 text-secondary font-bold px-1 rounded-sm">$1</mark>'
            );
        }

        function updateActiveItem(newIndex: number) {
            const items = dropdown!.querySelectorAll('.search-result-item');
            if (items.length === 0) return;

            items.forEach((item, idx) => {
                if (idx === newIndex) {
                    item.classList.add('search-result-active', 'bg-accent');
                    item.scrollIntoView({ block: 'nearest' });
                } else {
                    item.classList.remove('search-result-active', 'bg-accent');
                }
            });
            activeIndex = newIndex;
        }

        function renderDropdown(query: string) {
            const q = query.trim().toLowerCase();
            if (q.length < 2) {
                dropdown!.classList.add('hidden');
                dropdown!.innerHTML = '';
                currentResults = [];
                activeIndex = -1;
                return;
            }

            currentResults = flatResults
                .filter(r => r.path.toLowerCase().includes(q));

            if (currentResults.length === 0) {
                dropdown!.innerHTML = `<div class="px-4 py-3 text-sm text-muted-foreground">Sin resultados para "${query}".</div>`;
                dropdown!.classList.remove('hidden');
                return;
            }

            dropdown!.innerHTML = currentResults.map((r, i) => {
                const highlighted = r.pathParts
                    .map((part, pi) => {
                        const isLast = pi === r.pathParts.length - 1;
                        const hl = highlightQuery(part, query);
                        if (isLast) return `<span class="font-semibold text-foreground text-sm">${hl}</span>`;
                        return `<span class="text-muted-foreground text-xs">${hl}</span>`;
                    })
                    .join('<span class="text-muted-foreground/60 mx-1 text-xs">&rsaquo;</span>');

                return `<button
                    type="button"
                    data-result-index="${i}"
                    class="search-result-item group w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-accent focus:outline-none flex flex-col gap-0.5 transition-colors border-b border-border/30 last:border-none"
                >
                    <span class="flex items-center flex-wrap gap-1">${highlighted}</span>
                </button>`;
            }).join('');

            dropdown!.classList.remove('hidden');
            activeIndex = -1;

            // Attach event handlers
            dropdown!.querySelectorAll('.search-result-item').forEach((btn, idx) => {
                btn.addEventListener('mouseenter', () => {
                    updateActiveItem(idx);
                });
                btn.addEventListener('click', () => {
                    selectResult(currentResults[idx]);
                });
            });
        }

        function selectResult(result: FlatSearchResult) {
            // 1. Reset wizard completely
            removeColumns(0);
            hideDescriptionArea();
            selection.categoria = null;
            selection.nodes = [];

            // 2. Re-render column 0 with categories
            renderColumn(treeData, 0, 'Categoría', 'categoria');

            // 3. Click the category button
            const catBtn = wizard!.querySelector(`button[data-id="${result.categoria.id}"][data-type="categoria"]`) as HTMLButtonElement | null;
            if (catBtn) catBtn.click();

            // 4. Walk through subcategory path clicking each
            for (let i = 0; i < result.subcatPath.length; i++) {
                const sub = result.subcatPath[i];
                const subBtn = wizard!.querySelector(`button[data-id="${sub.id}"][data-type="subcategoria"]`) as HTMLButtonElement | null;
                if (subBtn) subBtn.click();
            }

            // 5. Clear search
            input!.value = '';
            clearBtn!.classList.add('hidden');
            dropdown!.classList.add('hidden');
            dropdown!.innerHTML = '';
            currentResults = [];
            activeIndex = -1;
        }

        input.addEventListener('input', () => {
            const q = input!.value;
            clearBtn!.classList.toggle('hidden', q.length === 0);
            renderDropdown(q);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (currentResults.length > 0) {
                    const nextIndex = Math.min(activeIndex + 1, currentResults.length - 1);
                    updateActiveItem(nextIndex);
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (currentResults.length > 0) {
                    const prevIndex = Math.max(activeIndex - 1, 0);
                    updateActiveItem(prevIndex);
                }
            } else if (e.key === 'Escape') {
                dropdown!.classList.add('hidden');
                input!.blur();
            } else if (e.key === 'Enter') {
                if (currentResults.length > 0) {
                    e.preventDefault();
                    const targetIdx = activeIndex >= 0 ? activeIndex : 0;
                    selectResult(currentResults[targetIdx]);
                }
            }
        });

        clearBtn.addEventListener('click', () => {
            input!.value = '';
            clearBtn!.classList.add('hidden');
            dropdown!.classList.add('hidden');
            dropdown!.innerHTML = '';
            input!.focus();
        });

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!searchContainer.contains(e.target as Node)) {
                dropdown!.classList.add('hidden');
            }
        });
    }

    initSearchBar();

    // --- Initial Render ---
    renderColumn(treeData, 0, 'Categoría', 'categoria');
}