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

export function TermsOfService() {
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
            <span className="text-sm text-white">Términos de Servicio</span>
          </div>
        }
      />

      <main className="mx-auto max-w-4xl px-6 py-12 lg:px-8">
        <p className="text-sm font-medium uppercase text-fuchsia-300">Documento legal</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
          Términos de Servicio
        </h1>
        <p className="mt-4 text-sm leading-6 text-neutral-400">
          Última actualización: 21 de agosto de 2026
        </p>

        <div className="mt-8 space-y-4 text-base leading-7 text-neutral-300">
          <p>
            Estos Términos de Servicio regulan el uso de Ludo Radar, un sitio web que ayuda a las
            personas a descubrir juegos de mesa y expansiones, consultar información de catálogo,
            ver enlaces de tutoriales y encontrar enlaces a tiendas externas.
          </p>
          <p>
            Al usar Ludo Radar, aceptas estos Términos. Si no estás de acuerdo, no uses el sitio.
          </p>
        </div>

        <div className="mt-10 space-y-8">
          <LegalSection title="1.1 Qué es Ludo Radar">
            <p>
              Ludo Radar es una plataforma de descubrimiento y catálogo enfocada en juegos de mesa y
              expansiones, especialmente para personas en México.
            </p>
            <p>El sitio permite:</p>
            <BulletList
              items={[
                "Explorar un catálogo curado de juegos de mesa y expansiones.",
                "Buscar y filtrar juegos por nombre, jugadores, duración, complejidad, categorías y mecánicas.",
                "Consultar páginas de detalle con información del juego.",
                "Ver enlaces a tutoriales o contenido externo, como YouTube o TikTok.",
                "Ver enlaces a tiendas externas donde el producto puede estar disponible.",
                "Enviar mensajes por medio del formulario de contacto.",
              ]}
            />
          </LegalSection>

          <LegalSection title="1.2 Ludo Radar no es una tienda">
            <p>
              Ludo Radar no vende productos directamente, no procesa pagos, no gestiona envíos, no crea
              órdenes de compra y no maneja devoluciones, garantías o soporte postventa de tiendas
              externas.
            </p>
            <p>
              Cuando haces clic en un enlace de tienda, sales de Ludo Radar y visitas un sitio de un
              tercero. Cualquier compra, precio, impuesto, envío, disponibilidad, garantía,
              devolución o reclamación se rige por los términos y políticas de esa tienda.
            </p>
          </LegalSection>

          <LegalSection title="1.3 Información de catálogo, precio y disponibilidad">
            <p>
              Ludo Radar muestra información de juegos, expansiones, editoriales, autores, categorías,
              mecánicas, calificaciones, tutoriales, precios, disponibilidad y tiendas a partir de
              datos curados y fuentes externas.
            </p>
            <p>
              La información puede estar incompleta, desactualizada o contener errores. Los precios,
              existencias, promociones, tiempos de entrega y condiciones de compra pueden cambiar
              sin aviso.
            </p>
            <p>Antes de comprar, debes confirmar directamente con la tienda:</p>
            <BulletList
              items={[
                "Precio final.",
                "Moneda.",
                "Disponibilidad real.",
                "Costos de envío.",
                "Impuestos.",
                "Políticas de devolución.",
                "Condición, idioma, edición y componentes del producto.",
              ]}
            />
          </LegalSection>

          <LegalSection title="1.4 Enlaces y servicios de terceros">
            <p>
              Ludo Radar puede enlazar o mostrar contenido de terceros, incluyendo tiendas,
              BoardGameGeek, YouTube, TikTok, Google Analytics y otros servicios externos.
            </p>
            <p>Ludo Radar no controla esos servicios y no es responsable por:</p>
            <BulletList
              items={[
                "Sus términos, políticas o prácticas de privacidad.",
                "Sus precios, productos, disponibilidad o promociones.",
                "Sus videos, publicaciones, imágenes, datos o recomendaciones.",
                "Sus fallas, errores, cambios, interrupciones o decisiones comerciales.",
              ]}
            />
            <p>
              Debes revisar los términos y políticas de cada tercero antes de usar sus servicios o
              comprar productos.
            </p>
          </LegalSection>

          <LegalSection title="1.5 Relaciones comerciales">
            <p>
              Ludo Radar actualmente no recibe comisiones de afiliado, pagos por referido, patrocinios,
              productos gratis, descuentos, publicidad, colocación pagada ni otra compensación por
              mostrar o enlazar productos.
            </p>
          </LegalSection>

          <LegalSection title="1.6 Uso permitido">
            <p>
              Puedes usar Ludo Radar para fines personales, informativos y no comerciales, siempre que
              cumplas estos Términos y la ley aplicable.
            </p>
            <p>No puedes:</p>
            <BulletList
              items={[
                "Usar Ludo Radar para actividades ilegales, fraudulentas, abusivas o dañinas.",
                "Interferir con la seguridad, disponibilidad o funcionamiento del sitio.",
                "Intentar acceder a sistemas, datos o cuentas sin autorización.",
                "Enviar código malicioso, spam, mensajes ofensivos o contenido ilegal.",
                "Sobrecargar, hacer scraping, extraer o automatizar solicitudes al sitio.",
                "Copiar, vender, sublicenciar, reproducir o explotar comercialmente el contenido o software de Ludo Radar.",
                "Usar Ludo Radar para enviar datos personales sensibles, información confidencial o datos de terceros sin permiso.",
              ]}
            />
            <p>
              Ludo Radar puede limitar solicitudes, bloquear tráfico o suspender funcionalidades para
              proteger el servicio.
            </p>
          </LegalSection>

          <LegalSection title="1.7 Formulario de contacto">
            <p>
              El formulario de contacto solicita nombre, correo electrónico y mensaje. La
              información se conserva para responder el mensaje y dar seguimiento a la solicitud.
            </p>
            <p>
              El formulario no envía información a sistemas externos, no crea tickets en proveedores
              externos y no se integra con servicios externos de correo o soporte.
            </p>
            <p>
              No debes enviar datos personales sensibles, información confidencial o datos de
              terceros que no sean necesarios para atender tu mensaje.
            </p>
          </LegalSection>

          <LegalSection title="1.8 Propiedad intelectual">
            <p>
              Ludo Radar conserva todos los derechos sobre el sitio, software, interfaz, diseño, marca,
              textos originales, lógica de búsqueda y demás materiales propios.
            </p>
            <p>
              Los nombres de juegos, imágenes, marcas, logotipos, videos, datos de terceros y
              contenido enlazado pertenecen a sus respectivos titulares.
            </p>
            <p>
              Salvo que la ley lo permita o Ludo Radar lo autorice por escrito, no puedes copiar,
              modificar, distribuir, vender, publicar, crear obras derivadas, hacer ingeniería
              inversa o explotar el sitio o sus materiales.
            </p>
          </LegalSection>

          <LegalSection title="1.9 Disponibilidad y cambios al servicio">
            <p>
              Ludo Radar puede modificar, suspender o descontinuar cualquier parte del sitio en
              cualquier momento, incluyendo catálogo, búsqueda, enlaces, filtros, formularios o
              páginas legales.
            </p>
            <p>
              Ludo Radar no garantiza que el sitio esté disponible sin interrupciones, errores, retrasos
              o fallas.
            </p>
          </LegalSection>

          <LegalSection title="1.10 Descargos de responsabilidad">
            <p>Ludo Radar se proporciona "tal cual" y "según disponibilidad".</p>
            <p>
              En la máxima medida permitida por la ley, Ludo Radar no otorga garantías de ningún tipo,
              expresas o implícitas, incluyendo garantías de exactitud, disponibilidad, idoneidad
              para un propósito particular, no infracción o funcionamiento sin errores.
            </p>
            <p>Ludo Radar no garantiza:</p>
            <BulletList
              items={[
                "Que los datos del catálogo sean completos o correctos.",
                "Que una tienda tenga inventario disponible.",
                "Que un precio mostrado siga vigente.",
                "Que un enlace externo funcione.",
                "Que un tutorial sea correcto o seguro.",
                "Que una compra externa cumpla tus expectativas.",
              ]}
            />
          </LegalSection>

          <LegalSection title="1.11 Ley aplicable y protección de datos">
            <p>
              Estos Términos y el uso de Ludo Radar se interpretarán conforme a las leyes aplicables en
              México, en la medida que correspondan al servicio y a las personas usuarias.
            </p>
            <p>
              En materia de datos personales, Ludo Radar toma como referencia la Ley Federal de
              Protección de Datos Personales en Posesión de los Particulares vigente, su Reglamento
              y las demás disposiciones mexicanas aplicables en materia de protección de datos
              personales.
            </p>
          </LegalSection>

          <LegalSection title="1.12 Cambios a estos Términos">
            <p>
              Ludo Radar puede actualizar estos Términos ocasionalmente. La versión actualizada se
              publicará en el sitio con una nueva fecha de "Última actualización".
            </p>
            <p>
              El uso continuado del sitio después de la publicación de cambios significa que aceptas
              los Términos actualizados, en la medida permitida por la ley.
            </p>
          </LegalSection>

          <LegalSection title="1.13 Contacto">
            <p>Para preguntas sobre estos Términos, usa el formulario de contacto disponible en el sitio.</p>
          </LegalSection>
        </div>
      </main>
    </div>
  );
}
