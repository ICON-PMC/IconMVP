// Fondo de blobs de color difuminados (estética tropical de Icon).
export function Aurora() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute -left-24 top-8 h-80 w-80 rounded-full bg-coral/60 blur-3xl" />
      <div className="absolute -right-16 -top-10 h-72 w-72 rounded-full bg-blush/70 blur-3xl" />
      <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-forest/30 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-leaf/60 blur-3xl" />
      <div className="absolute bottom-10 right-1/4 h-64 w-64 rounded-full bg-sky/40 blur-3xl" />
    </div>
  );
}
