import { PerfilCliente } from '@/features/perfil/PerfilCliente';

export const metadata = { title: 'Tu perfil — nutria' };

/**
 * Dejó de leer la sesión en el servidor: `GET /api/v1/me` trae el perfil real
 * —objetivo, nutrióloga asignada, metas— y no solo el nombre y el correo que
 * la sesión conocía. Con eso la pantalla ya no necesita ser dinámica.
 */
export default function PerfilPage() {
  return <PerfilCliente />;
}
