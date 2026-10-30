// Misma salida en servidor y navegador (evita desajustes de hidratación por zona horaria).
const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
export const formatWhen = (iso: string) => fmt.format(new Date(iso));
