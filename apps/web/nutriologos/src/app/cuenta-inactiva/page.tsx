import { CuentaInactivaPanel } from '@/components/auth/CuentaInactivaPanel';

export const metadata = { title: 'Renueva tu acceso — nutria' };

export default function CuentaInactivaPage() {
  const contacto = process.env.BILLING_CONTACT_EMAIL?.trim() || 'aspiriandres97@gmail.com';
  return <CuentaInactivaPanel contacto={contacto} />;
}
