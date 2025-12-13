import { toast } from './toast';

/**
 * Configuration for the modal setup.
 */
interface ModalConfig {
    idPrefix: string;
    storageKey: string;
    validate: (showAllErrors?: boolean) => boolean;
    getFormData: () => Record<string, any>;
    loadFormData: (data: Record<string, any>) => void;
    successMessage?: string;
    onSuccess?: () => void;
    onSubmit?: (data: Record<string, any>) => Promise<void>;
}

/**
 * A comprehensive setup function for modals with forms.
 * @param config The configuration object for the modal.
 */
export function setupModal(config: ModalConfig): void {
    const { idPrefix, storageKey, validate, getFormData, loadFormData, successMessage, onSuccess } = config;

    // --- Get Elements ---
    const modal = document.getElementById(`${idPrefix}-modal`) as HTMLElement | null;
    const trigger = document.getElementById(`${idPrefix}-trigger`) as HTMLButtonElement | null;
    const closeButton = document.getElementById(`${idPrefix}-close`) as HTMLButtonElement | null;
    const overlay = document.getElementById(`${idPrefix}-overlay`) as HTMLElement | null;
    const dialog = document.getElementById(`${idPrefix}-dialog`) as HTMLElement | null;
    const form = document.getElementById(`${idPrefix}-form`) as HTMLFormElement | null;
    const body = document.body as HTMLBodyElement;

    if (!modal || !trigger || !closeButton || !overlay || !dialog || !form) {
        console.error(`Modal elements not found for prefix: ${idPrefix}`);
        return;
    }

    // --- Modal Toggling ---
    const toggleModal = (show: boolean): void => {
        if (modal) {
            modal.dataset.state = show ? 'open' : 'closed';
        }
        body.style.overflow = show ? 'hidden' : '';
    };

    trigger.addEventListener('click', () => toggleModal(true));
    closeButton.addEventListener('click', () => toggleModal(false));
    overlay.addEventListener('click', () => toggleModal(false));
    dialog.addEventListener('click', (e: Event) => e.stopPropagation());
    document.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape' && modal.dataset.state === 'open') {
            toggleModal(false);
        }
    });

    // --- Form Persistence ---
    const save = (): void => localStorage.setItem(storageKey, JSON.stringify(getFormData()));
    const load = (): void => {
        const savedData = localStorage.getItem(storageKey);
        if (savedData) {
            loadFormData(JSON.parse(savedData));
        }
    };
    const clear = (): void => localStorage.removeItem(storageKey);

    // --- Form Event Listeners ---
    form.addEventListener('input', () => {
        validate();
        save();
    });
    form.addEventListener('change', () => {
        validate();
        save();
    });

    form.addEventListener('submit', async (e: SubmitEvent) => {
        e.preventDefault();
        if (!validate(true)) return; // Pass true to show all errors on submit attempt

        if (config.onSubmit) {
            try {
                await config.onSubmit(getFormData());
            } catch (error) {
                console.error('Error in modal submission:', error);
                toast.error('Ocurrió un error al enviar el formulario.');
                return;
            }
        }

        // Show success toast
        toast.success(successMessage || 'Operación exitosa', { duration: 3000 });

        // Close modal and reset form
        toggleModal(false);
        form.reset();
        clear();
        validate();
        if (onSuccess) onSuccess();
    });

    // --- Initial State ---
    load();
    validate();
}