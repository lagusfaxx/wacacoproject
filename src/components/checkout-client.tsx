'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { startCheckout, type CheckoutState } from '@/app/actions/checkout';
import { ShieldIcon, StoreIcon, TruckIcon } from './icons';
import { TransferDetails, type TransferData } from './transfer-details';

const initialState: CheckoutState = { status: 'idle', message: '', errors: {} };

/** Punto de retiro tal como lo ve el comprador. */
export type PickupData = {
  place: string;
  address: string;
  commune: string;
  region: string;
  hours: string;
  notes: string;
};

export type CheckoutDefaults = {
  email: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  regionCode: string;
  postalCode: string;
  country: string;
};

export type SummaryLine = {
  key: string;
  name: string;
  variantName: string | null;
  quantity: number;
  image: string | null;
  lineTotalLabel: string;
};

export type SummaryLabels = {
  subtotalLabel: string;
  discountLabel: string | null;
  couponCode: string | null;
  shippingLabel: string | null;
  taxLabel: string | null;
  totalLabel: string;
  carrier: string;
  serviceName: string;
  promiseDays: number | null;
  notice: string | null;
  source: string;
};

type Region = { code: string; name: string };

export function CheckoutClient({
  defaults,
  lines,
  initialSummary,
  regions,
  bluexEnabled,
  paymentLogoUrl = null,
  transfer = null,
  pickup = null,
  transferHoldHours = 48,
}: {
  defaults: CheckoutDefaults;
  lines: SummaryLine[];
  initialSummary: SummaryLabels;
  regions: Region[];
  bluexEnabled: boolean;
  /** Logo del medio de pago subido desde el panel. */
  paymentLogoUrl?: string | null;
  /** Datos de la cuenta, si la tienda acepta transferencia. */
  transfer?: TransferData | null;
  /** Punto de retiro, si la tienda lo ofrece. */
  pickup?: PickupData | null;
  /** Horas que se reserva el pedido al pagar por transferencia. */
  transferHoldHours?: number;
}) {
  const [state, formAction] = useActionState(startCheckout, initialState);
  const [regionCode, setRegionCode] = useState(defaults.regionCode);
  const [commune, setCommune] = useState(defaults.city);
  const [summary, setSummary] = useState<SummaryLabels>(initialSummary);
  const [quoting, setQuoting] = useState(false);
  const [method, setMethod] = useState<'mercadopago' | 'transferencia'>('mercadopago');
  const [delivery, setDelivery] = useState<'despacho' | 'retiro'>('despacho');
  const retiro = delivery === 'retiro';

  // Cada cotizacion cancela la anterior: al escribir la comuna se disparan
  // varias y solo interesa la ultima.
  const requestRef = useRef(0);

  const requestQuote = useCallback(
    async (nextRegion: string, nextCommune: string, nextDelivery: 'despacho' | 'retiro') => {
      // Al retirar no hay destino que cotizar, pero si hay que refrescar el
      // total: el envio deja de sumar.
      if (nextDelivery !== 'retiro' && (!nextRegion || nextCommune.trim().length < 2)) return;

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setQuoting(true);

    try {
      const response = await fetch('/api/envio/cotizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regionCode: nextRegion,
          commune: nextCommune.trim(),
          deliveryMethod: nextDelivery,
        }),
      });

      if (requestRef.current !== requestId) return;
      if (!response.ok) return;

      const data = await response.json();
      if (requestRef.current !== requestId) return;

      setSummary((current) => ({
        ...current,
        subtotalLabel: data.subtotalLabel ?? current.subtotalLabel,
        discountLabel: data.discountLabel ?? null,
        shippingLabel: data.shippingLabel ?? null,
        taxLabel: data.taxLabel ?? null,
        totalLabel: data.totalLabel ?? current.totalLabel,
        carrier: data.carrier ?? current.carrier,
        serviceName: data.serviceName ?? current.serviceName,
        promiseDays: data.promiseDays ?? null,
        notice: data.notice ?? null,
        source: data.source ?? current.source,
      }));
    } catch {
      // Un fallo de red no debe bloquear la compra: al confirmar, el servidor
      // vuelve a cotizar de todas formas.
    } finally {
      if (requestRef.current === requestId) setQuoting(false);
    }
    },
    [],
  );

  // Espera a que el comprador deje de escribir antes de consultar la tarifa.
  // Cambiar entre despacho y retiro no es escribir: eso se refleja al toque.
  const lastDeliveryRef = useRef(delivery);

  useEffect(() => {
    const cambioDeEntrega = lastDeliveryRef.current !== delivery;
    lastDeliveryRef.current = delivery;

    const timer = setTimeout(
      () => {
        void requestQuote(regionCode, commune, delivery);
      },
      cambioDeEntrega ? 0 : 700,
    );
    return () => clearTimeout(timer);
  }, [regionCode, commune, delivery, requestQuote]);

  return (
    <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px]">
      <form action={formAction} className="space-y-10" noValidate>
        {state.message ? (
          <p role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.message}
          </p>
        ) : null}

        <section>
          <h2 className="font-display text-lg font-bold uppercase tracking-tight">Contacto</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field
              label="Correo electronico"
              name="email"
              type="email"
              defaultValue={defaults.email}
              error={state.errors.email}
              autoComplete="email"
              required
              hint="Ahi te enviaremos la confirmacion y el seguimiento."
            />
            <Field
              label="Telefono"
              name="phone"
              type="tel"
              defaultValue={defaults.phone}
              error={state.errors.phone}
              autoComplete="tel"
              required
            />
          </div>
        </section>

        {pickup ? (
          <section>
            <h2 className="font-display text-lg font-bold uppercase tracking-tight">
              Como recibes tu pedido
            </h2>

            <input type="hidden" name="deliveryMethod" value={delivery} />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <OpcionEntrega
                seleccionado={!retiro}
                onSelect={() => setDelivery('despacho')}
                icono={<TruckIcon className="h-5 w-5" />}
                titulo="Despacho a domicilio"
                descripcion="Lo enviamos a tu direccion. El costo se calcula con tu comuna."
              />
              <OpcionEntrega
                seleccionado={retiro}
                onSelect={() => setDelivery('retiro')}
                icono={<StoreIcon className="h-5 w-5" />}
                titulo="Retiro en tienda"
                descripcion="Sin costo de envio. Te avisamos por correo cuando este listo."
              />
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="font-display text-lg font-bold uppercase tracking-tight">
            {retiro ? 'Quien retira' : 'Direccion de envio'}
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                label={retiro ? 'Nombre de quien retira' : 'Nombre de quien recibe'}
                name="fullName"
                defaultValue={defaults.fullName}
                error={state.errors.fullName}
                autoComplete="name"
                required
                hint={retiro ? 'Pide el pedido con este nombre y el numero de pedido.' : undefined}
              />
            </div>

            {/* Los campos de direccion se desmontan al retirar: no se envian, y
                asi el navegador no ofrece autocompletar algo que nadie usara. */}
            {!retiro ? (
              <>
                <div className="sm:col-span-2">
                  <Field
                    label="Calle y numero"
                    name="line1"
                    defaultValue={defaults.line1}
                    error={state.errors.line1}
                    autoComplete="address-line1"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Field
                    label="Departamento, oficina (opcional)"
                    name="line2"
                    defaultValue={defaults.line2}
                    error={state.errors.line2}
                    autoComplete="address-line2"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="field-regionCode">
                    Region
                  </label>
                  <select
                    id="field-regionCode"
                    name="regionCode"
                    value={regionCode}
                    onChange={(event) => setRegionCode(event.target.value)}
                    className={`field ${state.errors.regionCode ? 'field-error' : ''}`}
                    required
                  >
                    <option value="">Selecciona tu region</option>
                    {regions.map((region) => (
                      <option key={region.code} value={region.code}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                  {state.errors.regionCode ? (
                    <span className="error-text">{state.errors.regionCode}</span>
                  ) : null}
                </div>

                <Field
                  label="Comuna"
                  name="city"
                  value={commune}
                  onChange={(event) => setCommune(event.target.value)}
                  error={state.errors.city}
                  autoComplete="address-level2"
                  required
                  hint={bluexEnabled ? 'Con esto cotizamos el envio con Blue Express.' : undefined}
                />

                <Field
                  label="Codigo postal (opcional)"
                  name="postalCode"
                  defaultValue={defaults.postalCode}
                  error={state.errors.postalCode}
                  autoComplete="postal-code"
                />

                <div>
                  <label className="label" htmlFor="field-country">
                    Pais
                  </label>
                  <select
                    id="field-country"
                    name="country"
                    defaultValue={defaults.country || 'CL'}
                    className="field"
                  >
                    <option value="CL">Chile</option>
                  </select>
                </div>
              </>
            ) : null}

            <div className="sm:col-span-2">
              <label className="label" htmlFor="field-notes">
                {retiro ? 'Notas para el retiro (opcional)' : 'Notas para el despacho (opcional)'}
              </label>
              <textarea id="field-notes" name="notes" rows={3} maxLength={500} className="field" />
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold uppercase tracking-tight">
            {retiro ? 'Donde lo retiras' : 'Envio'}
          </h2>

          {retiro && pickup ? (
            <div className="mt-5 border-2 border-ink bg-sand p-5">
              <div className="flex items-start gap-3">
                <StoreIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <div className="min-w-0">
                  {pickup.place ? (
                    <p className="font-display text-sm font-semibold uppercase tracking-widest text-ink">
                      {pickup.place}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-ink">{pickup.address}</p>
                  <p className="text-sm text-ink-muted">
                    {[pickup.commune, pickup.region].filter(Boolean).join(', ')}
                  </p>
                  {pickup.hours ? (
                    <p className="mt-2 text-sm text-ink-soft">
                      <span className="font-semibold">Horario: </span>
                      {pickup.hours}
                    </p>
                  ) : null}
                </div>
              </div>

              <p className="mt-4 border-t border-sand-dark pt-4 text-xs leading-relaxed text-ink-muted">
                {pickup.notes ||
                  'No vengas antes de que te avisemos: te escribimos por correo apenas el pedido este listo para retirar.'}
              </p>
            </div>
          ) : (
            <div className="mt-5 border border-sand-dark bg-sand p-5">
              {summary.source === 'unavailable' ? (
                <p className="text-sm font-semibold text-red-700">
                  {summary.notice ?? 'No despachamos a esta region.'}
                </p>
              ) : summary.source === 'pending' ? (
                <p className="text-sm text-ink-muted">
                  Selecciona tu region y comuna para calcular el costo del despacho.
                </p>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <TruckIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                    <div>
                      <p className="font-display text-sm font-semibold uppercase tracking-widest text-ink">
                        {summary.carrier}
                      </p>
                      <p className="mt-1 text-sm text-ink-muted">
                        {summary.serviceName}
                        {summary.promiseDays
                          ? ` · entrega estimada en ${summary.promiseDays} ${
                              summary.promiseDays === 1 ? 'dia habil' : 'dias habiles'
                            }`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <p className="font-display text-lg font-semibold">
                    {quoting ? 'Cotizando...' : (summary.shippingLabel ?? '—')}
                  </p>
                </div>
              )}

              {summary.notice && summary.source !== 'unavailable' ? (
                <p className="mt-4 border-t border-sand-dark pt-4 text-xs text-ink-muted">
                  {summary.notice}
                </p>
              ) : null}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display text-lg font-bold uppercase tracking-tight">
            Como quieres pagar
          </h2>

          <input type="hidden" name="paymentMethod" value={method} />

          <div className="mt-5 space-y-3">
            <MetodoPago
              seleccionado={method === 'mercadopago'}
              onSelect={() => setMethod('mercadopago')}
              titulo={
                paymentLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={paymentLogoUrl}
                    alt="Mercado Pago"
                    className="h-7 w-auto max-w-[150px] object-contain"
                  />
                ) : (
                  <span className="font-display text-sm font-semibold uppercase tracking-widest">
                    Mercado Pago
                  </span>
                )
              }
              descripcion="Tarjeta de credito o debito, y las cuotas que ofrezca tu banco. Pagas en el sitio de Mercado Pago y vuelves aqui."
            />

            {transfer ? (
              <MetodoPago
                seleccionado={method === 'transferencia'}
                onSelect={() => setMethod('transferencia')}
                titulo={
                  <span className="font-display text-sm font-semibold uppercase tracking-widest">
                    Transferencia bancaria
                  </span>
                }
                descripcion={`Te damos los datos de la cuenta al confirmar. Reservamos tu pedido por ${transferHoldHours} horas y lo preparamos apenas veamos la transferencia.`}
              >
                {method === 'transferencia' ? (
                  <div className="mt-4">
                    <TransferDetails data={transfer} amount={summary.totalLabel} />
                    <p className="mt-3 text-xs text-ink-muted">
                      Al confirmar te mostramos estos mismos datos con el numero de tu pedido, y
                      te los enviamos por correo.
                    </p>
                  </div>
                ) : null}
              </MetodoPago>
            ) : null}
          </div>
        </section>

        <SubmitButton
          totalLabel={summary.totalLabel}
          disabled={quoting || summary.source === 'unavailable'}
          method={method}
        />

        <p className="text-xs leading-relaxed text-ink-muted">
          Al confirmar tu pedido aceptas los terminos y condiciones y la politica de privacidad de
          la tienda.
        </p>
      </form>

      <aside className="lg:order-last">
        <div className="border border-sand-dark bg-sand p-6 lg:sticky lg:top-28">
          <h2 className="font-display text-lg font-bold uppercase tracking-tight">Resumen</h2>

          <dl className="mt-5 space-y-3 text-sm">
            <Row label="Subtotal" value={summary.subtotalLabel} />
            {summary.discountLabel ? (
              <Row
                label={`Descuento${summary.couponCode ? ` (${summary.couponCode})` : ''}`}
                value={`- ${summary.discountLabel}`}
                highlight
              />
            ) : null}
            <Row
              label={retiro ? 'Retiro en tienda' : 'Envio'}
              value={
                quoting
                  ? 'Cotizando...'
                  : summary.source === 'unavailable'
                    ? 'Sin despacho'
                    : summary.source === 'pending'
                      ? 'Por calcular'
                      : (summary.shippingLabel ?? '—')
              }
              highlight={summary.shippingLabel === 'Gratis' || summary.shippingLabel === 'Sin costo'}
            />
            {summary.taxLabel ? <Row label="Impuestos" value={summary.taxLabel} /> : null}
          </dl>

          <div className="mt-5 flex items-baseline justify-between border-t border-sand-dark pt-5">
            <span className="font-display text-base font-bold uppercase tracking-tight">Total</span>
            <span className="font-display text-2xl font-semibold">{summary.totalLabel}</span>
          </div>

          <ul className="mt-6 space-y-4 border-t border-sand-dark pt-5">
            {lines.map((line) => (
              <li key={line.key} className="flex gap-3">
                <div className="relative h-16 w-16 shrink-0 bg-white">
                  {line.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={line.image} alt="" className="h-full w-full object-contain" />
                  ) : null}
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-white">
                    {line.quantity}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-semibold uppercase tracking-tight">
                    {line.name}
                  </p>
                  {line.variantName ? (
                    <p className="text-xs text-ink-muted">{line.variantName}</p>
                  ) : null}
                </div>
                <p className="text-sm tabular-nums">{line.lineTotalLabel}</p>
              </li>
            ))}
          </ul>

          <p className="mt-6 flex items-start gap-2 border-t border-sand-dark pt-5 text-xs text-ink-muted">
            <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            Conexion cifrada de principio a fin.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={highlight ? 'font-semibold text-emerald-700' : 'text-ink'}>{value}</dd>
    </div>
  );
}

function SubmitButton({
  totalLabel,
  disabled,
  method,
}: {
  totalLabel: string;
  disabled: boolean;
  method: 'mercadopago' | 'transferencia';
}) {
  const { pending } = useFormStatus();
  const transferencia = method === 'transferencia';

  return (
    <button type="submit" disabled={pending || disabled} className="btn-primary w-full">
      {pending
        ? transferencia
          ? 'Confirmando tu pedido...'
          : 'Redirigiendo a Mercado Pago...'
        : transferencia
          ? `Confirmar pedido por ${totalLabel}`
          : `Pagar ${totalLabel}`}
    </button>
  );
}

/**
 * Despacho o retiro, una junto a la otra.
 *
 * Van en dos tarjetas del mismo tamano y no en un desplegable porque es la
 * primera decision del checkout: el comprador tiene que ver las dos opciones
 * de un vistazo, sin abrir nada.
 */
function OpcionEntrega({
  seleccionado,
  onSelect,
  icono,
  titulo,
  descripcion,
}: {
  seleccionado: boolean;
  onSelect: () => void;
  icono: React.ReactNode;
  titulo: string;
  descripcion: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={seleccionado}
      className={`flex h-full items-start gap-3 border-2 p-5 text-left transition-colors ${
        seleccionado ? 'border-ink bg-sand' : 'border-sand-dark bg-white hover:border-ink-soft'
      }`}
    >
      <span className={`mt-0.5 shrink-0 ${seleccionado ? 'text-brand' : 'text-ink-muted'}`}>
        {icono}
      </span>
      <span className="min-w-0">
        <span className="font-display text-sm font-semibold uppercase tracking-widest">
          {titulo}
        </span>
        <span className="mt-2 block text-sm text-ink-muted">{descripcion}</span>
      </span>
    </button>
  );
}

/**
 * Una forma de pago en la lista.
 *
 * Es una tarjeta clicable entera, no un radio con su etiqueta al lado: en el
 * telefono acertarle a un circulo de doce pixeles es una molestia gratuita.
 */
function MetodoPago({
  seleccionado,
  onSelect,
  titulo,
  descripcion,
  children,
}: {
  seleccionado: boolean;
  onSelect: () => void;
  titulo: React.ReactNode;
  descripcion: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`border-2 p-5 transition-colors ${
        seleccionado ? 'border-ink bg-sand' : 'border-sand-dark bg-white hover:border-ink-soft'
      }`}
    >
      <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 text-left">
        <span
          aria-hidden="true"
          className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
            seleccionado ? 'border-brand' : 'border-sand-dark'
          }`}
        >
          {seleccionado ? <span className="h-2 w-2 rounded-full bg-brand" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center">{titulo}</span>
          <span className="mt-2 block text-sm text-ink-muted">{descripcion}</span>
        </span>
      </button>
      {children}
    </div>
  );
}

function Field({
  label,
  name,
  error,
  hint,
  type = 'text',
  ...rest
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `field-${name}`;
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        className={`field ${error ? 'field-error' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
      {error ? (
        <span id={`${id}-error`} className="error-text">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="mt-1 block text-xs text-ink-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
