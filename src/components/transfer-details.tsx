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

/**
 * Los datos de la cuenta, listos para copiar.
 *
 * Quien transfiere los va a copiar uno por uno en la aplicacion del banco, y
 * copiar a mano un numero de cuenta de doce digitos desde el telefono es
 * justo donde se equivoca la gente.
 *
 * La fila entera copia, no un boton al costado: en el telefono ese boton le
 * robaba el ancho al dato y el titular terminaba partido en dos lineas. Asi el
 * dato ocupa todo lo que necesita y el area que se toca es la fila completa,
 * que es lo que uno intenta tocar igual.
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
  const filas = [
    { label: 'Banco', value: data.bank },
    { label: 'Tipo de cuenta', value: data.accountType },
    { label: 'Numero de cuenta', value: data.accountNumber, destacado: true },
    { label: 'Titular', value: data.holder },
    { label: 'RUT', value: data.taxId },
    { label: 'Correo para el comprobante', value: data.email },
    ...(amount ? [{ label: 'Monto a transferir', value: amount, destacado: true }] : []),
    ...(reference ? [{ label: 'Mensaje o comentario', value: reference, destacado: true }] : []),
  ].filter((fila) => fila.value.trim());

  return (
    <div className="border border-sand-dark bg-white">
      <ul className="divide-y divide-sand-dark">
        {filas.map((fila) => (
          <Fila key={fila.label} label={fila.label} value={fila.value} destacado={fila.destacado} />
        ))}
      </ul>

      <p className="border-t border-sand-dark px-4 py-2.5 text-[11px] uppercase tracking-widest text-ink-muted sm:px-5">
        <span className="sm:hidden">Toca cada dato para copiarlo</span>
        <span className="hidden sm:inline">Haz clic en cada dato para copiarlo</span>
      </p>

      {data.notes.trim() ? (
        <p className="border-t border-sand-dark bg-sand px-4 py-4 text-sm leading-relaxed text-ink-soft sm:px-5">
          {data.notes}
        </p>
      ) : null}
    </div>
  );
}

function Fila({
  label,
  value,
  destacado = false,
}: {
  label: string;
  value: string;
  destacado?: boolean;
}) {
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

  return (
    <li>
      <button
        type="button"
        onClick={copiar}
        aria-label={`Copiar ${label}`}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sand sm:px-5"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-ink-muted">{label}</span>
            {copiado ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-700">
                <CheckIcon className="h-3 w-3" />
                Copiado
              </span>
            ) : null}
          </span>
          <span
            className={`mt-0.5 block break-words ${
              destacado
                ? 'font-display text-lg font-semibold leading-tight tabular-nums'
                : 'text-sm leading-snug'
            }`}
          >
            {value}
          </span>
        </span>

        <CopyIcon
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 transition-colors ${
            copiado ? 'text-emerald-700' : 'text-ink-muted'
          }`}
        />
      </button>
    </li>
  );
}
