'use client';

import { useState } from 'react';
import { CheckIcon, CopyIcon } from './icons';

export type TransferData = {
  bank: string;
  accountType: string;
  accountNumber: string;
  holder: string;
  taxId: string;
  email: string;
  notes: string;
};

type Dato = { label: string; value: string };

/**
 * Los datos de la cuenta, listos para copiar.
 *
 * Ocho filas de ancho completo, una debajo de la otra, se comian un tercio de
 * la pantalla del telefono y dejaban media pagina vacia en el escritorio. El
 * bloque es importante, pero no es la pagina.
 *
 * Asi que se ordena por lo que de verdad cuesta: arriba, los tres datos que
 * hay que escribir con cuidado (el numero de cuenta, el monto exacto y el
 * mensaje que identifica el pedido); debajo, el resto en dos columnas y en
 * filas de una linea. Y un boton que copia todo de una vez, que es lo que uno
 * quiere cuando tiene la aplicacion del banco abierta al lado.
 */
export function TransferDetails({
  data,
  reference,
  amount,
}: {
  data: TransferData;
  /** Numero de pedido, que va como comentario de la transferencia. */
  reference?: string;
  amount?: string;
}) {
  const limpio = (lista: Dato[]) => lista.filter((dato) => dato.value.trim());

  const claves = limpio([
    { label: 'Numero de cuenta', value: data.accountNumber },
    ...(amount ? [{ label: 'Monto exacto', value: amount }] : []),
    ...(reference ? [{ label: 'Mensaje', value: reference }] : []),
  ]);

  const resto = limpio([
    { label: 'Banco', value: data.bank },
    { label: 'Tipo de cuenta', value: data.accountType },
    { label: 'Titular', value: data.holder },
    { label: 'RUT', value: data.taxId },
    { label: 'Correo', value: data.email },
  ]);

  const todo = [...claves, ...resto].map((dato) => `${dato.label}: ${dato.value}`).join('\n');

  return (
    <div className="border border-sand-dark bg-white">
      {claves.length > 0 ? (
        <div
          className={`grid divide-y divide-sand-dark border-b border-sand-dark sm:divide-x sm:divide-y-0 ${
            claves.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
          }`}
        >
          {claves.map((dato) => (
            <Destacado key={dato.label} label={dato.label} value={dato.value} />
          ))}
        </div>
      ) : null}

      <dl className="grid divide-y divide-sand-dark sm:grid-cols-2 sm:divide-y-0">
        {resto.map((dato, indice) => (
          <Fila
            key={dato.label}
            label={dato.label}
            value={dato.value}
            // En dos columnas la linea divisoria se dibuja por fila y no por
            // celda: si no, queda una reja en vez de una lista.
            borde={indice >= 2}
          />
        ))}
      </dl>

      <CopiarTodo texto={todo} />

      {data.notes.trim() ? (
        <p className="border-t border-sand-dark bg-sand px-4 py-3 text-xs leading-relaxed text-ink-soft sm:px-5">
          {data.notes}
        </p>
      ) : null}
    </div>
  );
}

/** Copiar al portapapeles, con el aviso de que se copio. */
function useCopiar(value: string) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(value);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sin permiso para el portapapeles el dato sigue a la vista y se puede
      // seleccionar a mano: no hace falta avisar de nada.
    }
  }

  return { copiado, copiar };
}

function Destacado({ label, value }: Dato) {
  const { copiado, copiar } = useCopiar(value);

  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={`Copiar ${label}`}
      className="flex items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-sand"
    >
      <span className="min-w-0">
        <span className="block text-[10px] uppercase tracking-widest text-ink-muted">{label}</span>
        <span className="mt-0.5 block break-words font-display text-base font-semibold leading-tight tabular-nums sm:text-lg">
          {value}
        </span>
      </span>
      <Aviso copiado={copiado} />
    </button>
  );
}

function Fila({ label, value, borde }: Dato & { borde: boolean }) {
  const { copiado, copiar } = useCopiar(value);

  return (
    <div className={borde ? 'sm:border-t sm:border-sand-dark' : ''}>
      <button
        type="button"
        onClick={copiar}
        aria-label={`Copiar ${label}`}
        className="flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-sand"
      >
        <dt className="shrink-0 text-[11px] uppercase tracking-wide text-ink-muted">{label}</dt>
        <dd className="flex min-w-0 items-baseline gap-2">
          {/* Se parte en vez de recortarse (un correo cortado obliga a copiarlo
              para saber cual es), pero por palabras: `break-all` dejaba al
              titular como "Comercializadora Nomad Bre / w SpA". */}
          <span className="break-words text-right text-sm">{value}</span>
          <Aviso copiado={copiado} />
        </dd>
      </button>
    </div>
  );
}

function Aviso({ copiado, className = '' }: { copiado: boolean; className?: string }) {
  return copiado ? (
    <span
      className={`flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-700 ${className}`}
    >
      <CheckIcon className="h-3 w-3" />
      Listo
    </span>
  ) : (
    <CopyIcon aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 text-ink-muted ${className}`} />
  );
}

function CopiarTodo({ texto }: { texto: string }) {
  const { copiado, copiar } = useCopiar(texto);

  return (
    <button
      type="button"
      onClick={copiar}
      className="flex w-full items-center justify-center gap-2 border-t border-sand-dark bg-sand px-4 py-3 font-display text-xs font-semibold uppercase tracking-widest text-ink-soft transition-colors hover:text-brand"
    >
      {copiado ? (
        <>
          <CheckIcon className="h-3.5 w-3.5 text-emerald-700" />
          <span className="text-emerald-700">Datos copiados</span>
        </>
      ) : (
        <>
          <CopyIcon className="h-3.5 w-3.5" />
          Copiar todos los datos
        </>
      )}
    </button>
  );
}
