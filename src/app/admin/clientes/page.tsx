import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { toggleCustomerActive } from '@/app/actions/admin';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { REVENUE_STATUSES } from '@/lib/stats';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Clientes' };

type PageProps = { searchParams: Promise<{ q?: string }> };

export default async function AdminCustomersPage({ searchParams }: PageProps) {
  const admin = await requireAdmin();
  const { q } = await searchParams;
  const term = (q ?? '').trim().slice(0, 80);

  const where: Prisma.UserWhereInput = term
    ? {
        OR: [
          { email: { contains: term, mode: 'insensitive' } },
          { name: { contains: term, mode: 'insensitive' } },
        ],
      }
    : {};

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { _count: { select: { orders: true } } },
  });

  // Un solo agregado para todos los clientes visibles evita N consultas.
  const spendByUser = await prisma.order.groupBy({
    by: ['userId'],
    where: { userId: { in: users.map((user) => user.id) }, status: { in: REVENUE_STATUSES } },
    _sum: { total: true },
  });

  const spendMap = new Map(
    spendByUser.map((entry) => [entry.userId, entry._sum.total?.toString() ?? '0']),
  );

  return (
    <>
      <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
        Clientes
      </h1>

      <form action="/admin/clientes" method="get" className="mt-6 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={term}
          placeholder="Nombre o correo"
          className="field w-72 py-2.5"
          maxLength={80}
        />
        <button type="submit" className="btn-dark btn-sm">
          Buscar
        </button>
      </form>

      <div className="mt-6 border border-sand-dark bg-white">
        {users.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-ink-muted">
            No hay clientes que coincidan.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Rol</th>
                  <th className="text-right">Pedidos</th>
                  <th className="text-right">Total gastado</th>
                  <th>Registro</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-xs text-ink-muted">{user.email}</p>
                      {user.phone ? (
                        <p className="text-xs text-ink-muted">{user.phone}</p>
                      ) : null}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          user.role === 'ADMIN' ? 'bg-brand text-white' : 'bg-sand text-ink-soft'
                        }`}
                      >
                        {user.role === 'ADMIN' ? 'Admin' : 'Cliente'}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">{user._count.orders}</td>
                    <td className="text-right tabular-nums">
                      {formatMoney(spendMap.get(user.id) ?? 0)}
                    </td>
                    <td className="text-xs text-ink-muted">
                      {new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(
                        user.createdAt,
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          user.active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {user.active ? 'Activo' : 'Bloqueado'}
                      </span>
                    </td>
                    <td>
                      {user.id === admin.id ? (
                        <span className="text-[10px] uppercase tracking-widest text-ink-muted">
                          Tu cuenta
                        </span>
                      ) : (
                        <form action={toggleCustomerActive}>
                          <input type="hidden" name="userId" value={user.id} />
                          <button
                            type="submit"
                            className="font-display text-[10px] font-bold uppercase tracking-widest text-ink-muted hover:text-brand"
                          >
                            {user.active ? 'Bloquear' : 'Reactivar'}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
