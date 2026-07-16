import type { APIRoute } from "astro";
import { getSession } from "auth-astro/server";
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
// Generador de tabla HTML para el correo
// ─────────────────────────────────────────────
function buildCalendarTable(sortedTodos: any[], schedule: any, activeMap: Map<string, any>): string {
  const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const diasHeaders = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const diasSemanaNorm = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

  if (sortedTodos.length === 0) return "";

  const CELL_W = "85px";
  const CELL_H = "90px";

  // Colores de estado
  const colorMap: Record<string, string> = {
    ok: "#d1fae5",  // verde claro – a tiempo
    tarde: "#fee2e2",  // rojo claro – tardanza
    orange: "#ffedd5",  // naranja – 6-15 min
    repo: "#d1fae5",  // verde claro – reposición
    inasist: "#f3f4f6",  // gris claro – inasistencia / sin registro
    sinReg: "#fef9c3",  // amarillo claro – sin datos parciales
    especial: "#ede9fe",  // morado claro – Homeoffice / Vacaciones
  };

  // Encabezados Lun-Sáb
  const headerRow = diasHeaders
    .map(
      (d) =>
        `<th style="width:${CELL_W};padding:6px 4px;background-color:#881912;color:#fff;font-family:'Segoe UI',sans-serif;font-size:11px;font-weight:700;text-align:center;border:1px solid #6b1010;">${d}</th>`
    )
    .join("");

  // getUTCDay(): 0=Dom,1=Lun,...,6=Sáb. Lunes es columna 0
  const firstDay = sortedTodos[0].fecha;
  const firstDayNum = new Date(firstDay).getUTCDay();
  const emptyCellsCount = firstDayNum === 0 ? 0 : firstDayNum - 1;

  // Construir array de celdas con huecos al inicio
  const cells: string[] = [];
  for (let i = 0; i < emptyCellsCount; i++) {
    cells.push(`<td style="width:${CELL_W};height:${CELL_H};border:1px solid #e5e7eb;background-color:#f9fafb;"></td>`);
  }

  for (const inc of sortedTodos) {
    const date = new Date(inc.fecha);
    const utcDay = date.getUTCDay(); // 0=Dom
    if (utcDay === 0) continue; // Ignorar domingos

    const dayName = diasSemana[utcDay];
    const dayNameNorm = diasSemanaNorm[utcDay];
    const dayNum = date.getUTCDate().toString().padStart(2, "0");
    const hDia = schedule[dayNameNorm];

    const dateStr = date.toISOString().split("T")[0];
    const activeInc = activeMap.get(dateStr);
    const isOmitida = activeInc ? activeInc.omitida : false;

    const rEnt = parseTime(inc.entrada_turno);
    const rSal = parseTime(inc.salida_turno);
    const hIni = hDia ? parseHorarioTime(hDia.inicio) : null;
    const hFin = hDia ? parseHorarioTime(hDia.fin) : null;

    const isAllNull =
      !inc.entrada_turno && !inc.salida_turno && !inc.entrada_comida && !inc.salida_comida;

    // Detectar etiqueta especial (Homeoffice / Vacaciones) guardada en observaciones
    const specialLabel = (isAllNull && activeInc && (activeInc.observaciones === "Homeoffice" || activeInc.observaciones === "Vacaciones"))
      ? activeInc.observaciones as string
      : null;

    // Determinar estado y color de fondo
    let bgColor = colorMap.ok;
    let statusLines: string[] = [];

    if (isOmitida) {
      // Omitido: renderizar como normal / a tiempo sin advertencias de color
      bgColor = colorMap.ok;
      if (inc.entrada_turno) {
        statusLines.push(
          `<span style="color:#16a34a;font-weight:700;font-size:10px;">EL ${formatTime(inc.entrada_turno)}</span>`
        );
      }
      if (inc.entrada_comida) {
        statusLines.push(
          `<span style="color:#6b7280;font-size:9px;">SC ${formatTime(inc.entrada_comida)}</span>`
        );
      }
      if (inc.salida_comida) {
        statusLines.push(
          `<span style="color:#6b7280;font-size:9px;">RC ${formatTime(inc.salida_comida)}</span>`
        );
      }
      if (inc.salida_turno) {
        statusLines.push(
          `<span style="color:#16a34a;font-weight:700;font-size:10px;">SL ${formatTime(inc.salida_turno)}</span>`
        );
      }
    } else if (specialLabel) {
      // Homeoffice o Vacaciones: fondo morado
      bgColor = colorMap.especial;
      statusLines.push(`<span style="color:#7c3aed;font-size:10px;font-weight:700;">${specialLabel}</span>`);
    } else if (isAllNull) {
      bgColor = colorMap.inasist;
      statusLines.push(`<span style="color:#6b7280;font-size:10px;font-weight:600;">Inasistencia</span>`);
    } else {
      // ── Entrada Laboral ──
      if (inc.entrada_turno) {
        let elColor = "#374151";
        let elBg = bgColor;

        if (rEnt && hIni) {
          const diffEnt = timeDiffMins(rEnt, hIni);
          if (diffEnt < 0) {
            elColor = "#16a34a"; // verde
          } else if (diffEnt > 15) {
            elColor = "#dc2626"; // rojo
            elBg = colorMap.tarde;
          } else if (diffEnt >= 6) {
            elColor = "#ea580c"; // naranja
            elBg = colorMap.orange;
          }
          if (elBg !== bgColor) bgColor = elBg;
        }

        statusLines.push(
          `<span style="color:${elColor};font-weight:700;font-size:10px;">EL ${formatTime(inc.entrada_turno)}</span>`
        );
      } else {
        statusLines.push(`<span style="color:#dc2626;font-size:9px;font-weight:700;">EL (-:--)</span>`);
        bgColor = colorMap.tarde;
      }

      // ── Salida Comida ──
      if (inc.entrada_comida) {
        statusLines.push(
          `<span style="color:#6b7280;font-size:9px;">SC ${formatTime(inc.entrada_comida)}</span>`
        );
      }
      if (inc.salida_comida) {
        statusLines.push(
          `<span style="color:#6b7280;font-size:9px;">RC ${formatTime(inc.salida_comida)}</span>`
        );
      }

      // ── Salida Laboral ──
      if (inc.salida_turno) {
        let slColor = "#374151";
        if (rSal && hFin) {
          const diffSal = timeDiffMins(rSal, hFin);
          if (diffSal > 5) slColor = "#16a34a"; // verde
        }
        statusLines.push(
          `<span style="color:${slColor};font-weight:700;font-size:10px;">SL ${formatTime(inc.salida_turno)}</span>`
        );
      } else {
        statusLines.push(`<span style="color:#dc2626;font-size:9px;font-weight:700;">SL (-:--)</span>`);
        bgColor = colorMap.tarde;
      }
    }

    const watermarkNum = `<span style="position:absolute;top:2px;right:4px;font-size:22px;font-weight:900;color:rgba(0,0,0,0.18);line-height:1;pointer-events:none;">${dayNum}</span>`;

    const innerContent = statusLines
      .map((s) => `<div style="line-height:1.3;">${s}</div>`)
      .join("");

    cells.push(
      `<td style="position:relative;width:${CELL_W};height:${CELL_H};background-color:${bgColor};border:1px solid #d1d5db;padding:4px 5px;vertical-align:top;">` +
      watermarkNum +
      `<div style="margin-top:2px;">${innerContent}</div>` +
      `</td>`
    );
  }

  // Dividir en filas de 6 (Lun a Sáb)
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 6) {
    const chunk = cells.slice(i, i + 6);
    // Rellenar si la última fila es incompleta
    while (chunk.length < 6) {
      chunk.push(`<td style="width:${CELL_W};height:${CELL_H};border:1px solid #e5e7eb;background-color:#f9fafb;"></td>`);
    }
    rows.push(`<tr>${chunk.join("")}</tr>`);
  }

  return `
    <table style="border-collapse:collapse;width:100%;table-layout:fixed;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
      <thead>
        <tr>${headerRow}</tr>
      </thead>
      <tbody>
        ${rows.join("")}
      </tbody>
    </table>
  `;
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
export const POST: APIRoute = async ({ request }) => {
  const session = await getSession(request);
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

    // 2. Obtener datos del director y colaborador
    const director = await prisma.usuario.findFirst({
      where: { rolId: 1, activo: true },
    });
    const directorName = director
      ? `${director.nombres} ${director.apellidos}`
      : "Director CSH";

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

    // 5. Lista textual de incidencias (solo las no-omitidas) con colores inline
    const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const diasSemanaNorm = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

    const sortedData = [...dataToInsert].sort(
      (a, b) => a.fecha.getTime() - b.fecha.getTime()
    );
    const nonOmittedIncidencias = sortedData.filter(inc => !inc.omitida);

    const lines = nonOmittedIncidencias.map((inc) => {
      const date = inc.fecha;
      const dayName = diasSemana[date.getUTCDay()];
      const dayNameNorm = diasSemanaNorm[date.getUTCDay()];
      const dayNum = date.getUTCDate().toString().padStart(2, "0");
      const hDia = schedule[dayNameNorm];

      const parts: string[] = [`<strong>${dayName} ${dayNum}.</strong>`];

      const rEnt = parseTime(inc.entrada_turno);
      const rSal = parseTime(inc.salida_turno);
      const hIni = hDia ? parseHorarioTime(hDia.inicio) : null;
      const hFin = hDia ? parseHorarioTime(hDia.fin) : null;

      const isAllNull =
        !inc.entrada_turno && !inc.salida_turno && !inc.entrada_comida && !inc.salida_comida;

      // Detectar Homeoffice / Vacaciones por el campo observaciones
      const specialLabel = (isAllNull && (inc.observaciones === "Homeoffice" || inc.observaciones === "Vacaciones"))
        ? inc.observaciones
        : null;

      if (specialLabel) {
        parts.push(`${specialLabel}.`);
      } else if (isAllNull) {
        parts.push("Inasistencia.");
      } else {
        if (inc.entrada_turno && hIni) {
          const diffEnt = timeDiffMins(rEnt, hIni);
          let elColor = "";
          if (diffEnt < 0) elColor = "color:#16a34a;";
          else if (diffEnt > 15) elColor = "color:#dc2626;";
          else if (diffEnt >= 6) elColor = "color:#ea580c;";
          const elStyle = `font-weight:bold;${elColor ? ` ${elColor}` : ""}`;
          const elText = `<span style="${elStyle}">EL (${formatTime(inc.entrada_turno)})</span>`;

          if (diffEnt > 5) {
            parts.push(`${elText} Se registra entrada ${diffEnt} minutos tarde. Entrada laboral normal ${hDia.inicio} horas.`);
          } else if (diffEnt < 0) {
            parts.push(`${elText} Se registra entrada ${-diffEnt} minutos antes. Entrada laboral normal ${hDia.inicio} horas.`);
          } else {
            parts.push(`${elText} Entrada a tiempo.`);
          }
        } else if (!inc.entrada_turno) {
          parts.push("Falta registro de entrada.");
        }

        if (inc.salida_turno && hFin) {
          const diffSal = timeDiffMins(rSal, hFin);
          let slColor = "";
          if (diffSal > 5) slColor = "color:#16a34a;";
          const slStyle = `font-weight:bold;${slColor ? ` ${slColor}` : ""}`;
          const slText = `<span style="${slStyle}">SL (${formatTime(inc.salida_turno)})</span>`;

          if (diffSal > 5) {
            parts.push(`${slText} Se reponen ${diffSal} minutos del tiempo. Salida laboral normal ${hDia.fin} horas.`);
          } else if (diffSal < 0) {
            parts.push(`${slText} Se registra salida ${-diffSal} minutos antes. Salida laboral normal ${hDia.fin} horas.`);
          } else {
            parts.push(`${slText} Salida a tiempo.`);
          }
        } else if (!inc.salida_turno) {
          parts.push("Falta registro de salida.");
        }

        if (inc.entrada_comida && inc.salida_comida) {
          const rEntC = parseTime(inc.entrada_comida);
          const rSalC = parseTime(inc.salida_comida);
          if (rEntC && rSalC) {
            const diffC = timeDiffMins(rSalC, rEntC);
            if (diffC > 30) {
              parts.push(
                `Comida (${formatTime(inc.entrada_comida)} a ${formatTime(inc.salida_comida)}) Horario de comida excedido por ${diffC - 30} minutos.`
              );
            }
          }
        }
      }

      if (inc.observaciones) parts.push(`<strong>Motivo:</strong> ${inc.observaciones}.`);
      if (inc.observaciones_comida) parts.push(`<strong>Motivo (Comida):</strong> ${inc.observaciones_comida}.`);

      return parts.join(" ");
    });

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
    const calendarTable = buildCalendarTable(sortedTodos, schedule, activeMap);

    // 7. Leyenda de colores actualizada
    const legendHtml = `
      <div style="margin:10px 0 16px;font-family:'Segoe UI',sans-serif;font-size:11px;color:#6b7280;display:flex;flex-wrap:wrap;gap:8px;">
        <span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:12px;height:12px;background-color:#d1fae5;border:1px solid #a7f3d0;border-radius:2px;"></span> A tiempo</span>
        <span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:12px;height:12px;background-color:#fee2e2;border:1px solid #fca5a5;border-radius:2px;"></span> Justificar</span>
        <span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:12px;height:12px;background-color:#ffedd5;border:1px solid #fdba74;border-radius:2px;"></span> Retardo</span>
        <span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:12px;height:12px;background-color:#f3f4f6;border:1px solid #d1d5db;border-radius:2px;"></span> Inasistencia</span>
        <span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:12px;height:12px;background-color:#ede9fe;border:1px solid #c4b5fd;border-radius:2px;"></span> Homeoffice / Vacaciones</span>
      </div>
    `;

    // 8. Ensamblar cuerpo y asunto dinámico del correo
    let emailSubject = "";
    if (quincena === 1) {
      emailSubject = `[SiGeT] Reporte de incidencias - ${colaboradorName} - Quincena 1 ${capitalizedMesName} ${anio}`;
    } else if (quincena === 2) {
      emailSubject = `[SiGeT] Reporte de incidencias - ${colaboradorName} - Quincena 2 ${capitalizedMesName} ${anio}`;
    } else {
      emailSubject = `[SiGeT] Reporte de incidencias - ${colaboradorName} - ${capitalizedMesName} ${anio}`;
    }

    const emailBody = `
      <p style="margin:0 0 16px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#374151;">Buen día Ing. ${directorName},</p>
      <p style="margin:0 0 16px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#374151;"><strong>Colaborador:</strong> ${colaboradorName}</p>
      <p style="margin:0 0 16px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#374151;">Se envía el presente correo correspondiente <strong>${periodText}</strong>, con los registros de las incidencias y sus justificaciones:</p>

      <div style="margin:20px 0;overflow-x:auto;">
        ${calendarTable}
        ${legendHtml}
      </div>

      ${htmlList}
    `;

    const htmlWrapped = getHtmlWrapper(emailSubject, emailBody);

    // Para: Director CSH | CC: Colaborador que envía
    const toEmail = director?.mail || colaborador.mail;
    const ccEmail = director?.mail ? colaborador.mail : undefined;

    const sendResult = await sendEmail({
      to: toEmail,
      cc: ccEmail,
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
