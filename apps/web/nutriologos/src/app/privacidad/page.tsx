import {
  ArrowLeft,
  Database,
  FileKey2,
  HeartPulse,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import {
  getPrivacyResponsible,
  PRIVACY_NOTICE_VERSION,
} from '@/config/privacy';

export const metadata: Metadata = {
  title: 'Aviso de privacidad — nutria',
  description:
    'Cómo nutria trata y protege datos personales y datos sensibles de salud.',
};

const DATA_GROUPS = [
  {
    icon: FileKey2,
    title: 'Identidad y contacto',
    text: 'Nombre, correo, teléfono, fecha de nacimiento, imagen de perfil y datos profesionales.',
  },
  {
    icon: HeartPulse,
    title: 'Datos sensibles de salud',
    text: 'Antecedentes, medicamentos, hábitos alimentarios, alergias, peso, medidas, notas, mensajes y seguimiento nutricional.',
  },
  {
    icon: Database,
    title: 'Datos técnicos y de servicio',
    text: 'Identificadores de cuenta, bitácora de acceso, errores operativos sin cuerpos clínicos y estado de suscripción.',
  },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t border-emerald-950/10 py-8 md:grid-cols-[13rem_1fr]">
      <h2 className="font-display text-2xl leading-tight text-emerald-950">
        {title}
      </h2>
      <div className="space-y-4 text-sm leading-7 text-stone-600">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  const responsible = getPrivacyResponsible();

  return (
    <main className="min-h-screen bg-[#f2f0e8] text-stone-800">
      <div className="border-b border-emerald-950/10 bg-emerald-950 text-stone-50">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-emerald-200 transition-colors hover:text-white"
          >
            <ArrowLeft size={14} /> Volver a nutria
          </Link>
        </div>
      </div>

      <article className="mx-auto max-w-6xl px-6 pb-20">
        <header className="relative overflow-hidden border-x border-emerald-950/10 bg-[#f7f5ee] px-6 py-16 md:px-12 md:py-24">
          <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[44px] border-lime-300/40" />
          <div className="relative max-w-3xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-800/20 bg-white/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-900">
              <ShieldCheck size={13} /> Versión {PRIVACY_NOTICE_VERSION}
            </div>
            <h1 className="font-display text-5xl leading-[0.95] tracking-tight text-emerald-950 md:text-7xl">
              Tus datos clínicos merecen silencio.
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-stone-600 md:text-lg">
              Este aviso explica qué información trata nutria, para qué se usa,
              cómo se protege y cómo puedes ejercer tus derechos. Los datos de
              salud reciben protección reforzada y cifrado a nivel de
              aplicación.
            </p>
          </div>
        </header>

        <div className="border-x border-b border-emerald-950/10 bg-[#f7f5ee] px-6 md:px-12">
          <Section title="Responsable">
            <p>
              <strong className="text-stone-900">{responsible.name}</strong>,
              con domicilio en {responsible.address}, es responsable del
              tratamiento realizado por la plataforma nutria.
            </p>
            <p className="flex items-center gap-2">
              <Mail size={15} className="text-emerald-800" />
              Contacto de privacidad y solicitudes ARCO:{' '}
              <a
                className="font-medium text-emerald-800 underline underline-offset-4"
                href={`mailto:${responsible.email}`}
              >
                {responsible.email}
              </a>
            </p>
          </Section>

          <Section title="Datos tratados">
            <div className="grid gap-3 lg:grid-cols-3">
              {DATA_GROUPS.map((group) => (
                <div
                  key={group.title}
                  className="rounded-2xl border border-emerald-950/10 bg-white/55 p-4"
                >
                  <group.icon
                    size={18}
                    className="mb-3 text-emerald-800"
                  />
                  <h3 className="font-medium text-stone-900">{group.title}</h3>
                  <p className="mt-2 text-xs leading-5">{group.text}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Finalidades">
            <p>
              Los datos se usan para crear y administrar la cuenta, prestar la
              consulta nutricional, elaborar y compartir planes, dar
              seguimiento, gestionar citas y mensajes, generar documentos y
              mantener la seguridad y continuidad del servicio.
            </p>
            <p>
              Las funciones asistidas por IA reciben únicamente el contexto
              necesario y seudonimizado. No se envían nombres, correos ni
              teléfonos en los prompts clínicos y estos no se escriben en logs.
            </p>
            <p>
              No usamos datos sensibles para publicidad ni los vendemos. Una
              finalidad nueva e incompatible requiere informar y, cuando
              corresponda, obtener un consentimiento nuevo.
            </p>
          </Section>

          <Section title="Profesionales" >
            <div id="profesionales" className="scroll-mt-8">
              <p>
                El profesional crea su cuenta con consentimiento expreso al
                aviso. Es responsable de contar con una base legítima y el
                consentimiento aplicable para capturar información de sus
                pacientes, mantenerla correcta y limitar el acceso a su equipo.
              </p>
            </div>
          </Section>

          <Section title="Pacientes">
            <div id="pacientes" className="scroll-mt-8 space-y-4">
              <p>
                Antes del alta, el profesional debe entregar este aviso y
                obtener por escrito o por un medio electrónico el consentimiento
                expreso para datos sensibles. nutria registra la fecha, versión
                y método de esa constancia. Si hay correo, envía además una copia
                electrónica sin incluir información clínica.
              </p>
              <p>
                Negarse al tratamiento de los datos indispensables puede impedir
                prestar las funciones de expediente y seguimiento; no afecta el
                derecho a solicitar información o presentar una solicitud ARCO.
              </p>
            </div>
          </Section>

          <Section title="Encargados y transferencias">
            <p>
              Para operar el servicio pueden intervenir proveedores de
              alojamiento, base de datos, correo, monitoreo, almacenamiento,
              pagos e IA. Se les limita a la función contratada y a la
              información mínima necesaria. Los pagos se procesan en Stripe;
              nutria no almacena números completos de tarjeta.
            </p>
            <p>
              Algunos proveedores pueden tratar datos fuera de México bajo sus
              mecanismos contractuales y de seguridad. La lista operativa se
              revisa cuando cambia un proveedor material.
            </p>
          </Section>

          <Section title="Seguridad y conservación">
            <p>
              Las columnas clínicas de texto se cifran con AES‑256‑GCM; la base
              de datos aplica cifrado en reposo y las comunicaciones usan HTTPS.
              El acceso se valida en servidor por cuenta y pertenencia del
              paciente. Sentry elimina cuerpos, cookies, cabeceras de
              autorización e identidad antes de enviar eventos.
            </p>
            <p>
              Conservamos la información durante la relación de servicio y los
              plazos clínicos, fiscales o legales aplicables. Una solicitud de
              cancelación puede quedar limitada cuando exista una obligación
              válida de conservación; en ese caso se informa el motivo y se
              bloquea el uso incompatible.
            </p>
          </Section>

          <Section title="Derechos ARCO">
            <p>
              Puedes solicitar acceso, rectificación, cancelación u oposición,
              así como revocar consentimiento o limitar el uso. Escribe a{' '}
              <a
                className="font-medium text-emerald-800 underline underline-offset-4"
                href={`mailto:${responsible.email}`}
              >
                {responsible.email}
              </a>{' '}
              indicando el derecho que deseas ejercer, el medio para recibir
              respuesta y la información necesaria para verificar identidad y
              localizar el expediente. No envíes datos clínicos por correo.
            </p>
            <p>
              Los cambios a este aviso se publicarán en esta misma URL con una
              versión y fecha nuevas. Si el cambio requiere consentimiento, se
              solicitará antes de aplicar la nueva finalidad.
            </p>
          </Section>

          <div className="border-t border-emerald-950/10 py-8 text-xs leading-5 text-stone-500">
            Marco de referencia:{' '}
            <a
              href="https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              Ley Federal de Protección de Datos Personales en Posesión de los
              Particulares
            </a>
            . Este aviso debe revisarse con asesoría legal antes del lanzamiento
            comercial.
          </div>
        </div>
      </article>
    </main>
  );
}
