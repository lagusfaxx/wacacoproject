import type { Metadata } from 'next';
import { deleteCoupon } from '@/app/actions/admin';
import { CouponAdminForm } from '@/components/admin/coupon-form';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Cupones' };

export default async function AdminCouponsPage() {
  await requireAdmin();
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <>
      <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
        Cupones de descuento
      </h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="border border-sand-dark bg-white">
          <h2 className="border-b border-sand-dark px-6 py-4 font-display text-base font-bold uppercase tracking-tight">
            Cupones existentes
          </h2>
          {coupons.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-ink-muted">
              Todavia no hay cupones creados.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Descuento</th>
                    <th>Minimo</th>
                    <th className="text-right">Usos</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((coupon) => (
                    <tr key={coupon.id}>
                      <td className="font-mono font-semibold">{coupon.code}</td>
                      <td>
                        {coupon.type === 'PERCENT'
                          ? `${Number(coupon.value)}%`
                          : formatMoney(coupon.value)}
                      </td>
                      <td>
                        {Number(coupon.minSubtotal) > 0 ? formatMoney(coupon.minSubtotal) : '—'}
                      </td>
                      <td className="text-right tabular-nums">
                        {coupon.timesRedeemed}
                        {coupon.maxRedemtions ? ` / ${coupon.maxRedemtions}` : ''}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            coupon.active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-sand-dark text-ink-soft'
                          }`}
                        >
                          {coupon.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <form action={deleteCoupon}>
                          <input type="hidden" name="code" value={coupon.code} />
                          <button
                            type="submit"
                            className="font-display text-[10px] font-bold uppercase tracking-widest text-ink-muted hover:text-red-600"
                          >
                            Eliminar
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="border border-sand-dark bg-white">
          <h2 className="border-b border-sand-dark px-6 py-4 font-display text-base font-bold uppercase tracking-tight">
            Crear o actualizar
          </h2>
          <div className="p-6">
            <CouponAdminForm currency={env.currency} />
            <p className="mt-4 text-xs text-ink-muted">
              Si el codigo ya existe, se actualizan sus condiciones conservando el contador de usos.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
