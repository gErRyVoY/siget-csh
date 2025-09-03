import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

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

/**
 * Initializes the dynamic and responsive ticket creation wizard.
 * @param treeData The static, pre-built tree of categories and subcategories.
 */
export function initTicketWizard(treeData: CategoriesTreeData) {
    // --- State Management ---
    const selection = {
        categoria: null as CategoriaNode | null,
        nodes: [] as SubcategoriaNode[], // Path of selected subcategory nodes
    };

    // --- DOM Element Cache ---
    const wizard = document.getElementById('wizard');
    const descripcionArea = document.getElementById('descripcion-area');
    const descripcionTitle = document.getElementById('descripcion-title');
    const descripcionInput = document.getElementById('descripcion') as HTMLTextAreaElement;
    const submitButton = document.getElementById('submit-ticket') as HTMLButtonElement;
    const ticketForm = document.getElementById('ticket-form');

    if (!wizard || !descripcionArea || !descripcionTitle || !descripcionInput || !submitButton || !ticketForm) {
        console.error('Wizard initialization failed: One or more required DOM elements are missing.');
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

    function renderColumn(items: (CategoriaNode | SubcategoriaNode)[], colIndex: number, title: string, type: 'categoria' | 'subcategoria') {
        removeColumns(colIndex);

        const columnDiv = document.createElement('div');
        columnDiv.setAttribute('data-col-index', String(colIndex));
        columnDiv.className = 'p-4 bg-card border rounded-lg flex flex-col flex-shrink-0 min-w-[200px]';

        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-2';

        const h3 = document.createElement('h3');
        h3.className = 'font-semibold text-card-foreground truncate';
        h3.textContent = title;
        h3.title = title;
        header.appendChild(h3);

        if (colIndex > 0) {
            const closeButton = document.createElement('button');
            closeButton.className = 'p-1 rounded-md hover:bg-accent text-muted-foreground';
            closeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
            closeButton.setAttribute('data-close-col', String(colIndex));
            header.appendChild(closeButton);
        }

        const list = document.createElement('ul');
        list.className = 'space-y-2 overflow-y-auto';

        items.forEach(item => {
            const li = document.createElement('li');
            const button = document.createElement('button');
            button.dataset.id = String(item.id);
            button.dataset.type = type;
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
        const path = [selection.categoria?.nombre, ...selection.nodes.map(n => n.nombre)].filter(Boolean).join(' > ');
        descripcionArea.classList.remove('hidden');
        descripcionTitle.textContent = `Describe tu solicitud para: ${path}`;
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
        if(descripcionArea) descripcionArea.classList.add('hidden');

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

    function validateForm() {
        const hasDescription = descripcionInput.value.trim().length > 0;
        const lastSelectedNode = selection.nodes[selection.nodes.length - 1];
        const isSelectionFinal =
            (selection.categoria && selection.categoria.subcategorias.length === 0) ||
            (lastSelectedNode && lastSelectedNode.children.length === 0);

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
                    categoriaId: selection.categoria?.id,
                    subcategoriaId: lastSelectedNode?.id || null,
                    descripcion: descripcionInput.value,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Error en la respuesta del servidor.' }));
                throw new Error(errorData.message);
            }

            await Swal.fire({ title: '¡Ticket Enviado!', text: 'Tu solicitud ha sido creada exitosamente.', icon: 'success', timer: 2000, timerProgressBar: true, showConfirmButton: false });
            window.location.href = '/tickets/soporte';

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'No se pudo crear el ticket.';
            await Swal.fire({ title: 'Error', text: errorMessage, icon: 'error' });
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
            if(descripcionArea) descripcionArea.classList.add('hidden');
            validateForm();
        }
    });

    descripcionInput.addEventListener('input', validateForm);
    ticketForm.addEventListener('submit', handleSubmit);

    // --- Initial Render ---
    renderColumn(treeData, 0, 'Categoría', 'categoria');
}