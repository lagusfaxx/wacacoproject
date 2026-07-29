'use client';

import { useState } from 'react';
import { CheckIcon } from './icons';

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
 * justo donde se equivoca la gente. Cada dato tiene su boton.
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

      {data.notes.trim() ? (
        <p className="border-t border-sand-dark bg-sand px-5 py-4 text-sm leading-relaxed text-ink-soft">
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
    <li className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
        <p
          className={`mt-0.5 break-all ${
            destacado ? 'font-display text-lg font-semibold tabular-nums' : 'text-sm'
          }`}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={copiar}
        aria-label={`Copiar ${label}`}
        className="shrink-0 border border-sand-dark px-3 py-2 text-xs font-semibold uppercase tracking-widest text-ink-soft transition-colors hover:border-ink hover:text-ink"
      >
        {copiado ? (
          <span className="flex items-center gap-1.5 text-emerald-700">
            <CheckIcon className="h-3.5 w-3.5" />
            Copiado
          </span>
        ) : (
          'Copiar'
        )}
      </button>
    </li>
  );
}
