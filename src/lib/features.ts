// Banderas de funciones que se encienden por entorno (se leen solo en el servidor).

/**
 * Looks de usuarios (spec 008). true solo si USER_LOOKS_ENABLED === "1". Apagada: /crear responde
 * 404, la acción central sigue siendo la búsqueda por foto y no se muestra "Reportar".
 */
export function userLooksEnabled(): boolean {
  return process.env.USER_LOOKS_ENABLED === "1";
}
