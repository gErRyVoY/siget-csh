import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { sendEmail, getHtmlWrapper } from "@/services/emailService";

// ─────────────────────────────────────────────
// Helpers de tiempo
// ─────────────────────────────────────────────
const formatTime = (t: string | null) => {
  if (!t) return "";
  if (t.length === 4) return `${t.substring(0, 2)}:${t.substring(2, 4)}`;
  return t;
};

const parseTime = (tStr: string | null) => {
  if (!tStr) return null;
  const clean = tStr.replace(":", "");
  if (clean.length === 4) {
    return {
      h: parseInt(clean.substring(0, 2), 10),
      m: parseInt(clean.substring(2, 4), 10),
    };
  }
  return null;
};

const parseHorarioTime = (tStr: string | null) => {
  if (!tStr || tStr === "No disponible") return null;
  const [h, m] = tStr.split(":");
  return { h: parseInt(h, 10), m: parseInt(m, 10) };
};

const timeDiffMins = (t1: any, t2: any) => t1.h * 60 + t1.m - (t2.h * 60 + t2.m);

// ─────────────────────────────────────────────
// Generador de tabla HTML para el correo (Bloques de 3 en 3 días)
// ─────────────────────────────────────────────
function buildCalendarTable(sortedTodos: any[], schedule: any, activeMap: Map<string, any>): { tableHtml: string; legendHtml: string } {
  const diasSemanaNorm = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

  if (sortedTodos.length === 0) return { tableHtml: "", legendHtml: "" };

  const CELL_W = "33.33%";
  const CELL_H = "90px";

  const colorMap: Record<string, string> = {
    ok: "#d1fae5",       // verde claro – a tiempo
    tarde: "#fee2e2",    // rojo claro – tardanza
    orange: "#ffedd5",   // naranja – 6-15 min
    inasist: "#f3f4f6",  // gris claro – inasistencia / evento / asueto
    especial: "#ede9fe", // morado claro – Homeoffice / Vacaciones
  };

  let hasAtiempo = false;
  let hasJustificar = false;
  let hasRetardo = false;
  const usedGris = new Set<string>();
  const usedMorado = new Set<string>();

  const datesMap = new Map<string, any>();
  sortedTodos.forEach((inc) => {
    const key = new Date(inc.fecha).toISOString().split("T")[0];
    datesMap.set(key, inc);
  });

  const getMonday = (d: Date) => {
    const dt = new Date(d.getTime());
    const day = dt.getUTCDay();
    const diff = dt.getUTCDate() - day + (day === 0 ? -6 : 1);
    dt.setUTCDate(diff);
    dt.setUTCHours(0, 0, 0, 0);
    return dt;
  };

  const mondayTimesSet = new Set<number>();
  sortedTodos.forEach((inc) => {
    const m = getMonday(new Date(inc.fecha));
    mondayTimesSet.add(m.getTime());
  });

  const sortedMondays = Array.from(mondayTimesSet).sort((a, b) => a - b).map((t) => new Date(t));
  const htmlBlocks: string[] = [];

  for (const monday of sortedMondays) {
    const weekDates: Date[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday.getTime());
      d.setUTCDate(d.getUTCDate() + i);
      weekDates.push(d);
    }

    const blocks = [
      { headers: ["Lun", "Mar", "Mié"], dates: weekDates.slice(0, 3) },
      { headers: ["Jue", "Vie", "Sáb"], dates: weekDates.slice(3, 6) },
    ];

    for (const blk of blocks) {
      const validDates = blk.dates.filter((d) => datesMap.has(d.toISOString().split("T")[0]));
      if (validDates.length === 0) continue;

      const headerHtml = blk.headers
        .map(
          (h) =>
            `<th style="width:${CELL_W};padding:6px 4px;background-color:#881912;color:#fff;font-family:'Segoe UI',sans-serif;font-size:11px;font-weight:700;text-align:center;border:1px solid #6b1010;">${h}</th>`
        )
        .join("");

      const cellsHtml = blk.dates
        .map((date) => {
          const dateStr = date.toISOString().split("T")[0];
          const inc = datesMap.get(dateStr);

          if (!inc) {
            return `<td style="width:${CELL_W};height:${CELL_H};border:1px solid #e5e7eb;background-color:#f9fafb;"></td>`;
          }

          const utcDay = date.getUTCDay();
          const dayNum = date.getUTCDate().toString().padStart(2, "0");
          const dayNameNorm = diasSemanaNorm[utcDay];
          const hDia = schedule[dayNameNorm];

          const activeInc = activeMap.get(dateStr);
          const isOmitida = activeInc ? activeInc.omitida : false;

          const rEnt = parseTime(inc.entrada_turno);
          const rSal = parseTime(inc.salida_turno);
          const hIni = hDia ? parseHorarioTime(hDia.inicio) : null;
          const hFin = hDia ? parseHorarioTime(hDia.fin) : null;

          const isAllNull =
            !inc.entrada_turno && !inc.salida_turno && !inc.entrada_comida && !inc.salida_comida;

          const obsVal = activeInc ? activeInc.observaciones : null;
          const isSpecialStr = obsVal && (["Homeoffice", "Vacaciones", "Asueto"].includes(obsVal) || obsVal.startsWith("Evento"));
          const specialLabel =
            isAllNull && isSpecialStr
              ? (obsVal.startsWith("Evento") ? "Evento" : (obsVal as string))
              : null;

          let bgColor = colorMap.ok;
          let statusLines: string[] = [];

          if (isOmitida) {
            bgColor = colorMap.ok;
            hasAtiempo = true;
            if (inc.entrada_turno) {
              statusLines.push(`<span style="color:#16a34a;font-weight:700;font-size:10px;">EL ${formatTime(inc.entrada_turno)}</span>`);
            }
            if (inc.entrada_comida) {
              statusLines.push(`<span style="color:#6b7280;font-size:9px;">SC ${formatTime(inc.entrada_comida)}</span>`);
            }
            if (inc.salida_comida) {
              statusLines.push(`<span style="color:#6b7280;font-size:9px;">RC ${formatTime(inc.salida_comida)}</span>`);
            }
            if (inc.salida_turno) {
              statusLines.push(`<span style="color:#16a34a;font-weight:700;font-size:10px;">SL ${formatTime(inc.salida_turno)}</span>`);
            }
          } else if (specialLabel) {
            if (specialLabel === "Homeoffice" || specialLabel === "Vacaciones") {
              bgColor = colorMap.especial;
              usedMorado.add(specialLabel);
              statusLines.push(`<span style="color:#7c3aed;font-size:10px;font-weight:700;">${specialLabel}</span>`);
            } else {
              bgColor = colorMap.inasist;
              usedGris.add(specialLabel);
              statusLines.push(`<span style="color:#6b7280;font-size:10px;font-weight:700;">${specialLabel}</span>`);
            }
          } else if (isAllNull) {
            bgColor = colorMap.inasist;
            usedGris.add("Inasistencia");
            statusLines.push(`<span style="color:#6b7280;font-size:10px;font-weight:600;">Inasistencia</span>`);
          } else {
            let dayHasProblem = false;
            if (inc.entrada_turno) {
              let elColor = "#374151";
              let elBg = bgColor;

              if (rEnt && hIni) {
                const diffEnt = timeDiffMins(rEnt, hIni);
                if (diffEnt < 0) {
                  elColor = "#16a34a";
                } else if (diffEnt > 15) {
                  elColor = "#dc2626";
                  elBg = colorMap.tarde;
                  hasJustificar = true;
                  dayHasProblem = true;
                } else if (diffEnt >= 6) {
                  elColor = "#ea580c";
                  elBg = colorMap.orange;
                  hasRetardo = true;
                  dayHasProblem = true;
                }
                if (elBg !== bgColor) bgColor = elBg;
              }
              statusLines.push(`<span style="color:${elColor};font-weight:700;font-size:10px;">EL ${formatTime(inc.entrada_turno)}</span>`);
            } else {
              statusLines.push(`<span style="color:#dc2626;font-size:9px;font-weight:700;">EL (-:--)</span>`);
              bgColor = colorMap.tarde;
              hasJustificar = true;
              dayHasProblem = true;
            }

            if (inc.entrada_comida) {
              statusLines.push(`<span style="color:#6b7280;font-size:9px;">SC ${formatTime(inc.entrada_comida)}</span>`);
            }
            if (inc.salida_comida) {
              statusLines.push(`<span style="color:#6b7280;font-size:9px;">RC ${formatTime(inc.salida_comida)}</span>`);
            }

            if (inc.salida_turno) {
              let slColor = "#374151";
              if (rSal && hFin) {
                const diffSal = timeDiffMins(rSal, hFin);
                if (diffSal > 5) slColor = "#16a34a";
                else if (diffSal < -5) {
                  // Salió antes de su hora: es tiempo pendiente, no un día en orden
                  slColor = "#dc2626";
                  bgColor = colorMap.tarde;
                  hasJustificar = true;
                  dayHasProblem = true;
                }
              }
              statusLines.push(`<span style="color:${slColor};font-weight:700;font-size:10px;">SL ${formatTime(inc.salida_turno)}</span>`);
            } else {
              statusLines.push(`<span style="color:#dc2626;font-size:9px;font-weight:700;">SL (-:--)</span>`);
              bgColor = colorMap.tarde;
              hasJustificar = true;
              dayHasProblem = true;
            }

            if (!dayHasProblem) {
              hasAtiempo = true;
            }
          }

          const watermarkNum = `<span style="position:absolute;top:2px;right:4px;font-size:22px;font-weight:900;color:rgba(0,0,0,0.18);line-height:1;pointer-events:none;">${dayNum}</span>`;
          const innerContent = statusLines.map((s) => `<div style="line-height:1.3;">${s}</div>`).join("");

          return (
            `<td style="position:relative;width:${CELL_W};height:${CELL_H};background-color:${bgColor};border:1px solid #d1d5db;padding:4px 5px;vertical-align:top;">` +
            watermarkNum +
            `<div style="margin-top:2px;">${innerContent}</div>` +
            `</td>`
          );
        })
        .join("");

      htmlBlocks.push(`
        <table style="border-collapse:collapse;width:100%;table-layout:fixed;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;margin-bottom:12px;">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody><tr>${cellsHtml}</tr></tbody>
        </table>
      `);
    }
  }

  const legendSpans: string[] = [];

  if (hasAtiempo) {
    legendSpans.push(
      `<span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:12px;height:12px;background-color:#d1fae5;border:1px solid #a7f3d0;border-radius:2px;"></span> A tiempo</span>`
    );
  }
  if (hasJustificar) {
    legendSpans.push(
      `<span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:12px;height:12px;background-color:#fee2e2;border:1px solid #fca5a5;border-radius:2px;"></span> Justificar</span>`
    );
  }
  if (hasRetardo) {
    legendSpans.push(
      `<span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:12px;height:12px;background-color:#ffedd5;border:1px solid #fdba74;border-radius:2px;"></span> Retardo</span>`
    );
  }
  usedGris.forEach((concept) => {
    legendSpans.push(
      `<span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:12px;height:12px;background-color:#f3f4f6;border:1px solid #d1d5db;border-radius:2px;"></span> ${concept}</span>`
    );
  });
  usedMorado.forEach((concept) => {
    legendSpans.push(
      `<span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:12px;height:12px;background-color:#ede9fe;border:1px solid #c4b5fd;border-radius:2px;"></span> ${concept}</span>`
    );
  });

  const legendHtml = `<div style="margin:10px 0 16px;font-family:'Segoe UI',sans-serif;font-size:11px;color:#6b7280;display:flex;flex-wrap:wrap;gap:8px;">${legendSpans.join("")}</div>`;

  return { tableHtml: htmlBlocks.join(""), legendHtml };
}

