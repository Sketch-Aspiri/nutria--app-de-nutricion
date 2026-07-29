import Link from 'next/link';

import { PRIVACY_NOTICE_VERSION, getPrivacyResponsible } from '@/config/privacy';

export const metadata = { title: 'Aviso de privacidad — nutria' };
export const dynamic = 'force-dynamic';

/**
 * Aviso de privacidad dirigido al **paciente**.
 *
 * No es una copia del aviso del panel: aquel le habla al nutriólogo como
 * responsable del expediente, y este le habla al titular de los datos. La
 * distinción importa porque de ella depende a quién ejerce sus derechos ARCO:
 * el responsable del expediente clínico es su nutrióloga, no la plataforma.
 *
 * La versión sale de la misma constante que sella `users.privacy_notice_version`
 * al activar la cuenta: si el aviso cambia, el registro de qué aceptó cada
 * paciente sigue siendo verificable.
 */
export default function PrivacidadPage() {
  const responsable = getPrivacyResponsible();

  return (
    <main className="min-h-screen px-6 pb-16 pt-12">
      <Link href="/" className="font-display text-2xl font-medium text-emerald-950">
        nutria
      </Link>

      <h1 className="mt-8 font-display text-2xl font-medium text-emerald-950">
        Aviso de privacidad
      </h1>
      <p className="mt-1 font-mono text-[11px] text-stone-400">Versión {PRIVACY_NOTICE_VERSION}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-stone-700">
        <Seccion titulo="Quién trata tus datos">
          <p>
            La plataforma la opera {responsable.name}, con domicilio en {responsable.address}. Tu
            expediente clínico —peso, medidas, hábitos y notas de consulta— lo captura y resguarda
            la nutrióloga que te atiende, que es su responsable. Nosotros lo alojamos y lo
            protegemos por encargo suyo.
          </p>
        </Seccion>

        <Seccion titulo="Qué datos guardamos">
          <p>
            Tus datos de identificación y contacto, y los datos de salud que tú registras o que tu
            nutrióloga anota: peso, medidas, comidas, ejercicio, consumo de agua y las notas
            clínicas de tus consultas. Son datos personales sensibles y por eso su tratamiento
            exige tu consentimiento expreso.
          </p>
        </Seccion>

        <Seccion titulo="Para qué los usamos">
          <p>
            Para darte tu plan alimenticio, seguir tu avance y mantener tu comunicación con tu
            nutrióloga. No vendemos tus datos ni los compartimos con anunciantes.
          </p>
        </Seccion>

        <Seccion titulo="Cuando usas el asistente">
          <p>
            Las funciones asistidas por inteligencia artificial envían tu consulta a un proveedor
            externo <strong>sin tu nombre, tu correo ni tu teléfono</strong>, y sin tus notas
            clínicas. Lo que viaja es el contexto mínimo para orientarte: tu objetivo, las metas de
            tu plan y tus alergias. El asistente orienta; no diagnostica ni sustituye a tu
            nutrióloga.
          </p>
        </Seccion>

        <Seccion titulo="Tus derechos">
          <p>
            Puedes acceder, rectificar, cancelar u oponerte al tratamiento de tus datos escribiendo
            a {responsable.email}. Sobre tu expediente clínico, esos derechos los ejerces con tu
            nutrióloga, que es su responsable; nosotros le damos las herramientas para atenderte.
          </p>
        </Seccion>

        <Seccion titulo="Cuánto tiempo los conservamos">
          <p>
            Tu expediente clínico se conserva por el plazo que exige la NOM-004-SSA3-2012. Si das
            de baja tu acceso a la app, tu cuenta se elimina y el expediente permanece con tu
            nutrióloga.
          </p>
        </Seccion>
      </div>

      <Link
        href="/entrar"
        className="mt-10 inline-block text-sm font-medium text-emerald-800 underline"
      >
        Volver
      </Link>
    </main>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 text-sm font-medium text-emerald-950">{titulo}</h2>
      {children}
    </section>
  );
}
