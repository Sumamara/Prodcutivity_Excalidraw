/**
 * Ajustes del encaje inicial de la hoja dentro del marco (px de pantalla).
 * Vive en su propio módulo para poder recargar la página automáticamente al
 * editarlo (ver el bloque `import.meta.hot` en Canvas.tsx): el encaje solo se
 * aplica al montar el lienzo, así que sin recarga no se vería el cambio.
 *
 *   FIT_PAD_LEFT   franja libre a la izquierda (barra de herramientas)
 *   FIT_PAD_RIGHT  margen derecho
 *   FIT_PAD_Y      margen arriba/abajo
 *   FIT_SCALE      1 = hoja pegada a los bordes del área útil; <1 = más holgura
 */
export const FIT_PAD_LEFT = 36;
export const FIT_PAD_RIGHT = 24;
export const FIT_PAD_Y = 16;
export const FIT_SCALE = 0.95;
