export function ErrorFormulario({ error }: { error: unknown }) {
  if (!error) return null;
  const mensaje =
    error instanceof Error ? error.message : 'No pudimos guardar el registro. Intenta de nuevo.';
  return (
    <p
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800"
    >
      {mensaje}
    </p>
  );
}