// Helper para calcular la semana del año
function getWeeksText(dates: Date[]): string {
  if (dates.length === 0) return "";
  const weeks = dates.map(d => {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  });
  const uniqueWeeks = Array.from(new Set(weeks)).sort((a, b) => a - b);
  if (uniqueWeeks.length === 1) {
    return `Semana #${uniqueWeeks[0]}`;
  }
  return `Semana #${uniqueWeeks[0]} a #${uniqueWeeks[uniqueWeeks.length - 1]}`;
}

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────
export const POST: APIRoute = async ({ request, locals }) => {
  const session = locals.session;
  if (!session || !session.user) {
    return new Response(JSON.stringify({ message: "No autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = Number(session.user.id);

  try {
    const { mes, anio, quincena, incidencias, todosLosRegistros } = await request.json();

    if (!mes || !anio || !Array.isArray(incidencias)) {
      return new Response(
        JSON.stringify({ message: "Faltan parámetros requeridos o formato incorrecto" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1. Guardar incidencias en la base de datos (tanto Enviar como Omitir)
    const dataToInsert = incidencias.map((inc: any) => ({
      usuarioId: userId,
      mes: Number(inc.mes),
      quincena: Number(inc.quincena),
      fecha: new Date(inc.fecha),
      entrada_turno: inc.entrada_turno || null,
      salida_turno: inc.salida_turno || null,
      tiempo_turno: inc.tiempo_turno !== undefined ? Number(inc.tiempo_turno) : null,
      observaciones: inc.observaciones || null,
      entrada_comida: inc.entrada_comida || null,
      salida_comida: inc.salida_comida || null,
      observaciones_comida: inc.observaciones_comida || null,
      imagen_reporte: null,
      omitida: !!inc.omitida,
    }));

    const fechas = dataToInsert.map((d) => d.fecha);
    await (prisma as any).incidencia.deleteMany({
      where: { usuarioId: userId, fecha: { in: fechas } },
    });
    await (prisma as any).incidencia.createMany({ data: dataToInsert });

    // 2. Destinatario fijo y datos del colaborador
    const VICTOR_EMAIL = "victor@humanitas.edu.mx";
    const VICTOR_NAME = "Ing. Víctor Barrera";

    const colaborador = await prisma.usuario.findUnique({ where: { id: userId } });
    if (!colaborador) throw new Error("No se encontró el colaborador actual en la base de datos.");

    const colaboradorName = `${colaborador.nombres} ${colaborador.apellidos}`;
    const schedule = (colaborador.horario_disponibilidad as any) || {};

    // 3. Texto del periodo
    const meses = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ];
    const mesName = meses[mes - 1] || "";
    const capitalizedMesName = mesName.charAt(0).toUpperCase() + mesName.slice(1);
    let periodText = "";
    if (quincena === 1) {
      periodText = `a la quincena 1 del mes de ${capitalizedMesName} de ${anio}`;
    } else if (quincena === 2) {
      periodText = `a la quincena 2 del mes de ${capitalizedMesName} de ${anio}`;
    } else {
      periodText = `al mes de ${capitalizedMesName} de ${anio}`;
    }

    // 4. Ordenar y filtrar todos los registros para la tabla calendario
    const filteredTodos = (todosLosRegistros || []).filter((r: any) => {
      const d = new Date(r.fecha);
      const dayNum = d.getUTCDate();
      if (quincena === 1) return dayNum <= 15;
      if (quincena === 2) return dayNum >= 16;
      return true;
    });
    const sortedTodos = [...filteredTodos].sort(
      (a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    );

    // Mapear incidencias de la carga actual para marcar omitidas en la tabla
    const activeMap = new Map<string, any>();
    for (const inc of dataToInsert) {
      const dateStr = inc.fecha.toISOString().split("T")[0];
      activeMap.set(dateStr, inc);
    }

    // 5. Lista textual de TODOS los días (nuevas reglas de formato)
    const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const diasSemanaNorm = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

    const savedMap = new Map<string, any>();
    for (const inc of dataToInsert) {
      savedMap.set(inc.fecha.toISOString().split("T")[0], inc);
    }

    const lines = sortedTodos.map((r: any) => {
      const date = new Date(r.fecha);
      const utcDay = date.getUTCDay();
      if (utcDay === 0) return null; // Ignorar domingos

      const dayName = diasSemana[utcDay];
      const dayNameNorm = diasSemanaNorm[utcDay];
      const dayNum = date.getUTCDate();
      const hDia = schedule[dayNameNorm];
      const dateStr = date.toISOString().split("T")[0];

      const saved = savedMap.get(dateStr);
      const isOmitida = saved ? saved.omitida : false;
      const isAllNull = !r.entrada_turno && !r.salida_turno && !r.entrada_comida && !r.salida_comida;

      const obsVal = saved ? saved.observaciones : null;
      const isSpecialStr = obsVal && (["Homeoffice", "Vacaciones", "Asueto"].includes(obsVal) || obsVal.startsWith("Evento"));
      const specialLabel = (isAllNull && isSpecialStr)
        ? (obsVal.startsWith("Evento") ? "Evento" : (obsVal as string))
        : null;

      const dayLabel = `<strong>${dayName} ${dayNum}.</strong>`;

      if (isOmitida) {
        return `${dayLabel} <span style="color:#16a34a;font-weight:normal;">Sin incidencias.</span>`;
      }

      if (specialLabel) {
        if (specialLabel === "Evento") {
          const motivoEvento = obsVal && obsVal.startsWith("Evento:") ? obsVal.replace(/^Evento:\s*/, "").trim() : (obsVal && obsVal !== "Evento" ? obsVal : null);
          if (motivoEvento) {
            return `${dayLabel} <strong style="color:#6b7280;">Evento.</strong> <strong style="color:#111827;">Motivo:</strong> ${motivoEvento}.`;
          }
          return `${dayLabel} <strong style="color:#6b7280;">Evento.</strong>`;
        }
        const isGrey = specialLabel === "Asueto";
        const spColor = isGrey ? "#6b7280" : "#7c3aed";
        return `${dayLabel} <strong style="color:${spColor};">${specialLabel}.</strong>`;
      }

      if (isAllNull && !specialLabel) {
        // Sin registro y sin tipo especial → verificar si hay alguna incidencia guardada
        const obsRaw = saved ? saved.observaciones : null;
        // Si hay un motivo real (no es la etiqueta "Inasistencia" literalmente), mostrarlo
        const hasRealObs = obsRaw && obsRaw !== "Inasistencia";
        if (hasRealObs) {
          return `${dayLabel} Inasistencia. <strong style="color:#111827;">Motivo:</strong> ${obsRaw}.`;
        }
        const label = saved ? "Inasistencia" : "Sin incidencias";
        return `${dayLabel} ${label}.`;
      }

      const rEnt = parseTime(r.entrada_turno);
      const rSal = parseTime(r.salida_turno);
      const hIni = hDia ? parseHorarioTime(hDia.inicio) : null;
      const hFin = hDia ? parseHorarioTime(hDia.fin) : null;

      let justificarMins = 0;
      if (rEnt && hIni) {
        const diffEnt = timeDiffMins(rEnt, hIni);
        if (diffEnt > 5) justificarMins = diffEnt;
      }

      let tiempoAdicionalMins = 0;
      let salidaAntesMins = 0;
      if (rSal && hFin) {
        const diffSal = timeDiffMins(rSal, hFin);
        if (diffSal > 5) tiempoAdicionalMins = diffSal;
        else if (diffSal < -5) salidaAntesMins = -diffSal;
      }
      if (rEnt && hIni) {
        const diffEnt = timeDiffMins(rEnt, hIni);
        if (diffEnt < -5) {
          tiempoAdicionalMins += (-diffEnt);
        }
      }

      const hasObs = saved && saved.observaciones &&
        !["Homeoffice", "Vacaciones", "Evento", "Asueto"].includes(saved.observaciones);

      if (justificarMins === 0 && tiempoAdicionalMins === 0 && salidaAntesMins === 0 && !hasObs && !saved?.observaciones_comida) {
        return `${dayLabel} <span style="color:#16a34a;font-weight:normal;">Sin incidencias.</span>`;
      }

      const parts: string[] = [dayLabel];

      if (justificarMins > 0) {
        const jColor = justificarMins > 15 ? "#dc2626" : "#ea580c";
        parts.push(`<strong style="color:${jColor};">Justificar ${justificarMins} minutos.</strong>`);
      }

      if (salidaAntesMins > 0) {
        parts.push(`<strong style="color:#dc2626;">Salida anticipada ${salidaAntesMins} minutos.</strong>`);
      }

      if (tiempoAdicionalMins > 0) {
        parts.push(`<strong style="color:#16a34a;">Tiempo adicional ${tiempoAdicionalMins} minutos.</strong>`);
      }

      if (hasObs) {
        parts.push(`<strong style="color:#111827;">Motivo:</strong> ${saved.observaciones}.`);
      }

      if (saved?.observaciones_comida) {
        parts.push(`<strong style="color:#111827;">Motivo (Comida):</strong> ${saved.observaciones_comida}.`);
      }

      return parts.join(" ");
    }).filter((line: string | null) => line !== null) as string[];

    const htmlList = lines.length > 0 ? `
      <div style="background-color:#f9fafb;border-left:4px solid #caab55;padding:15px;margin:15px 0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:14px;line-height:1.6;color:#374151;">
        ${lines
        .map(
          (line) =>
            `<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #e5e7eb;">${line}</div>`
        )
        .join("")}
      </div>
    ` : "";

    // 6. Generar tabla calendario correcta usando sortedTodos
    const { tableHtml: calendarTable, legendHtml } = buildCalendarTable(sortedTodos, schedule, activeMap);

    // 7. Ensamblar cuerpo y asunto dinámico del correo
    let emailSubject = "";
    if (quincena === 1) {
      emailSubject = `[SiGeT] Reporte de incidencias - ${colaboradorName} - Quincena 1 ${capitalizedMesName} ${anio}`;
    } else if (quincena === 2) {
      emailSubject = `[SiGeT] Reporte de incidencias - ${colaboradorName} - Quincena 2 ${capitalizedMesName} ${anio}`;
    } else {
      emailSubject = `[SiGeT] Reporte de incidencias - ${colaboradorName} - ${capitalizedMesName} ${anio}`;
    }

    const emailBody = `
      <p style="margin:0 0 16px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#374151;">Buen día ${VICTOR_NAME},</p>
      <p style="margin:0 0 16px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#374151;"><strong>Colaborador:</strong> ${colaboradorName}</p>
      <p style="margin:0 0 16px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#374151;">Se envía el presente correo correspondiente <strong>${periodText}</strong>, con los registros de las incidencias y sus justificaciones:</p>

      <div style="margin:20px 0;overflow-x:auto;">
        ${calendarTable}
        ${legendHtml}
      </div>

      ${htmlList}
    `;

    const htmlWrapped = getHtmlWrapper(emailSubject, emailBody);

    // Para: Víctor Barrera (fijo) | CC: Colaborador que envía
    const sendResult = await sendEmail({
      to: VICTOR_EMAIL,
      cc: colaborador.mail,
      subject: emailSubject,
      htmlBody: htmlWrapped,
      fromName: colaboradorName,
    });

    if (!sendResult.success) {
      throw new Error(sendResult.error || "Fallo al enviar correo con SES");
    }

    return new Response(
      JSON.stringify({ message: "Reporte de incidencias guardado y enviado correctamente" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error al enviar reporte de incidencias:", error);
    return new Response(
      JSON.stringify({ message: "Error interno del servidor", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
