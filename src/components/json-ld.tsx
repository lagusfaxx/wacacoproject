/**
 * Datos estructurados schema.org.
 *
 * Son los que permiten a Google mostrar precio, disponibilidad y migas de pan
 * directamente en el resultado de busqueda. Se emiten como JSON, no como HTML,
 * asi que no hay riesgo de inyeccion mas alla de cerrar la etiqueta script:
 * por eso se escapa `<`.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  return (
    <script
      type="application/ld+json"
      // El contenido es JSON serializado por nosotros, nunca texto del usuario
      // sin procesar.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
