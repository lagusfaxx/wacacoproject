#!/bin/sh
# ---------------------------------------------------------------------------
# Arranque del contenedor.
#  1. Espera a que Postgres acepte conexiones.
#  2. Aplica las migraciones pendientes.
#  3. Siembra el catalogo si la base esta vacia.
#  4. Levanta el servidor de Next.
# ---------------------------------------------------------------------------
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: falta la variable DATABASE_URL." >&2
  exit 1
fi

if [ -z "$SESSION_SECRET" ]; then
  echo "ERROR: falta la variable SESSION_SECRET." >&2
  exit 1
fi

# Una clave con / + @ ? # rompe el parseo de DATABASE_URL y Prisma falla con un
# error que no explica la causa. Mejor detenerse aqui diciendo que pasa.
if ! node -e "new URL(process.env.DATABASE_URL)" 2>/dev/null; then
  echo "ERROR: DATABASE_URL no es una URL valida." >&2
  echo "  Causa habitual: la contrasena de Postgres contiene / + @ ? # o espacios." >&2
  echo "  Genera una sin simbolos reservados:  openssl rand -hex 32" >&2
  echo "  (o codificala en porcentaje si necesitas conservar la actual)." >&2
  exit 1
fi

echo "==> Esperando a la base de datos..."
ATTEMPT=0
until node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.\$queryRaw\`SELECT 1\`.then(() => p.\$disconnect()).then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" -ge 30 ]; then
    echo "ERROR: la base de datos no respondio tras 30 intentos." >&2
    exit 1
  fi
  echo "    intento $ATTEMPT/30..."
  sleep 2
done
echo "==> Base de datos disponible."

echo "==> Aplicando migraciones..."
# Se invoca el CLI por su ruta real: el enlace de node_modules/.bin
# se copia como archivo plano en la imagen y perderia sus rutas relativas.
node node_modules/prisma/build/index.js migrate deploy

# El seed solo corre la primera vez: si ya hay productos no se toca nada.
if [ "$SKIP_SEED" != "true" ]; then
  PRODUCT_COUNT=$(node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.product.count().then((n) => { console.log(n); return p.\$disconnect(); }).catch(() => { console.log(-1); process.exit(0); });
  " 2>/dev/null || echo "-1")

  if [ "$PRODUCT_COUNT" = "0" ]; then
    echo "==> Base vacia: cargando catalogo inicial..."
    node seed-dist/seed.js || echo "AVISO: el seed no pudo completarse."
  else
    echo "==> Catalogo existente ($PRODUCT_COUNT productos): se omite el seed."
  fi
fi

echo "==> Iniciando la aplicacion en el puerto ${PORT:-3000}..."
exec "$@"
