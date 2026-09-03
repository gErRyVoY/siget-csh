/**
 * Tamaño del diálogo de Google Picker, compartido por los cuatro sitios que lo abren
 * (asistente CSH, asistente Marketing, vista de ticket y formulario de traslado).
 *
 * Antes cada uno calculaba `max(320, min(innerWidth * 0.9, 1050))` por ancho y
 * `max(300, min(innerHeight * 0.85, 650))` por alto, y de ahí venía el diálogo en el
 * que no se alcanzaba a ver el contenido del Drive:
 *
 *  - El tope de 650 px de alto es el problema principal. El diálogo gasta esa altura
 *    en su cabecera (pestañas "Mi unidad" / "Subir") y en su pie (los botones), así
 *    que a la rejilla de archivos le quedaban poco más de 500 px por muy grande que
 *    fuese la pantalla. En un portátil normal sobra espacio de sobra sin usar.
 *  - Los mínimos de 320x300 están por debajo del mínimo que documenta Google para el
 *    Picker, 566x350. Por debajo de eso el diálogo se dibuja cortado.
 */

/** Aire que se deja entre el diálogo y el borde de la ventana. */
const MARGEN_VENTANA = 32;

/** Mínimo documentado por Google; por debajo el diálogo se renderiza cortado. */
const ANCHO_MIN = 566;
const ALTO_MIN = 350;

/** Tope para que en pantallas grandes el diálogo no quede desproporcionado. */
const ANCHO_MAX = 1200;
const ALTO_MAX = 900;

export function calcularTamanoPicker(): { width: number; height: number } {
    // El tercer argumento de cada `min` es la salvaguarda para ventanas más pequeñas que
    // el mínimo de Google (un móvil estrecho): ahí se prefiere un diálogo que quepa,
    // aunque Google lo dibuje algo apretado, a uno que sobresalga por los dos lados.
    return {
        width: Math.min(
            Math.max(window.innerWidth - MARGEN_VENTANA * 2, ANCHO_MIN),
            ANCHO_MAX,
            window.innerWidth,
        ),
        height: Math.min(
            Math.max(window.innerHeight - MARGEN_VENTANA * 2, ALTO_MIN),
            ALTO_MAX,
            window.innerHeight,
        ),
    };
}
