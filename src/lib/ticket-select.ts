import { Prisma } from '@prisma/client';

/**
 * Campos que necesitan las cuatro listas de tickets (soporte, soporte/usuario,
 * marketing, marketing/usuario) y nada más.
 *
 * Antes las cuatro usaban `include: { estatus: true, categoria: true,
 * subcategoria: true, solicitante: true, atiende: true, empresa: true }`, que
 * trae la fila completa de cada relación: entre otras cosas, el JSON
 * `horario_disponibilidad` del solicitante y del agente en cada una de las diez
 * filas de la página, para acabar mostrando un nombre y un apellido.
 */
export const ticketListSelect = {
  id: true,
  descripcion: true,
  fechaalta: true,
  estatus: { select: { nombre: true } },
  categoria: { select: { nombre: true } },
  // `parent_subcategoriaId` lo usan las listas de Marketing para distinguir el
  // área (nivel 1) del detalle (nivel 2) en la misma celda.
  subcategoria: { select: { nombre: true, parent_subcategoriaId: true } },
  solicitante: { select: { nombres: true, apellidos: true } },
  atiende: { select: { nombres: true, apellidos: true } },
  empresa: { select: { nombre: true } },
} satisfies Prisma.TicketSelect;
