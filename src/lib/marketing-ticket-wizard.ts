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

    // Afectado fields
    const afectadoFields = document.getElementById('afectado-fields');
    const afectadoClave = document.getElementById('afectado_clave') as HTMLInputElement;
    const afectadoNombre = document.getElementById('afectado_nombre') as HTMLInputElement;
    const lblClave = document.getElementById('lbl-clave');

    const submitButton = document.getElementById('submit-ticket') as HTMLButtonElement;
    const ticketForm = document.getElementById('ticket-form');

    if (!wizard || !descripcionArea || !descripcionTitle || !descripcionInput || !submitButton || !ticketForm || !afectadoFields || !afectadoClave || !afectadoNombre || !lblClave) {
        console.error('Marketing Wizard initialization failed: One or more required DOM elements are missing.');
        return;
    }

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

    function showDescriptionArea() {
        if (!descripcionArea || !descripcionTitle || !descripcionInput) return;
        const path = [selection.categoria.nombre, ...selection.nodes.map(n => n.nombre)].filter(Boolean).join(' > ');
        descripcionArea.classList.remove('hidden');
        descripcionTitle.textContent = `Solicitud: ${path}`;

        // Logic for affected fields -- Marketing USUALLY doesn't deal with students directly in the same way as Control Escolar,
        // but if they select "Alumno" or similar related categories inside Marketing (unlikely but possible), logic is here.
        // Actually, Marketing 12 doesn't have "Alumnos" as subcategories normally, but let's keep the logic safe.
        // The subcategories are typically: Diseño, Redes, etc.

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
        if (descripcionArea) descripcionArea.classList.add('hidden');

        // Logic depends on column index
        // Col 1 = First level subcategories of Marketing
        // Col N = Children of previous selection

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
        // Selection is final if we reached a node with no children
        const lastSelectedNode = selection.nodes[selection.nodes.length - 1];
        const isSelectionFinal = lastSelectedNode && lastSelectedNode.children.length === 0;

        submitButton.disabled = !(isSelectionFinal && hasDescription);
    }

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';

        const lastSelectedNode = selection.nodes[selection.nodes.length - 1];

        try {
            const response = await fetch('/api/tickets/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categoriaId: selection.categoria.id,
                    subcategoriaId: lastSelectedNode?.id || null,
                    descripcion: descripcionInput.value,
                    // Marketing tickets typically don't have afectado fields unless specified
                    afectado_clave: null,
                    afectado_nombre: null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Error en la respuesta del servidor.' }));
                throw new Error(errorData.message);
            }

            toast.success('¡Ticket de Marketing Creado!', { duration: 3000 });

            setTimeout(() => {
                // Redirect to Marketing specific user view
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
        if (button) {
            handleSelection(button);
        }
    });

    descripcionInput.addEventListener('input', validateForm);
    ticketForm.addEventListener('submit', handleSubmit);

    // --- Initial Render ---
    // Automatically render the first column with Marketing subcategories
    if (selection.categoria.subcategorias.length > 0) {
        renderColumn(selection.categoria.subcategorias, 1, 'Área de Marketing');
    } else {
        // Fallback if no subcategories (shouldn't happen for Marketing with data)
        showDescriptionArea();
    }
}
