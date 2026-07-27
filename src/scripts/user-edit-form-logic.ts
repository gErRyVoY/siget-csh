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
            // La sección de horario no está disponible para este rol (ej. Superadmin). Es normal.
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

        // Si es de solo consulta (Admin), deshabilitar selects y ocultar botón reset
        if (container.dataset.readonly === 'true') {
            const selects = container.querySelectorAll('select');
            selects.forEach(s => (s as HTMLSelectElement).disabled = true);
            const resetBtn = document.getElementById('reset-horario-btn');
            if (resetBtn) resetBtn.style.display = 'none';
        } else {
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
    }

    // --- INTERACCIONES DINÁMICAS ENTRE TOGGLES Y SECCIONES ---
    function initToggleListeners() {
        const rolSelect = document.getElementById('rolId') as HTMLSelectElement | null;
        const getSelectedRoleId = () => rolSelect ? parseInt(rolSelect.value, 10) : parseInt(form.dataset.originalRolId || '0', 10);

        // Mapeo de IDs de sección
        const SEC_CREAR_CSH = 1;
        const SEC_TRASLADO = 2;
        const SEC_CREAR_MKT = 3;
        const SEC_SOPORTE_MIS_TKTS = 4;
        const SEC_SOPORTE_DASHBOARD = 5;
        const SEC_SOPORTE_TODOS = 6;
        const SEC_MKT_MIS_TKTS = 7;
        const SEC_MKT_DASHBOARD = 8;
        const SEC_MKT_TODOS = 9;

        function setSectionChecked(secId: number, checked: boolean) {
            const input = document.getElementById(`sec-${secId}`) as HTMLInputElement | null;
            if (input && input.checked !== checked) {
                input.checked = checked;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        // Sincronización principal según el rol seleccionado
        function syncTogglesAndSections(changedSource: string) {
            const roleId = getSelectedRoleId();
            const tcktCsh = (document.getElementById('tckt_csh') as HTMLInputElement | null)?.checked ?? false;
            const tcktMkt = (document.getElementById('tckt_mkt') as HTMLInputElement | null)?.checked ?? false;
            const atiendeCsh = (document.getElementById('atiende_csh') as HTMLInputElement | null)?.checked ?? false;
            const atiendeMkt = (document.getElementById('atiende_mkt') as HTMLInputElement | null)?.checked ?? false;

            if (roleId === 1) {
                // ROL USUARIO
                if (changedSource === 'tckt_csh') {
                    setSectionChecked(SEC_CREAR_CSH, tcktCsh);
                    setSectionChecked(SEC_SOPORTE_DASHBOARD, tcktCsh);
                    setSectionChecked(SEC_SOPORTE_MIS_TKTS, tcktCsh);
                }
                if (changedSource === 'tckt_mkt') {
                    setSectionChecked(SEC_CREAR_MKT, tcktMkt);
                    setSectionChecked(SEC_MKT_DASHBOARD, tcktMkt);
                }
            } else if (roleId === 2 || roleId === 3) {
                // ROL ADMIN / SUPERADMIN
                if (changedSource === 'atiende_csh') {
                    if (atiendeCsh) {
                        setSectionChecked(SEC_CREAR_CSH, true);
                        setSectionChecked(SEC_CREAR_MKT, true);
                        setSectionChecked(SEC_TRASLADO, true);
                        setSectionChecked(SEC_SOPORTE_DASHBOARD, true);
                        setSectionChecked(SEC_SOPORTE_MIS_TKTS, true);
                        setSectionChecked(SEC_SOPORTE_TODOS, true);
                        setSectionChecked(SEC_MKT_DASHBOARD, true);
                        setSectionChecked(SEC_MKT_MIS_TKTS, true);
                        if (atiendeMkt) {
                            setSectionChecked(SEC_MKT_TODOS, true);
                        }
                    } else {
                        setSectionChecked(SEC_SOPORTE_TODOS, false);
                    }
                }

                if (changedSource === 'atiende_mkt') {
                    if (atiendeMkt) {
                        setSectionChecked(SEC_CREAR_CSH, true);
                        setSectionChecked(SEC_CREAR_MKT, true);
                        setSectionChecked(SEC_TRASLADO, true);
                        setSectionChecked(SEC_MKT_DASHBOARD, true);
                        setSectionChecked(SEC_MKT_MIS_TKTS, true);
                        setSectionChecked(SEC_MKT_TODOS, true);
                        setSectionChecked(SEC_SOPORTE_DASHBOARD, true);
                        setSectionChecked(SEC_SOPORTE_MIS_TKTS, true);
                        if (atiendeCsh) {
                            setSectionChecked(SEC_SOPORTE_TODOS, true);
                        }

                        // Sincronizar categoría Marketing (id=12)
                        const catMktInput = document.getElementById('cat-12') as HTMLInputElement | null;
                        if (catMktInput && !catMktInput.checked) {
                            catMktInput.checked = true;
                            catMktInput.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    } else {
                        setSectionChecked(SEC_MKT_TODOS, false);

                        // Desactivar categoría Marketing (id=12)
                        const catMktInput = document.getElementById('cat-12') as HTMLInputElement | null;
                        if (catMktInput && catMktInput.checked) {
                            catMktInput.checked = false;
                            catMktInput.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                }

                if (changedSource === 'tckt_csh') {
                    setSectionChecked(SEC_SOPORTE_DASHBOARD, tcktCsh || atiendeCsh);
                    setSectionChecked(SEC_SOPORTE_MIS_TKTS, tcktCsh || atiendeCsh);
                }

                if (changedSource === 'tckt_mkt') {
                    setSectionChecked(SEC_MKT_DASHBOARD, tcktMkt || atiendeMkt);
                    setSectionChecked(SEC_MKT_MIS_TKTS, tcktMkt || atiendeMkt);
                }
            }
        }

        // Toggle: Activo -> Apagar los demás al desmarcar
        const activoInput = document.getElementById('activo') as HTMLInputElement | null;
        if (activoInput) {
            activoInput.addEventListener('change', () => {
                if (!activoInput.checked) {
                    const togglesToTurnOff = [
                        'acepta_tickets',
                        'tckt_csh',
                        'tckt_mkt',
                        'atiende_csh',
                        'atiende_mkt',
                        'auditor_docs',
                        'auditor_req'
                    ];
                    togglesToTurnOff.forEach(id => {
                        const input = document.getElementById(id) as HTMLInputElement | null;
                        if (input && input.checked) {
                            input.checked = false;
                        }
                    });
                }
            });
        }

        // Listeners para toggles
        ['tckt_csh', 'tckt_mkt', 'atiende_csh', 'atiende_mkt'].forEach(toggleId => {
            const input = document.getElementById(toggleId) as HTMLInputElement | null;
            if (input) {
                input.addEventListener('change', () => {
                    syncTogglesAndSections(toggleId);
                });
            }
        });
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
                overlay.style.display = 'flex';
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

            const rawEmpresaId = formData.get('empresaId');
            const rawRolId = formData.get('rolId');

            const data: Record<string, any> = {
                id: userId,
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

            if (rawEmpresaId && !isNaN(parseInt(rawEmpresaId as string, 10))) {
                data.empresaId = parseInt(rawEmpresaId as string, 10);
            }
            if (rawRolId && !isNaN(parseInt(rawRolId as string, 10))) {
                data.rolId = parseInt(rawRolId as string, 10);
            }

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

                toast.success('Usuario actualizado correctamente');
                setTimeout(() => {
                    window.location.assign(window.location.pathname);
                }, 800);

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
    initToggleListeners();
    initFormSubmit();
    initBackButton();
}
