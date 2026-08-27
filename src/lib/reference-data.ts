import { prisma } from './db';
import type { Categoria, Empresa, Estatus } from '@prisma/client';

/**
 * Caché en memoria de los catálogos de referencia.
 *
 * `estatus`, `categoria`, `subcategoria`, `empresa`, `descuento`, `carrera` y
 * `oferta` son tablas pequeñas (11, 12, 144, 17, 21, 34 y 6 filas hoy) que sólo
 * cambian cuando un administrador las edita, y sin embargo se consultaban en
 * cada render: las cuatro listas de tickets piden `estatus` completo para
 * rellenar un `<select>`, y `tickets/view/[id]` pedía además campus, carreras y
 * descuentos antes de saber si el ticket era un traslado.
 *
 * Aquí se memorizan 5 minutos. Además los endpoints que las modifican
 * (`/api/admin/categorias`, `/api/admin/subcategories`, `/api/admin/empresa`)
 * llaman a `invalidateReferenceData()`, así que un cambio hecho desde el panel
 * de administración se ve con un F5 y no hay que esperar al TTL.
 *
 * Notas de diseño:
 *
 * - Los getters devuelven una copia superficial del array cacheado para que un
 *   `sort()` o un `push()` accidental en una página no corrompa el caché.
 * - Un error de consulta **se propaga**, igual que cuando la página consultaba
 *   Prisma directamente. No se sirve una entrada caducada como respaldo: para
 *   datos que alimentan formularios de edición es preferible fallar que mostrar
 *   catálogos obsoletos de forma silenciosa.
 * - El caché es por proceso. Con varias instancias de App Runner cada una tiene
 *   el suyo y la invalidación sólo alcanza a la que atendió la petición; el TTL
 *   acota la divergencia a 5 minutos.
 *
 * Las páginas de administración **no** deben usar estos getters: necesitan leer
 * el estado real tras cada escritura.
 */

const TTL_MS = 5 * 60_000;

type Entry = { value: unknown; expiresAt: number };

const cache = new Map<string, Entry>();

async function memo<T>(key: string, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const value = await load();
  cache.set(key, { value, expiresAt: now + TTL_MS });
  return value;
}

/** Todos los estatus, ordenados por nombre. */
export async function getEstatus(): Promise<Estatus[]> {
  const lista = await memo('estatus', () =>
    prisma.estatus.findMany({ orderBy: { nombre: 'asc' } }),
  );
  return [...lista];
}

/** Todas las categorías (activas e inactivas), ordenadas por nombre. */
export async function getCategorias(): Promise<Categoria[]> {
  const lista = await memo('categoria', () =>
    prisma.categoria.findMany({ orderBy: { nombre: 'asc' } }),
  );
  return [...lista];
}

/** Todas las empresas (activas e inactivas), ordenadas por nombre. */
export async function getEmpresas(): Promise<Empresa[]> {
  const lista = await memo('empresa', () =>
    prisma.empresa.findMany({ orderBy: { nombre: 'asc' } }),
  );
  return [...lista];
}

/** Empresas activas: las que pueden ser campus origen o destino de un traslado. */
export async function getCampusesActivos(): Promise<Empresa[]> {
  return (await getEmpresas()).filter((e) => e.activa);
}

export type SubcategoriaRef = {
  id: number;
  nombre: string;
  parent_subcategoriaId: number | null;
  activo: boolean;
  /** Categorías a las que está asociada, vía `subcategoria_categorias`. */
  categoriaIds: number[];
};

type SubcategoriasCache = {
  lista: SubcategoriaRef[];
  porId: Map<number, SubcategoriaRef>;
};

function loadSubcategorias(): Promise<SubcategoriasCache> {
  return prisma.subcategoria
    .findMany({
      select: {
        id: true,
        nombre: true,
        parent_subcategoriaId: true,
        activo: true,
        subcategoria_categorias: { select: { categoriaId: true } },
      },
      orderBy: { nombre: 'asc' },
    })
    .then((filas) => {
      const lista: SubcategoriaRef[] = filas.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        parent_subcategoriaId: s.parent_subcategoriaId,
        activo: s.activo,
        categoriaIds: s.subcategoria_categorias.map((sc) => sc.categoriaId),
      }));
      return { lista, porId: new Map(lista.map((s) => [s.id, s])) };
    });
}

/** Todas las subcategorías, ordenadas por nombre. */
export async function getSubcategorias(): Promise<SubcategoriaRef[]> {
  const { lista } = await memo('subcategoria', loadSubcategorias);
  return [...lista];
}

/**
 * Subcategorías de primer nivel (sin padre) y activas asociadas a una categoría.
 * Es lo que alimenta el filtro de área de las listas de Marketing.
 */
export async function getSubcategoriasNivel1(categoriaId: number): Promise<SubcategoriaRef[]> {
  const { lista } = await memo('subcategoria', loadSubcategorias);
  return lista.filter(
    (s) => s.activo && s.parent_subcategoriaId === null && s.categoriaIds.includes(categoriaId),
  );
}

/**
 * Ruta de una subcategoría, de la raíz a la hoja, resuelta **en memoria**.
 *
 * `tickets/view/[id]` construía el breadcrumb con un `while` que emitía una
 * consulta por nivel de la jerarquía (N+1). El mapa completo son 144 filas.
 *
 * El recorrido lleva un tope de profundidad y un conjunto de visitados: la
 * jerarquía es autorreferencial y un ciclo en los datos colgaría el render.
 */
export async function getRutaSubcategoria(subcategoriaId: number): Promise<string[]> {
  const { porId } = await memo('subcategoria', loadSubcategorias);
  const ruta: string[] = [];
  const vistos = new Set<number>();

  let actual = porId.get(subcategoriaId);
  while (actual && !vistos.has(actual.id) && ruta.length < 20) {
    vistos.add(actual.id);
    ruta.unshift(actual.nombre);
    actual = actual.parent_subcategoriaId ? porId.get(actual.parent_subcategoriaId) : undefined;
  }

  return ruta;
}

/** Descuentos activos para el formulario de traslados. */
export async function getDescuentosActivos(): Promise<{ id: number; descripcion: string }[]> {
  const lista = await memo('descuento', () =>
    prisma.descuento.findMany({
      where: { activo: true },
      select: { id: true, descripcion: true },
      orderBy: { descripcion: 'asc' },
    }),
  );
  return [...lista];
}

export type CarreraRef = {
  id: number;
  descripcion: string;
  oferta: { descripcion: string };
};

/** Carreras activas con su oferta, para el autocompletado de traslados. */
export async function getCarrerasActivas(): Promise<CarreraRef[]> {
  const lista = await memo('carrera', () =>
    prisma.carrera.findMany({
      where: { activo: true },
      select: { id: true, descripcion: true, oferta: { select: { descripcion: true } } },
      orderBy: { descripcion: 'asc' },
    }),
  );
  return [...lista];
}

/**
 * Descarta todos los catálogos. Debe llamarse desde cualquier endpoint que
 * modifique categorías, subcategorías, empresas, estatus, descuentos, carreras
 * u ofertas.
 */
export function invalidateReferenceData(): void {
  cache.clear();
}
