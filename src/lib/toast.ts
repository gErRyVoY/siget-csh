/**
 * Sistema de Toasts Personalizado
 * Librería ligera y configurable para notificaciones toast
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

export interface ToastOptions {
    message: string;
    type?: ToastType;
    duration?: number;
    position?: ToastPosition;
    closeable?: boolean;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export interface ToastConfig {
    defaultDuration: number;
    defaultPosition: ToastPosition;
    maxToasts: number;
    colors: {
        success: string;
        error: string;
        warning: string;
        info: string;
    };
    icons: {
        success: string;
        error: string;
        warning: string;
        info: string;
        close: string;
    };
}

class ToastManager {
    private container: HTMLElement | null = null;
    private toasts: Set<HTMLElement> = new Set();
    private config: ToastConfig;

    constructor(config?: Partial<ToastConfig>) {
        this.config = {
            defaultDuration: 4000,
            defaultPosition: 'top-right',
            maxToasts: 5,
            colors: {
                success: '#caab55',
                error: '#881912',
                warning: '#881912',
                info: '#797979',
            },
            icons: {
                success: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
                error: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
                warning: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
                info: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
                close: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
            },
            ...config,
        };
    }

    public updateConfig(config: Partial<ToastConfig>): void {
        this.config = { ...this.config, ...config };
    }

    private initContainer(position: ToastPosition): void {
        if (this.container) {
            const currentPosition = this.container.dataset.position;
            if (currentPosition !== position) {
                this.container.dataset.position = position;
                this.updateContainerPosition(position);
            }
            return;
        }

        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.dataset.position = position;
        this.container.setAttribute('aria-live', 'polite');
        this.container.setAttribute('aria-atomic', 'true');
        this.updateContainerPosition(position);
        document.body.appendChild(this.container);
    }

    private updateContainerPosition(position: ToastPosition): void {
        if (!this.container) return;

        this.container.style.top = '';
        this.container.style.bottom = '';
        this.container.style.left = '';
        this.container.style.right = '';
        this.container.style.transform = '';

        switch (position) {
            case 'top-right':
                this.container.style.top = '16px';
                this.container.style.right = '16px';
                break;
            case 'top-left':
                this.container.style.top = '16px';
                this.container.style.left = '16px';
                break;
            case 'bottom-right':
                this.container.style.bottom = '16px';
                this.container.style.right = '16px';
                break;
            case 'bottom-left':
                this.container.style.bottom = '16px';
                this.container.style.left = '16px';
                break;
            case 'top-center':
                this.container.style.top = '16px';
                this.container.style.left = '50%';
                this.container.style.transform = 'translateX(-50%)';
                break;
            case 'bottom-center':
                this.container.style.bottom = '16px';
                this.container.style.left = '50%';
                this.container.style.transform = 'translateX(-50%)';
                break;
        }
    }

    private createToast(options: ToastOptions): HTMLElement {
        const {
            message,
            type = 'info',
            closeable = true,
            action,
        } = options;

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('role', 'alert');
        toast.dataset.type = type;

        const color = this.config.colors[type];
        const icon = this.config.icons[type];

        toast.innerHTML = `
      <div class="toast-icon" style="color: ${color};">
        ${icon}
      </div>
      <div class="toast-content">
        <div class="toast-message">${this.escapeHtml(message)}</div>
        ${action ? `<button class="toast-action">${this.escapeHtml(action.label)}</button>` : ''}
      </div>
      ${closeable ? `<button class="toast-close" aria-label="Cerrar">${this.config.icons.close}</button>` : ''}
    `;

        if (closeable) {
            const closeBtn = toast.querySelector('.toast-close');
            closeBtn?.addEventListener('click', () => this.removeToast(toast));
        }

        if (action) {
            const actionBtn = toast.querySelector('.toast-action');
            actionBtn?.addEventListener('click', () => {
                action.onClick();
                this.removeToast(toast);
            });
        }

        return toast;
    }

    public show(options: ToastOptions): void {
        const position = options.position || this.config.defaultPosition;
        const duration = options.duration ?? this.config.defaultDuration;

        this.initContainer(position);

        if (this.toasts.size >= this.config.maxToasts) {
            const oldestToast = Array.from(this.toasts)[0];
            this.removeToast(oldestToast);
        }

        const toast = this.createToast(options);
        this.toasts.add(toast);
        this.container?.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('toast-show');
        });

        if (duration > 0) {
            setTimeout(() => {
                this.removeToast(toast);
            }, duration);
        }
    }

    private removeToast(toast: HTMLElement): void {
        if (!this.toasts.has(toast)) return;

        toast.classList.remove('toast-show');
        toast.classList.add('toast-hide');

        setTimeout(() => {
            toast.remove();
            this.toasts.delete(toast);

            if (this.toasts.size === 0 && this.container) {
                this.container.remove();
                this.container = null;
            }
        }, 300);
    }

    public success(message: string, options?: Partial<ToastOptions>): void {
        this.show({ ...options, message, type: 'success' });
    }

    public error(message: string, options?: Partial<ToastOptions>): void {
        this.show({ ...options, message, type: 'error' });
    }

    public warning(message: string, options?: Partial<ToastOptions>): void {
        this.show({ ...options, message, type: 'warning' });
    }

    public info(message: string, options?: Partial<ToastOptions>): void {
        this.show({ ...options, message, type: 'info' });
    }

    public clear(): void {
        this.toasts.forEach(toast => this.removeToast(toast));
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export const toast = new ToastManager();

if (typeof window !== 'undefined') {
    (window as any).toast = toast;
}
