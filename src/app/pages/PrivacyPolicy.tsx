import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { SiteHeader } from "../components/SiteHeader";

function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-white/10 pt-7">
      <h2 className="text-xl font-semibold tracking-normal text-white">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-neutral-300">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-fuchsia-300">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function PrivacyPolicy() {
  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: "radial-gradient(ellipse 130% 38% at 50% -5%, rgba(217, 70, 239, 0.08) 0%, transparent 58%), rgb(10, 10, 10)",
      }}
    >
      <SiteHeader
        contextBar={
          <div className="flex h-12 items-center gap-4 border-t border-white/5 px-4 sm:px-8">
            <Link to="/" className="flex items-center gap-2 text-neutral-400 transition-colors hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Inicio</span>
            </Link>
            <span className="text-neutral-700">|</span>
            <span className="text-sm text-white">Aviso de Privacidad</span>
          </div>
        }
      />

      <main className="mx-auto max-w-4xl px-6 py-12 lg:px-8">
        <p className="text-sm font-medium uppercase text-fuchsia-300">Documento legal</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
          Aviso de Privacidad
        </h1>
        <p className="mt-4 text-sm leading-6 text-neutral-400">
          Última actualización: 20 de julio de 2026
        </p>

        <div className="mt-10 space-y-8">
          <LegalSection title="2.1 Datos personales que recopilamos">
            <p>
              Ludora no solicita datos personales de identificación directa fuera del formulario de
              contacto.
            </p>
            <p>Cuando usas el formulario de contacto, Ludora recopila:</p>
            <BulletList items={["Nombre.", "Correo electrónico.", "Mensaje.", "Fecha y hora de envío."]} />
            <p>Con base en la implementación actual, Ludora no recopila:</p>
            <BulletList
              items={[
                "Cuentas públicas de usuario.",
                "Contraseñas.",
                "Datos de pago.",
                "Direcciones de envío.",
                "Historial de compras dentro de Ludora.",
                "Datos personales sensibles solicitados de forma intencional.",
              ]}
            />
          </LegalSection>

          <LegalSection title="2.2 Datos sensibles">
            <p>Ludora no solicita ni trata intencionalmente datos personales sensibles.</p>
            <p>
              No debes enviar datos sensibles por el formulario de contacto. Datos sensibles pueden
              incluir, entre otros, información de salud, origen racial o étnico, creencias
              religiosas, opiniones políticas, afiliación sindical, datos biométricos, datos
              financieros detallados, documentos oficiales o información de terceros que no sea
              necesaria.
            </p>
          </LegalSection>

          <LegalSection title="2.3 Finalidades del tratamiento">
            <p>Ludora usa los datos del formulario de contacto para:</p>
            <BulletList
              items={[
                "Recibir tu mensaje.",
                "Responder tu solicitud.",
                "Dar seguimiento a la comunicación relacionada con tu mensaje.",
                "Atender solicitudes relacionadas con privacidad o derechos ARCO.",
              ]}
            />
            <p>
              Ludora también usa Google Analytics para entender de forma general el uso del sitio y
              mejorar la experiencia. Google Analytics puede operar mediante cookies o tecnologías
              similares, de acuerdo con las políticas y configuraciones de Google.
            </p>
            <p>
              Para efectos prácticos de revisión legal, las finalidades principales son recibir,
              responder y dar seguimiento a mensajes enviados por el formulario de contacto. Las
              finalidades secundarias son medición estadística, analítica y mejora del sitio. Esta
              clasificación debe ser revisada por asesoría legal antes de publicar.
            </p>
          </LegalSection>

          <LegalSection title="2.4 Google Analytics y cookies">
            <p>
              Ludora usa Google Analytics para medir tráfico y uso del sitio. Google Analytics puede
              recopilar información de uso mediante cookies, identificadores o tecnologías
              similares.
            </p>
            <p>Google explica cómo usa información de sitios y aplicaciones que utilizan sus servicios en:</p>
            <p>
              <a
                href="https://www.google.com/policies/privacy/partners/"
                className="text-fuchsia-200 underline decoration-fuchsia-400/60 underline-offset-4 transition-colors hover:text-white"
                target="_blank"
                rel="noreferrer"
              >
                https://www.google.com/policies/privacy/partners/
              </a>
            </p>
            <p>
              Puedes configurar tu navegador para bloquear o eliminar cookies. Algunas funciones del
              sitio podrían no operar igual si bloqueas ciertas tecnologías.
            </p>
          </LegalSection>

          <LegalSection title="2.5 Terceros">
            <p>Ludora no vende datos personales y no comparte datos personales para publicidad comportamental.</p>
            <p>Ludora no participa actualmente en redes de afiliados ni recibe compensación por enlaces a tiendas.</p>
            <p>
              El formulario de contacto no envía información a proveedores externos de correo,
              soporte o tickets.
            </p>
            <p>
              Cuando haces clic en enlaces externos, tu navegador puede comunicarse directamente con
              tiendas, plataformas de video u otros sitios de terceros. Esos terceros tratan
              información bajo sus propias políticas de privacidad.
            </p>
          </LegalSection>

          <LegalSection title="2.6 Alcance geográfico">
            <p>Ludora está dirigido principalmente a México.</p>
            <p>
              El sitio puede estar disponible desde otros países, pero Ludora no garantiza que el
              sitio, el catálogo, las tiendas enlazadas, los precios, la disponibilidad, el contenido
              o este Aviso de Privacidad cumplan con los requisitos legales o comerciales de otros
              países.
            </p>
          </LegalSection>

          <LegalSection title="2.7 Conservación">
            <p>
              Ludora conserva la información del formulario de contacto durante el tiempo necesario
              para responder y dar seguimiento al mensaje, y durante el tiempo adicional que sea
              necesario para cumplir obligaciones legales, resolver disputas o proteger derechos.
            </p>
            <p>
              Por decisión de producto, este Aviso no expone detalles técnicos de infraestructura,
              registros internos, respaldos o configuraciones del sistema.
            </p>
          </LegalSection>

          <LegalSection title="2.8 Seguridad">
            <p>
              Ludora usa medidas razonables para proteger la información del formulario de contacto
              contra acceso, pérdida, uso indebido, alteración o divulgación no autorizada.
            </p>
            <p>Ningún sitio web, sistema o transmisión por internet es completamente seguro.</p>
          </LegalSection>

          <LegalSection title="2.9 Derechos ARCO y contacto">
            <p>
              Conforme a la legislación mexicana aplicable, puedes solicitar acceso, rectificación,
              cancelación u oposición respecto de tus datos personales, conocidos como derechos
              ARCO.
            </p>
            <p>
              Para ejercer estos derechos o hacer preguntas de privacidad, usa el formulario de
              contacto disponible en el sitio.
            </p>
            <p>
              Tu solicitud debe incluir información suficiente para identificar el mensaje o dato
              relacionado con tu solicitud y un medio para responderte. Ludora podrá pedir
              información adicional razonable para confirmar la solicitud cuando sea necesario.
            </p>
          </LegalSection>

          <LegalSection title="2.10 Cambios al Aviso de Privacidad">
            <p>
              Ludora puede actualizar este Aviso de Privacidad ocasionalmente. La versión actualizada
              se publicará en el sitio con una nueva fecha de "Última actualización".
            </p>
            <p>Ludora no enviará notificaciones individuales de cambios al Aviso de Privacidad.</p>
          </LegalSection>

          <LegalSection title="2.11 Leyes mexicanas de protección de datos">
            <p>
              Este Aviso toma como referencia la Ley Federal de Protección de Datos Personales en
              Posesión de los Particulares vigente, su Reglamento y las demás disposiciones
              mexicanas aplicables en materia de protección de datos personales.
            </p>
          </LegalSection>
        </div>
      </main>
    </div>
  );
}
