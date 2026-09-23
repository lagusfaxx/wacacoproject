'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createMcpKey, type McpKeyState } from '@/app/actions/mercadolibre';

const initialState: McpKeyState = { status: 'idle', message: '' };

export function McpKeyForm({ endpoint }: { endpoint: string }) {
  const [state, formAction] = useActionState(createMcpKey, initialState);
  const [copied, setCopied] = useState(false);

  const command = state.token
    ? `claude mcp add --transport http mercadolibre ${endpoint} --header "Authorization: Bearer ${state.token}"`
    : '';

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <div>
          <label className="label" htmlFor="mcp-name">
            Nombre
          </label>
          <input id="mcp-name" name="name" required maxLength={60} placeholder="Claude Code (mi notebook)" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="mcp-exp">
            Vence en
          </label>
          <select id="mcp-exp" name="expiresInDays" className="field" defaultValue="90">
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
            <option value="365">1 ano</option>
            <option value="0">Nunca</option>
          </select>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="write" className="mt-0.5 h-4 w-4 accent-[#E1580E]" />
          <span>Permitir cambios (precios, stock, estado, preguntas, promociones). Sin marcar: solo lectura.</span>
        </label>
        <Submit />
      </form>

      {state.message ? (
        <p className={`text-sm ${state.status === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>{state.message}</p>
      ) : null}

      {state.token ? (
        <div className="space-y-3 border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-semibold">Clave (solo se muestra esta vez):</p>
          <code className="block break-all bg-white p-2 font-mono text-xs">{state.token}</code>
          <p className="font-semibold">Para Claude Code:</p>
          <code className="block break-all bg-white p-2 font-mono text-xs">{command}</code>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              void navigator.clipboard.writeText(command).then(() => setCopied(true));
            }}
          >
            {copied ? 'Copiado' : 'Copiar comando'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? 'Creando...' : 'Crear clave'}
    </button>
  );
}
