# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Imagen de produccion para Coolify.
# Build en varias etapas para que la imagen final no incluya el codigo fuente
# ni las dependencias de desarrollo.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS base
# openssl es requerido por Prisma en Alpine.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app


# --- Dependencias ----------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci


# --- Build -----------------------------------------------------------------
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma necesita una URL valida para generar el cliente, pero no se conecta
# durante el build. La real llega por variable de entorno en tiempo de
# ejecucion.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

RUN npx prisma generate
RUN npm run build

# El seed se compila a JavaScript plano para que la imagen final no necesite
# tsx ni el binario nativo de esbuild.
RUN npx tsc prisma/seed.ts \
  --outDir seed-dist \
  --module commonjs \
  --target es2022 \
  --moduleResolution node \
  --esModuleInterop \
  --skipLibCheck


# --- Runtime ---------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Salida standalone de Next: incluye solo lo necesario para servir la app.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma CLI y esquema, necesarios para aplicar las migraciones al arrancar.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Seed ya compilado y su unica dependencia extra.
COPY --from=builder --chown=nextjs:nodejs /app/seed-dist ./seed-dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
