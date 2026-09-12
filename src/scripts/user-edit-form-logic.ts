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

        html += `
            <div class="col-span-full flex justify-center mt-4">
                <button
                    type="button"
                    id="reset-horario-btn"
                    class="bg-muted text-muted-foreground hover:bg-muted/80 px-6 py-2 rounded-md text-sm font-semibold transition-colors cursor-pointer"
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

        if (container.dataset.readonly === 'true') {
            const selects = container.querySelectorAll('select');
            selects.forEach(s => (s as HTMLSelectElement).disabled = true);
            const resetBtn = document.getElementById('reset-horario-btn');
            if (resetBtn) resetBtn.style.display = 'none';
        } else {
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
                    evaluateDirtyState();
                });
            }
        }
    }

    // --- VISIBILIDAD REACTIVA SEGÚN EL <select> DE ROL ---
    // La vista pinta la UNIÓN de los bloques configurables y cada uno declara en
    // `data-roles` los roles que lo habilitan (ver el frontmatter de
    // /admin/usuarios/editar/[id].astro). Antes la visibilidad se resolvía sólo en
    // el servidor con el rol guardado, así que para configurar los permisos de un
    // rol nuevo había que cambiar el rol, guardar y volver a entrar.
    const originalRolId = parseInt(form.dataset.originalRolId || '0', 10);

    // Los toggles de secciones y categorías guardan al instante contra sus propios
    // endpoints, pero guardar el formulario con otro rol borra TODAS las
    // excepciones del usuario (el $transaction de /api/admin/usuarios purga
    // `permisoUsuarioSeccion` y `asignacionesCategorias` cuando cambia el rolId).
    // Mientras el <select> no coincida con el rol guardado esos toggles quedan
    // bloqueados: lo que se configurara ahí se perdería en el guardado.
    let permisosBloqueadosPorRol = false;

    function isVisibleForRole(el: HTMLElement): boolean {
        return el.closest('[data-rol-hidden="true"]') === null;
    }

    function applyRoleVisibility(roleId: number) {
        form.querySelectorAll<HTMLElement>('[data-roles]').forEach(el => {
            const roles = (el.dataset.roles || '')
                .split(',')
                .map(r => parseInt(r.trim(), 10))
                .filter(n => !isNaN(n));
            el.dataset.rolHidden = roles.includes(roleId) ? 'false' : 'true';
        });
    }

    function applyPendingRoleLock(roleId: number) {
        permisosBloqueadosPorRol = roleId !== originalRolId;

        form.querySelectorAll<HTMLInputElement>('.section-toggle, .category-toggle').forEach(input => {
            // `rolLockBase` conserva el `disabled` que puso el servidor (canEdit /
            // canEditCategorias) para no habilitar de más al desbloquear.
            if (input.dataset.rolLockBase === undefined) {
                input.dataset.rolLockBase = input.disabled ? 'true' : 'false';
            }
            input.disabled = input.dataset.rolLockBase === 'true' ? true : permisosBloqueadosPorRol;
        });

        form.querySelectorAll<HTMLElement>('.rol-pendiente-aviso').forEach(aviso => {
            aviso.dataset.rolHidden = permisosBloqueadosPorRol ? 'false' : 'true';
        });
    }

    // --- INTERACCIONES DINÁMICAS ENTRE TOGGLES Y SECCIONES ---
    function initToggleListeners() {
        const rolSelect = document.getElementById('rolId') as HTMLSelectElement | null;
        const getSelectedRoleId = () => rolSelect ? parseInt(rolSelect.value, 10) : parseInt(form.dataset.originalRolId || '0', 10);

        const SEC_CREAR_CSH = 1;
        const SEC_TRASLADO = 2;
        const SEC_CREAR_MKT = 3;
        const SEC_SOPORTE_MIS_TKTS = 4;
        const SEC_SOPORTE_DASHBOARD = 5;
        const SEC_SOPORTE_TODOS = 6;
        const SEC_MKT_MIS_TKTS = 7;
        const SEC_MKT_DASHBOARD = 8;
        const SEC_MKT_TODOS = 9;

        function setSectionChecked(secId: number, checked: boolean, silent = false) {
            // Con un cambio de rol pendiente, el PATCH que dispara este cambio
            // moriría en el purgado de excepciones del guardado.
            if (permisosBloqueadosPorRol) return;
            const input = document.getElementById(`sec-${secId}`) as HTMLInputElement | null;
            if (input && input.checked !== checked) {
                input.checked = checked;
                input.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { silent } }));
            }
        }

        function setCategoryChecked(catId: number, checked: boolean) {
            // Mismo motivo que en `setSectionChecked`.
            if (permisosBloqueadosPorRol) return;
            const input = document.getElementById(`cat-${catId}`) as HTMLInputElement | null;
            if (input && input.checked !== checked) {
                input.checked = checked;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        function syncTogglesAndSections(changedSource: string) {
            const roleId = getSelectedRoleId();
            const tcktCsh = (document.getElementById('tckt_csh') as HTMLInputElement | null)?.checked ?? false;
            const tcktMkt = (document.getElementById('tckt_mkt') as HTMLInputElement | null)?.checked ?? false;
            const atiendeCsh = (document.getElementById('atiende_csh') as HTMLInputElement | null)?.checked ?? false;
            const atiendeMkt = (document.getElementById('atiende_mkt') as HTMLInputElement | null)?.checked ?? false;

            if (roleId === 1) {
                // ROL USUARIO
                if (changedSource === 'tckt_csh') {
                    setSectionChecked(SEC_CREAR_CSH, tcktCsh, true);
                    setSectionChecked(SEC_SOPORTE_DASHBOARD, tcktCsh, true);
                    setSectionChecked(SEC_SOPORTE_MIS_TKTS, tcktCsh, true);
                    toast.success(tcktCsh ? 'Levanta CSH activado: secciones CSH habilitadas' : 'Levanta CSH desactivado: secciones CSH deshabilitadas');
                }
                if (changedSource === 'tckt_mkt') {
                    setSectionChecked(SEC_CREAR_MKT, tcktMkt, true);
                    setSectionChecked(SEC_MKT_DASHBOARD, tcktMkt, true);
                    setSectionChecked(SEC_MKT_MIS_TKTS, tcktMkt, true);
                    toast.success(tcktMkt ? 'Levanta Mkt activado: secciones Marketing habilitadas' : 'Levanta Mkt desactivado: secciones Marketing deshabilitadas');
                }
            } else if (roleId === 2 || roleId === 3) {
                // ROL ADMIN / SUPERADMIN
                const isSuper = roleId === 3;
                const effectiveLevantaCsh = isSuper || tcktCsh;
                const effectiveLevantaMkt = isSuper || tcktMkt;

                if (changedSource === 'atiende_csh') {
                    if (atiendeCsh) {
                        setSectionChecked(SEC_TRASLADO, true, true);
                        setSectionChecked(SEC_SOPORTE_DASHBOARD, true, true);
                        setSectionChecked(SEC_SOPORTE_MIS_TKTS, true, true);
                        setSectionChecked(SEC_SOPORTE_TODOS, true, true);
                        if (atiendeMkt) {
                            setSectionChecked(SEC_MKT_TODOS, true, true);
                        }
                    } else {
                        setSectionChecked(SEC_SOPORTE_TODOS, false, true);
                        if (!effectiveLevantaCsh) {
                            setSectionChecked(SEC_SOPORTE_DASHBOARD, false, true);
                            setSectionChecked(SEC_SOPORTE_MIS_TKTS, false, true);
                        }
                    }
                }

                if (changedSource === 'atiende_mkt') {
                    if (atiendeMkt) {
                        setSectionChecked(SEC_TRASLADO, true, true);
                        setSectionChecked(SEC_MKT_DASHBOARD, true, true);
                        setSectionChecked(SEC_MKT_MIS_TKTS, true, true);
                        setSectionChecked(SEC_MKT_TODOS, true, true);
                        if (atiendeCsh) {
                            setSectionChecked(SEC_SOPORTE_TODOS, true, true);
                        }

                        setCategoryChecked(12, true);
                    } else {
                        setSectionChecked(SEC_MKT_TODOS, false, true);
                        if (!effectiveLevantaMkt) {
                            setSectionChecked(SEC_MKT_DASHBOARD, false, true);
                            setSectionChecked(SEC_MKT_MIS_TKTS, false, true);
                        }

                        setCategoryChecked(12, false);
                    }
                }

                if (changedSource === 'tckt_csh') {
                    setSectionChecked(SEC_SOPORTE_DASHBOARD, effectiveLevantaCsh || atiendeCsh, true);
                    setSectionChecked(SEC_SOPORTE_MIS_TKTS, effectiveLevantaCsh || atiendeCsh, true);
                }

                if (changedSource === 'tckt_mkt') {
                    setSectionChecked(SEC_MKT_DASHBOARD, effectiveLevantaMkt || atiendeMkt, true);
                    setSectionChecked(SEC_MKT_MIS_TKTS, effectiveLevantaMkt || atiendeMkt, true);
                }

                setSectionChecked(SEC_CREAR_CSH, effectiveLevantaCsh || atiendeCsh, true);
                setSectionChecked(SEC_CREAR_MKT, effectiveLevantaMkt || atiendeMkt, true);
            }

            evaluateDirtyState();
        }

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
                evaluateDirtyState();
            });
        }

        ['tckt_csh', 'tckt_mkt', 'atiende_csh', 'atiende_mkt', 'acepta_tickets', 'auditor_docs', 'auditor_req'].forEach(toggleId => {
            const input = document.getElementById(toggleId) as HTMLInputElement | null;
            if (input) {
                input.addEventListener('change', () => {
                    syncTogglesAndSections(toggleId);
                });
            }
        });

        // Estado inicial: el servidor ya pintó la visibilidad del rol guardado, así
        // que esto sólo asegura que servidor y cliente parten del mismo sitio y deja
        // registrado el `disabled` base de los toggles de secciones/categorías.
        applyRoleVisibility(getSelectedRoleId());
        applyPendingRoleLock(getSelectedRoleId());

        if (rolSelect) {
            rolSelect.addEventListener('change', () => {
                const roleId = getSelectedRoleId();
                applyRoleVisibility(roleId);
                applyPendingRoleLock(roleId);
                syncTogglesAndSections('rolId');
            });
        }
    }

    // --- DIRTY TRACKING (ESTADO DE CAMBIOS) & MODAL DE CONFIRMACIÓN ---
    let isDirty = false;
    let activeInfoToast: { dismiss: () => void } | null = null;
    let pendingNavigationUrl: string | null = null;
    let pendingNavigationIsBack = false;

    function getFormSnapshot(): string {
        const snapshot: Record<string, any> = {};

        ['activo', 'acepta_tickets', 'tckt_csh', 'tckt_mkt', 'atiende_csh', 'atiende_mkt', 'auditor_docs', 'auditor_req'].forEach(name => {
            const input = document.getElementById(name) as HTMLInputElement | null;
            if (input) {
                snapshot[name] = input.checked;
            }
        });

        const empresaSelect = document.getElementById('empresaId') as HTMLSelectElement | null;
        if (empresaSelect) snapshot['empresaId'] = empresaSelect.value;

        const rolSelect = document.getElementById('rolId') as HTMLSelectElement | null;
        if (rolSelect) snapshot['rolId'] = rolSelect.value;

        dias.forEach(dia => {
            const normalizedDia = dia.normalize("NFD").replace(/[̀-ͯ]/g, "");
            const inicio = (document.getElementById(`${normalizedDia}-inicio`) as HTMLSelectElement | null)?.value;
            const fin = (document.getElementById(`${normalizedDia}-fin`) as HTMLSelectElement | null)?.value;
            if (inicio !== undefined) snapshot[`${normalizedDia}-inicio`] = inicio;
            if (fin !== undefined) snapshot[`${normalizedDia}-fin`] = fin;
        });

        return JSON.stringify(snapshot);
    }

    let initialSnapshot = getFormSnapshot();

    function evaluateDirtyState() {
        const currentSnapshot = getFormSnapshot();
        const nowDirty = currentSnapshot !== initialSnapshot;

        if (nowDirty !== isDirty) {
            isDirty = nowDirty;
            if (isDirty) {
                if (!activeInfoToast) {
                    activeInfoToast = toast.info('Tienes cambios pendientes por guardar.', {
                        duration: 0,
                        closeable: true,
                    });
                }
            } else {
                if (activeInfoToast) {
                    activeInfoToast.dismiss();
                    activeInfoToast = null;
                }
            }
        }
    }

    form.addEventListener('input', evaluateDirtyState);
    form.addEventListener('change', evaluateDirtyState);

    // Modal de confirmación
    const modal = document.getElementById('unsaved-changes-modal');
    const modalOverlay = document.getElementById('unsaved-modal-overlay');
    const btnCancelLeave = document.getElementById('cancel-leave-modal');
    const btnDiscardAndLeave = document.getElementById('confirm-discard-and-leave');
    const btnSaveAndLeave = document.getElementById('confirm-save-and-leave');

    function showUnsavedModal(url?: string | null, isBack: boolean = false) {
        pendingNavigationUrl = url || null;
        pendingNavigationIsBack = isBack;
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    function hideUnsavedModal() {
        pendingNavigationUrl = null;
        pendingNavigationIsBack = false;
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    if (btnCancelLeave) {
        btnCancelLeave.addEventListener('click', hideUnsavedModal);
    }
    if (modalOverlay) {
        modalOverlay.addEventListener('click', hideUnsavedModal);
    }

    if (btnDiscardAndLeave) {
        btnDiscardAndLeave.addEventListener('click', () => {
            isDirty = false;
            if (activeInfoToast) {
                activeInfoToast.dismiss();
                activeInfoToast = null;
            }
            const navUrl = pendingNavigationUrl;
            const isBack = pendingNavigationIsBack;
            hideUnsavedModal();

            if (isBack) {
                window.history.back();
            } else if (navUrl) {
                window.location.assign(navUrl);
            }
        });
    }

    async function performSave(): Promise<boolean> {
        const formData = new FormData(form);

        // El horario de esta vista es de sólo consulta —lo sincroniza la API de RH
        // al iniciar sesión— y los <select> deshabilitados no viajan en el FormData:
        // leerlos devolvía `null` para los seis días y la condición
        // `inicio !== 'No disponible'` los dejaba pasar, así que CADA guardado
        // escribía {lunes:{inicio:null,fin:null},…}. Eso dejaba al agente fuera del
        // filtro de horario de la asignación automática (`filterBySchedule` exige
        // `inicio`/`fin`), y ya le había pasado a cinco usuarios en la BD.
        // Ahora sólo se envía si de verdad se puede editar.
        const horarioContainer = document.getElementById('horarios-container');
        const horarioEditable = horarioContainer !== null
            && horarioContainer.dataset.readonly !== 'true'
            && isVisibleForRole(horarioContainer);

        const horarioData: Record<string, { inicio: string, fin: string }> = {};
        if (horarioEditable) {
            dias.forEach(dia => {
                const normalizedDia = dia.normalize("NFD").replace(/[̀-ͯ]/g, "");
                const inicio = formData.get(`${normalizedDia}-inicio`);
                const fin = formData.get(`${normalizedDia}-fin`);
                if (typeof inicio !== 'string' || typeof fin !== 'string') return;
                if (inicio !== 'No disponible' && fin !== 'No disponible') {
                    horarioData[normalizedDia] = { inicio, fin };
                }
            });
        }

        const rawEmpresaId = formData.get('empresaId');
        const rawRolId = formData.get('rolId');

        const data: Record<string, any> = { id: userId };
        if (horarioEditable) {
            data.horario_disponibilidad = Object.keys(horarioData).length > 0 ? horarioData : null;
        }

        // Solo incluir flags booleanos si el toggle está en el DOM Y visible para el
        // rol seleccionado. Un toggle oculto (ej: Levanta CSH/MKT para Superadmin)
        // no se envía, para no sobrescribir la BD con false. Con el <select> de Rol
        // reactivo el elemento existe siempre, así que lo que decide es la
        // visibilidad, no la presencia.
        const boolFields = [
            'activo', 'acepta_tickets', 'tckt_csh', 'tckt_mkt',
            'atiende_csh', 'atiende_mkt', 'auditor_docs', 'auditor_req'
        ] as const;
        boolFields.forEach(field => {
            const el = form.elements.namedItem(field) as HTMLInputElement | null;
            if (el !== null && isVisibleForRole(el)) {
                data[field] = el.checked;
            }
        });

        if (rawEmpresaId && !isNaN(parseInt(rawEmpresaId as string, 10))) {
            data.empresaId = parseInt(rawEmpresaId as string, 10);
        }
        if (rawRolId && !isNaN(parseInt(rawRolId as string, 10))) {
            data.rolId = parseInt(rawRolId as string, 10);
        }

        const response = await fetch(`/api/admin/usuarios`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Error al actualizar el usuario');
        }

        initialSnapshot = getFormSnapshot();
        isDirty = false;
        if (activeInfoToast) {
            activeInfoToast.dismiss();
            activeInfoToast = null;
        }

        return true;
    }

    if (btnSaveAndLeave) {
        btnSaveAndLeave.addEventListener('click', async () => {
            const originalText = btnSaveAndLeave.innerHTML;
            btnSaveAndLeave.innerHTML = 'Guardando...';
            (btnSaveAndLeave as HTMLButtonElement).disabled = true;

            const overlay = document.getElementById('page-loading-overlay');
            if (overlay) overlay.style.display = 'flex';

            try {
                await performSave();
                toast.success('Usuario actualizado correctamente');
                const navUrl = pendingNavigationUrl;
                const isBack = pendingNavigationIsBack;
                hideUnsavedModal();

                setTimeout(() => {
                    if (isBack) {
                        window.history.back();
                    } else if (navUrl) {
                        window.location.assign(navUrl);
                    } else {
                        window.location.assign(window.location.pathname);
                    }
                }, 500);
            } catch (error: any) {
                console.error('Save & leave error:', error);
                toast.error(error.message || 'Error al guardar los cambios');
                btnSaveAndLeave.innerHTML = originalText;
                (btnSaveAndLeave as HTMLButtonElement).disabled = false;
                if (overlay) overlay.style.display = 'none';
                hideUnsavedModal();
            }
        });
    }

    // Intercepción de navegación y salidas
    window.addEventListener('beforeunload', (e) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    document.addEventListener('click', (e) => {
        if (!isDirty) return;

        const target = e.target as HTMLElement;
        const link = target.closest('a') as HTMLAnchorElement | null;

        if (link && link.href) {
            if (link.target === '_blank' || link.href.startsWith('javascript:') || link.getAttribute('href') === '#') {
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            showUnsavedModal(link.href, false);
        }
    }, true);

    document.addEventListener('astro:before-preparation', (ev: any) => {
        if (isDirty) {
            ev.cancel();
            showUnsavedModal(ev.to?.href, false);
        }
    });

    window.addEventListener('popstate', () => {
        if (isDirty) {
            window.history.pushState(null, '', window.location.href);
            showUnsavedModal(null, true);
        }
    });

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

            try {
                await performSave();
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
            backButton.addEventListener('click', (e) => {
                if (isDirty) {
                    e.preventDefault();
                    e.stopPropagation();
                    showUnsavedModal(null, true);
                } else {
                    window.history.back();
                }
            });
        }
    }

    initHorarios();
    // `initHorarios` inserta los <select> del horario, que no existían cuando se
    // tomó el primer snapshot: sin recalcularlo, el primer cambio en cualquier
    // campo se comparaba contra un snapshot sin horario y el formulario se marcaba
    // como sucio de más.
    initialSnapshot = getFormSnapshot();
    initToggleListeners();
    initFormSubmit();
    initBackButton();
}
