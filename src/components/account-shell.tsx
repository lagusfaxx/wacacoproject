import Link from 'next/link';
import { AccountNav } from './account-nav';

/**
 * Marco comun de las paginas de la cuenta: saludo, barra de secciones y el
 * aviso de correo sin confirmar.
 *
 * Lo usan todas las paginas privadas de /cuenta. Las de acceso (ingresar,
 * registro, recuperar) no lo usan, porque ahi todavia no hay una cuenta que
 * mostrar.
 */
export function AccountShell({
  user,
  title,
  description,
  children,
}: {
  user: { name: string; email: string; role: string; emailVerified: boolean };
  /** Titulo de la seccion. En el resumen se omite y manda el saludo. */
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container-site py-12">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight">
          Hola, {user.name.split(' ')[0]}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">{user.email}</p>
      </div>

      <AccountNav isAdmin={user.role === 'ADMIN'} />

      {!user.emailVerified ? (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm text-amber-900">
            Tu correo todavia no esta confirmado. Confirmalo para asegurarte de recibir los
            comprobantes y los avisos de despacho.
          </p>
          <Link href="/cuenta/verificar?next=/cuenta" className="btn-dark btn-sm py-2.5">
            Confirmar correo
          </Link>
        </div>
      ) : null}

      {title ? (
        <div className="mt-10">
          <h2 className="section-title text-2xl">{title}</h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm text-ink-muted">{description}</p>
          ) : null}
        </div>
      ) : null}

      <div className={title ? 'mt-8' : 'mt-10'}>{children}</div>
    </div>
  );
}
