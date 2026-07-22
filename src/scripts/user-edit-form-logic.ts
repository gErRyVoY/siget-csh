import { toast } from '@/lib/toast';

export function initializeUserEditForm() {
    const form = document.getElementById('edit-user-form') as HTMLFormElement;
    if (!form) {
        console.error('Form with id \'edit-user-form\' not found.');
        return;
    }

    const userId = parseInt(form.dataset.userId || '0', 10);
    const horarioString = form.dataset.horario;

    if (isNaN(userId) || typeof horarioString === 'undefined') {
        console.error('User ID or horario data is missing from form data attributes.');
        return;
    }

    const horario = JSON.parse(horarioString);
    const dias = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

    function generarOpciones(inicio: number, fin: number, intervalo: number): string {
        let opciones = '';
        for (let h = inicio; h <= fin; h++) {
            for (let m = 0; m < 60; m += intervalo) {
                if (h === fin && m > 0) continue;
                const hora = h.toString().padStart(2, '0');
                const minuto = m.toString().padStart(2, '0');
                opciones += `<option value="${hora}:${minuto}">${hora}:${minuto}</option>`;
            }
        }
        return opciones;
    }

    const opcionesInicio = generarOpciones(7, 12, 30);
    const opcionesFin = generarOpciones(13, 20, 30);

    function initHorarios() {
        const container = document.getElementById('horarios-container');
        if (!container) {
            console.error('Could not find a container with id \'horarios-container\'.');
            return;
        }

        let html = dias.map(dia => {
            const normalizedDia = dia.normalize("NFD").replace(/[̀-ͯ]/g, "");
            return `
                <div class="space-y-1">
                    <label class="block text-sm font-medium capitalize">${dia}</label>
                    <div class="flex items-center gap-2">
                        <select id="${normalizedDia}-inicio" name="${normalizedDia}-inicio" class="mt-1 block w-full rounded-md border-border bg-input p-2 accent-secondary focus:outline-none focus:ring-1 focus:ring-secondary">
                            <option value="No disponible">No disponible</option>
                            ${opcionesInicio}
                        </select>
                        <span>-</span>
                        <select id="${normalizedDia}-fin" name="${normalizedDia}-fin" class="mt-1 block w-full rounded-md border-border bg-input p-2 accent-secondary focus:outline-none focus:ring-1 focus:ring-secondary">
                            <option value="No disponible">No disponible</option>
                            ${opcionesFin}
                        </select>
                    </div>
                </div>
            `;
        }).join('');

        // Añadir botón para resetear horario al final en una fila sola y centrada
        html += `
            <div class="col-span-full flex justify-center mt-4">
                <button
                    type="button"
                    id="reset-horario-btn"
                    class="bg-muted text-muted-foreground hover:bg-muted/80 px-6 py-2 rounded-md text-sm font-semibold transition-colors"
                >
                    Resetear horario
                </button>
            </div>
        `;

        container.innerHTML = html;

        dias.forEach(dia => {
            const normalizedDia = dia.normalize("NFD").replace(/[̀-ͯ]/g, "");
            const horarioDia = horario && horario[normalizedDia] ? horario[normalizedDia] : { inicio: 'No disponible', fin: 'No disponible' };
            const inicioSelect = document.getElementById(`${normalizedDia}-inicio`) as HTMLSelectElement;
            const finSelect = document.getElementById(`${normalizedDia}-fin`) as HTMLSelectElement;
            if (inicioSelect) inicioSelect.value = horarioDia.inicio;
            if (finSelect) finSelect.value = horarioDia.fin;
        });

        // Event listener para el botón de resetear horario
        const resetBtn = document.getElementById('reset-horario-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                dias.forEach(dia => {
                    const normalizedDia = dia.normalize("NFD").replace(/[̀-ͯ]/g, "");
                    const inicioSelect = document.getElementById(`${normalizedDia}-inicio`) as HTMLSelectElement;
                    const finSelect = document.getElementById(`${normalizedDia}-fin`) as HTMLSelectElement;
                    if (inicioSelect) inicioSelect.value = 'No disponible';
                    if (finSelect) finSelect.value = 'No disponible';
                });
                toast.success('Horario reseteado en la vista. Recuerda guardar los cambios.');
            });
        }
    }

    function initFormSubmit() {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
            const originalText = submitBtn ? submitBtn.textContent : 'Guardar cambios';

            if (submitBtn) {
                submitBtn.textContent = 'Guardando...';
                submitBtn.disabled = true;
            }

            const overlay = document.getElementById('page-loading-overlay');
            if (overlay) {
                overlay.style.display = 'block';
            }

            const formData = new FormData(form);
            const horarioData: Record<string, { inicio: FormDataEntryValue | null, fin: FormDataEntryValue | null }> = {};

            dias.forEach(dia => {
                const normalizedDia = dia.normalize("NFD").replace(/[̀-ͯ]/g, "");
                const inicio = formData.get(`${normalizedDia}-inicio`);
                const fin = formData.get(`${normalizedDia}-fin`);
                if (inicio !== 'No disponible' && fin !== 'No disponible') {
                    horarioData[normalizedDia] = { inicio, fin };
                }
            });

            const data = {
                id: userId,
                empresaId: parseInt(formData.get('empresaId') as string),
                rolId: parseInt(formData.get('rolId') as string),
                clave: formData.get('clave') as string,
                alias: formData.get('alias') as string,
                puesto: formData.get('puesto') as string,
                activo: (form.elements.namedItem('activo') as HTMLInputElement)?.checked ?? false,
                acepta_tickets: (form.elements.namedItem('acepta_tickets') as HTMLInputElement)?.checked ?? false,
                tckt_csh: (form.elements.namedItem('tckt_csh') as HTMLInputElement)?.checked ?? false,
                tckt_mkt: (form.elements.namedItem('tckt_mkt') as HTMLInputElement)?.checked ?? false,
                atiende_csh: (form.elements.namedItem('atiende_csh') as HTMLInputElement)?.checked ?? false,
                atiende_mkt: (form.elements.namedItem('atiende_mkt') as HTMLInputElement)?.checked ?? false,
                auditor_docs: (form.elements.namedItem('auditor_docs') as HTMLInputElement)?.checked ?? false,
                auditor_req: (form.elements.namedItem('auditor_req') as HTMLInputElement)?.checked ?? false,
                horario_disponibilidad: Object.keys(horarioData).length > 0 ? horarioData : null,
            };


            try {
                const response = await fetch(`/api/admin/usuarios`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}))
                    throw new Error(errorData.message || 'Error al actualizar el usuario');
                }

                const originalRolIdText = form.dataset.originalRolId;
                const originalClave = form.dataset.originalClave || "";
                const claveCambiada = data.clave !== originalClave;

                if ((originalRolIdText && data.rolId !== parseInt(originalRolIdText, 10)) || claveCambiada) {
                    if (claveCambiada) {
                        toast.success('Usuario actualizado. Sincronizando horario...', {
                            duration: 3000
                        });
                        // Actualizar la clave original en el dataset para futuros submits
                        form.dataset.originalClave = data.clave;
                    } else {
                        toast.success('Rol modificado. Recargando permisos para aplicar exclusiones...', {
                            duration: 3000
                        });
                    }
                    setTimeout(async () => {
                        const { navigate } = await import('astro:transitions/client');
                        navigate(window.location.pathname);
                    }, 1500);
                } else {
                    toast.success('Usuario actualizado correctamente');
                    if (submitBtn) {
                        submitBtn.textContent = originalText;
                        submitBtn.disabled = false;
                    }
                    if (overlay) {
                        overlay.style.display = 'none';
                    }
                }

            } catch (error: any) {
                console.error('Submit error:', error);
                toast.error(error.message || 'Error al actualizar el usuario');
                if (submitBtn) {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }
                if (overlay) {
                    overlay.style.display = 'none';
                }
            }
        });
    }

    function initBackButton() {
        const backButton = document.getElementById('back-button');
        if (backButton) {
            backButton.addEventListener('click', () => {
                window.history.back();
            });
        }
    }

    initHorarios();
    initFormSubmit();
    initBackButton();
}
