-- Retiro en tienda: como recibe el pedido el comprador y cuando quedo listo
-- para pasar a buscarlo. Los pedidos que ya existen son todos de despacho.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryMethod" TEXT NOT NULL DEFAULT 'despacho';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "readyAt" TIMESTAMP(3);
