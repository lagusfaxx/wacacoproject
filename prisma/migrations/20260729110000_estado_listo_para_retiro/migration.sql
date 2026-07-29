-- El valor nuevo del enum va en su propia migracion: Postgres no permite usar
-- un valor recien agregado dentro de la misma transaccion que lo agrego.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_PICKUP' AFTER 'PREPARING';
