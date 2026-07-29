-- Codigo de barras y marca por producto: los dos identificadores que Google
-- pide para publicar un articulo como oferta de tienda.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "gtin" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "brand" TEXT;
