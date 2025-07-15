import Swal, { type SweetAlertOptions } from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

/**
 * Configuration for the modal setup.
 */
interface ModalConfig {
    idPrefix: string;
    storageKey: string;
    validate: (showAllErrors?: boolean) => boolean;
    getFormData: () => Record<string, any>;
    loadFormData: (data: Record<string, any>) => void;
    swalConfig: SweetAlertOptions;
    onSuccess?: () => void;
}

/**
 * A comprehensive setup function for modals with forms.
 * @param config The configuration object for the modal.
 */
export function setupModal(config: ModalConfig): void {
    const { idPrefix, storageKey, validate, getFormData, loadFormData, swalConfig, onSuccess } = config;

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

    form.addEventListener('submit', (e: SubmitEvent) => {
        e.preventDefault();
        if (!validate(true)) return; // Pass true to show all errors on submit attempt

        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
        const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--card').trim();
        const foregroundColor = getComputedStyle(document.documentElement).getPropertyValue('--card-foreground').trim();

        Swal.fire({
            ...swalConfig,
            background: backgroundColor,
            color: foregroundColor,
            confirmButtonColor: primaryColor,
        }).then(() => {
            toggleModal(false);
            form.reset();
            clear();
            validate();
            if (onSuccess) onSuccess();
        });
    });

    // --- Initial State ---
    load();
    validate();
}