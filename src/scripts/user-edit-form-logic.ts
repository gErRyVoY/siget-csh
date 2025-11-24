declare const Swal: any;

export function initializeUserEditForm() {
    const form = document.getElementById('edit-user-form') as HTMLFormElement;
    if (!form) {
        console.error('Form with id \'edit-user-form\' not found.');
        return;
    }

    const userId = parseInt(form.dataset.userId, 10);
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

        container.innerHTML = dias.map(dia => {
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

        dias.forEach(dia => {
            const normalizedDia = dia.normalize("NFD").replace(/[̀-ͯ]/g, "");
            const horarioDia = horario && horario[normalizedDia] ? horario[normalizedDia] : { inicio: 'No disponible', fin: 'No disponible' };
            const inicioSelect = document.getElementById(`${normalizedDia}-inicio`) as HTMLSelectElement;
            const finSelect = document.getElementById(`${normalizedDia}-fin`) as HTMLSelectElement;
            if(inicioSelect) inicioSelect.value = horarioDia.inicio;
            if(finSelect) finSelect.value = horarioDia.fin;
        });
    }

    function initFormSubmit() {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const horarioData = {};

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
                activo: (form.elements.namedItem('activo') as HTMLInputElement).checked,
                vacaciones: (form.elements.namedItem('vacaciones') as HTMLInputElement).checked,
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

                const Toast = Swal.mixin({
                    toast: true,
                    position: 'bottom',
                    showConfirmButton: false,
                    timer: 3000,
                    timerProgressBar: true,
                    background: '#881912',
                    color: '#FFFFFF',
                    iconColor: '#caab55',
                    didOpen: (toast) => {
                        toast.addEventListener('mouseenter', Swal.stopTimer)
                        toast.addEventListener('mouseleave', Swal.resumeTimer)
                    }
                });

                Toast.fire({ icon: 'success', title: 'Usuario actualizado correctamente' });

            } catch (error) {
                console.error('Submit error:', error);
                Swal.fire({ title: 'Error', text: error.message, icon: 'error' });
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
