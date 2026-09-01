import type { Metadata } from "next"
import Link from "next/link"

// TODO: reemplazar por el email de contacto real antes de publicar
const CONTACT_EMAIL = "admin@laia.ar"

export const metadata: Metadata = {
  title: "Política de Privacidad - Calíope",
  description: "Política de privacidad de Calíope",
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAFAFA" }}>
      <div className="max-w-3xl mx-auto px-6 py-16 text-gray-700">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Política de Privacidad</h1>
        <p className="text-sm text-gray-500 mb-10">Última actualización: agosto de 2026</p>

        <section className="space-y-4 mb-10">
          <h2 className="text-xl font-semibold text-gray-900">1. Quiénes somos</h2>
          <p>
            Calíope es un editor de markdown con funciones de inteligencia artificial para la
            generación de preguntas que acompañan el proceso de escritura. Si tenés consultas sobre
            esta política, podés escribirnos a{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:text-blue-800 underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-xl font-semibold text-gray-900">2. Datos que recopilamos</h2>
          <p>Cuando iniciás sesión con tu cuenta de Google, recopilamos y almacenamos:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Nombre y dirección de correo electrónico de tu cuenta de Google.</li>
            <li>Tu identificador único de Google (Google ID).</li>
            <li>Un token de actualización (refresh token) que nos permite actuar en tu nombre solo
              para las funciones que autorizaste.</li>
          </ul>
          <p>
            Además, almacenamos los documentos y prompts que creás dentro de la aplicación.
          </p>
          <p>
            Si usás las funciones de integración con Google Classroom, accedemos — solo con tu
            autorización explícita — a tus cursos, tareas y materiales de Classroom, y a los
            documentos de Google Docs que la propia aplicación crea en tu Drive.
          </p>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-xl font-semibold text-gray-900">3. Cómo usamos los datos de Google</h2>
          <p>Usamos los permisos (scopes) de Google exclusivamente para:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>openid, email, profile:</strong> autenticarte y crear tu cuenta en Calíope.
            </li>
            <li>
              <strong>classroom.courses.readonly:</strong> listar tus cursos de Google Classroom para
              que puedas asociarlos a sesiones de escritura.
            </li>
            <li>
              <strong>classroom.coursework.students y classroom.coursework.me:</strong> crear tareas
              (coursework), consultar entregas y adjuntar documentos a las entregas de los
              estudiantes.
            </li>
            <li>
              <strong>classroom.courseworkmaterials:</strong> publicar materiales de trabajo en tus
              cursos.
            </li>
            <li>
              <strong>drive.file:</strong> crear documentos de Google Docs desde la aplicación,
              editarlos y compartirlos. Este permiso solo alcanza a los archivos creados por la
              propia aplicación; no podemos ver ni modificar otros archivos de tu Drive.
            </li>
          </ul>
          <p>
            No usamos los datos de Google para publicidad, no los vendemos ni los compartimos con
            terceros con fines comerciales.
          </p>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-xl font-semibold text-gray-900">4. Servicios de terceros</h2>
          <p>
            Para generar preguntas, el texto que escribís (o el fragmento que seleccionás) se envía
            a OpenRouter, un proveedor de modelos de lenguaje, junto con el prompt elegido. Ese
            contenido se utiliza únicamente para generar la respuesta y no se almacena en nuestros
            servidores más allá de tus propios documentos.
          </p>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-xl font-semibold text-gray-900">5. Almacenamiento y seguridad</h2>
          <p>
            Los datos se almacenan en nuestros servidores y se transmiten cifrados mediante HTTPS.
            El token de actualización de Google se guarda asociado a tu cuenta y se usa solo para
            las funciones de integración que autorizaste.
          </p>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-xl font-semibold text-gray-900">6. Eliminación de datos</h2>
          <p>
            Podés revocar el acceso de Calíope a tu cuenta de Google en cualquier momento desde la{" "}
            <a
              href="https://myaccount.google.com/permissions"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              configuración de permisos de tu cuenta de Google
            </a>
            . Si querés que eliminemos tu cuenta y todos tus datos de nuestros servidores,
            escribinos a{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:text-blue-800 underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-xl font-semibold text-gray-900">7. Cambios a esta política</h2>
          <p>
            Si modificamos esta política, publicaremos la versión actualizada en esta misma página
            indicando la fecha de la última actualización.
          </p>
        </section>

        <Link href="/" className="text-blue-600 hover:text-blue-800 underline text-sm">
          Volver a Calíope
        </Link>
      </div>
    </div>
  )
}
