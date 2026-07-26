# Wacaco Store

Tienda online completa para productos Wacaco: catalogo, carrito, checkout con
**Mercado Pago**, seguimiento de envios, cuentas de cliente y panel de
administracion. Pensada para desplegarse en **Coolify** con Docker.

- **Stack:** Next.js 15 (App Router) · TypeScript · PostgreSQL · Prisma · Tailwind CSS
- **Pagos:** Mercado Pago Checkout Pro con webhook firmado (HMAC-SHA256)
- **Despliegue:** una sola imagen Docker + Postgres

---

## Tabla de contenidos

1. [Que incluye](#que-incluye)
2. [Puesta en marcha local](#puesta-en-marcha-local)
3. [Variables de entorno](#variables-de-entorno)
4. [Configurar Mercado Pago](#configurar-mercado-pago)
5. [Despliegue en Coolify](#despliegue-en-coolify)
6. [Panel de administracion](#panel-de-administracion)
7. [Seguridad](#seguridad)
8. [Pruebas](#pruebas)
9. [Estructura del proyecto](#estructura-del-proyecto)
10. [Mantenimiento](#mantenimiento)

---

## Que incluye

### Tienda

| Funcion | Detalle |
| --- | --- |
| Portada | Carrusel de destacados, cintas animadas, mas vendidos y colecciones |
| Catalogo | Filtro por coleccion, orden por precio/novedad/nombre, buscador |
| Ficha de producto | Galeria, variantes de color con stock propio, especificaciones |
| Carrito | Persistente por cookie, se fusiona con el del usuario al iniciar sesion |
| Cupones | Porcentaje o monto fijo, minimo de compra y limite de usos |
| Envio | Tarifa plana configurable y umbral de envio gratis |
| Checkout | Compra como invitado o con cuenta, redireccion a Mercado Pago |
| Seguimiento | Enlace privado por pedido + busqueda por numero y correo |
| Cuentas | Registro, inicio de sesion, direcciones, historial y cambio de clave |

### Panel de administracion (`/admin`)

| Seccion | Detalle |
| --- | --- |
| Resumen | Ventas del periodo con comparativa, ticket promedio, grafico diario, mas vendidos, stock bajo |
| Pedidos | Filtro por estado, buscador, cambio de estado, transportista y numero de seguimiento |
| Productos | Alta, edicion, imagenes, colecciones, stock en linea, archivado seguro |
| Clientes | Listado con gasto acumulado y bloqueo de cuentas |
| Cupones | Creacion y edicion de descuentos |
| Ajustes | Datos de la tienda, estado de Mercado Pago y registro de actividad |

---

## Puesta en marcha local

Requisitos: Node.js 20 o superior y PostgreSQL 14 o superior.

```bash
# 1. Dependencias
npm install

# 2. Configuracion
cp .env.example .env
# edita .env: DATABASE_URL, SESSION_SECRET y las credenciales de Mercado Pago

# 3. Base de datos
npm run db:deploy   # aplica las migraciones
npm run db:seed     # carga el catalogo y crea el administrador

# 4. Desarrollo
npm run dev         # http://localhost:3000
```

Genera un `SESSION_SECRET` seguro con:

```bash
openssl rand -base64 48
```

### Scripts disponibles

| Script | Que hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Genera el cliente de Prisma y compila la aplicacion |
| `npm run start` | Sirve la aplicacion compilada |
| `npm run typecheck` | Comprueba los tipos de TypeScript |
| `npm run test` | Pruebas de webhook, stock, pagos y validaciones |
| `npm run db:deploy` | Aplica migraciones pendientes |
| `npm run db:migrate` | Crea una migracion nueva (desarrollo) |
| `npm run db:seed` | Carga catalogo, cupones y administrador |
| `npm run db:studio` | Explorador visual de la base de datos |
| `npm run art` | Regenera las ilustraciones SVG y el favicon |

---

## Variables de entorno

Todas estan documentadas en [`.env.example`](.env.example).

### Obligatorias

| Variable | Descripcion |
| --- | --- |
| `DATABASE_URL` | Cadena de conexion a PostgreSQL |
| `APP_URL` | URL publica **sin barra final**. Mercado Pago la usa para el retorno y el webhook, por lo que en produccion debe ser `https://` |
| `SESSION_SECRET` | Secreto para firmar las sesiones. Minimo 32 caracteres |
| `MP_ACCESS_TOKEN` | Access token de Mercado Pago |

### Mercado Pago

| Variable | Por defecto | Descripcion |
| --- | --- | --- |
| `MP_PUBLIC_KEY` | — | Clave publica de la aplicacion |
| `MP_WEBHOOK_SECRET` | — | Clave secreta del webhook. **Sin ella se rechazan todas las notificaciones** |
| `MP_CURRENCY` | `CLP` | `ARS`, `CLP`, `MXN`, `BRL`, `COP`, `PEN`, `UYU` |
| `MP_SANDBOX` | `false` | `true` usa el checkout de pruebas |

### Tienda

| Variable | Por defecto | Descripcion |
| --- | --- | --- |
| `STORE_NAME` | `Wacaco Store` | Nombre mostrado en la tienda |
| `STORE_EMAIL` | — | Correo de contacto |
| `FREE_SHIPPING_THRESHOLD` | `60000` | Monto desde el que el envio es gratis. `0` lo desactiva |
| `SHIPPING_FLAT_RATE` | `4990` | Costo de envio |
| `TAX_RATE` | `0` | Impuesto sobre el subtotal, en porcentaje |

### Administrador inicial

`ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME` se usan **solo la primera vez**
que corre el seed. Un re-seed no sobrescribe la contrasena que hayas cambiado
despues desde el panel.

---

## Configurar Mercado Pago

### 1. Crear la aplicacion

1. Entra a <https://www.mercadopago.com/developers/panel/app> y crea una aplicacion.
2. Elige el producto **Checkout Pro**.
3. Copia el **Access token** y la **Public key** en `MP_ACCESS_TOKEN` y `MP_PUBLIC_KEY`.

> Para integrar sin cobrar de verdad, usa las credenciales de prueba y pon
> `MP_SANDBOX=true`.

### 2. Configurar el webhook

1. En el panel de la aplicacion entra en **Webhooks → Configurar notificaciones**.
2. Pega la URL:

   ```
   https://TU-DOMINIO/api/webhooks/mercadopago
   ```

3. Suscribe el evento **Pagos** (`payment`).
4. Copia la **clave secreta** que genera Mercado Pago en `MP_WEBHOOK_SECRET`.

La URL exacta tambien aparece en el panel, en **Ajustes**, junto con el estado
de cada credencial.

### 3. Como funciona el cobro

```
Cliente confirma el checkout
        │
        ├─ El servidor recalcula los totales desde la base de datos
        ├─ Crea el pedido (estado PENDIENTE) y reserva el stock
        ├─ Crea la preferencia en Mercado Pago
        │
        ▼
Mercado Pago (entorno seguro)  ──── el cliente paga ────┐
        │                                               │
        │ back_urls                                     │ webhook firmado
        ▼                                               ▼
/checkout/resultado                        /api/webhooks/mercadopago
  consulta el pago a la API                  1. valida la firma HMAC
  y muestra el estado real                   2. consulta el pago a la API
                                             3. actualiza el pedido
```

Puntos importantes:

- El monto **nunca** viene del navegador: se recalcula en el servidor con los
  precios de la base de datos.
- El estado del pago **nunca** se toma del cuerpo del webhook ni de los
  parametros de la URL de retorno: siempre se vuelve a consultar a la API de
  Mercado Pago con el access token.
- Si el monto cobrado no coincide con el del pedido, el pedido **no** se marca
  como pagado: queda con una nota interna para revision manual.
- Reprocesar la misma notificacion no duplica pagos ni descuenta stock dos veces.

### 4. Probar el flujo

Con `MP_SANDBOX=true` y credenciales de prueba, usa las
[tarjetas de prueba de Mercado Pago](https://www.mercadopago.com/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards).
Para recibir el webhook en local necesitas exponer el puerto con un tunel
(por ejemplo `ngrok http 3000`) y poner esa URL publica en `APP_URL`.

---

## Despliegue en Coolify

### Opcion A — Docker Compose (recomendada)

Incluye la base de datos en el mismo despliegue.

1. **Nuevo recurso** → *Docker Compose* → conecta este repositorio.
2. Coolify detecta `docker-compose.yml`.
3. En **Environment Variables** pega el contenido de `.env.example` con tus
   valores reales. Como minimo:

   ```env
   POSTGRES_PASSWORD=una-clave-larga-y-aleatoria
   APP_URL=https://tienda.tudominio.com
   SESSION_SECRET=<openssl rand -base64 48>
   MP_ACCESS_TOKEN=APP_USR-...
   MP_PUBLIC_KEY=APP_USR-...
   MP_WEBHOOK_SECRET=...
   MP_CURRENCY=CLP
   ADMIN_EMAIL=admin@tudominio.com
   ADMIN_PASSWORD=una-clave-fuerte
   ```

4. En **Domains** asigna tu dominio al servicio `app`, puerto `3000`.
5. Activa **Generate SSL** (Let's Encrypt). `APP_URL` debe coincidir con ese
   dominio, incluido el `https://`.
6. Pulsa **Deploy**.

### Opcion B — Dockerfile con Postgres aparte

1. Crea primero una base de datos **PostgreSQL** en Coolify y copia su cadena
   de conexion interna.
2. **Nuevo recurso** → *Dockerfile* → conecta el repositorio.
3. Define `DATABASE_URL` con esa cadena y el resto de variables.
4. Puerto expuesto: `3000`. Healthcheck: `/api/health`.

### Que ocurre en cada despliegue

`docker-entrypoint.sh` se encarga automaticamente de:

1. Esperar a que PostgreSQL acepte conexiones (hasta 30 intentos).
2. Aplicar las migraciones pendientes (`prisma migrate deploy`).
3. Cargar el catalogo inicial **solo si la base esta vacia**.
4. Arrancar el servidor.

Para desactivar el seed automatico define `SKIP_SEED=true`.

### Despues del primer despliegue

1. Entra a `https://TU-DOMINIO/admin/ingresar` con `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
2. **Cambia la contrasena** en *Mi cuenta → Seguridad*.
3. Comprueba en *Ajustes* que Mercado Pago aparece como configurado.
4. Registra la URL del webhook en el panel de Mercado Pago.
5. Haz una compra de prueba con `MP_SANDBOX=true` antes de pasar a produccion.

### Comprobacion de salud

`GET /api/health` responde `200` cuando la aplicacion y la base de datos estan
disponibles, y `503` si Postgres no responde. Docker y Coolify lo usan para
reiniciar el contenedor si algo falla.

---

## Panel de administracion

Acceso: `/admin` (redirige a `/admin/ingresar` si no hay sesion de administrador).

**Gestion de un pedido:** en *Pedidos* abre el pedido, elige el nuevo estado,
completa transportista y numero de seguimiento y escribe una nota opcional que
vera el cliente. Cada cambio queda registrado en la linea de tiempo del pedido.

Cancelar o reembolsar un pedido **devuelve el stock automaticamente**, y solo
una vez aunque repitas la operacion.

**Alta de producto:** en *Productos → Nuevo producto*. El slug se genera desde
el nombre si lo dejas vacio. En imagenes puedes usar rutas locales de `public/`
(por ejemplo `/products/picopresso.svg`) o URLs completas, una por linea.

Un producto que ya tiene ventas **no se elimina**: se archiva desactivandolo,
para no romper el historial de pedidos ni las estadisticas.

---

## Seguridad

| Riesgo | Como se aborda |
| --- | --- |
| Manipulacion de precios | Los totales se recalculan siempre en el servidor desde la base de datos |
| Webhooks falsificados | Firma HMAC-SHA256 verificada en tiempo constante, con ventana antireplay de 10 minutos |
| Pagos falsos | El estado se consulta a la API de Mercado Pago; el cuerpo del webhook nunca se cree |
| Cobros por monto distinto | Si el importe no coincide, el pedido queda para revision manual |
| Notificaciones repetidas | El id del pago es unico en la base de datos: reprocesar no duplica nada |
| Venta sobre stock inexistente | Reserva condicional (`stock >= cantidad`) dentro de una transaccion |
| Pedidos fantasma | Si Mercado Pago falla al crear la preferencia, el pedido se descarta y el stock vuelve |
| Fuerza bruta en el acceso | Limite por IP y por correo, respaldado en la base de datos |
| Enumeracion de cuentas | Mismo mensaje y mismo coste de tiempo para correo inexistente y clave incorrecta |
| Contrasenas | bcrypt con 12 rondas; requisitos minimos de complejidad |
| Robo de sesion | JWT en cookie `httpOnly`, `SameSite=Lax` y `Secure` en produccion |
| Escalada de privilegios | El rol se comprueba contra la base de datos en cada pagina del panel, no solo en el token |
| Acceso a pedidos ajenos | Las consultas filtran por usuario; los invitados usan un token aleatorio de 192 bits |
| Redirecciones abiertas | Solo se aceptan rutas internas en el parametro `next` |
| XSS | React escapa el contenido; no se usa `dangerouslySetInnerHTML` |
| CSRF | Server Actions con verificacion de origen de Next.js; cierre de sesion solo por POST |
| Datos de tarjeta | Nunca pasan por este servidor: los captura Mercado Pago |

---

## Pruebas

```bash
npm run test
```

Cubre 46 comprobaciones sobre:

- validacion de la firma `x-signature` (valida, alterada, ausente, mal formada,
  antigua y sin `request-id`);
- validacion del formulario de checkout y del panel;
- calculo de totales, cupones y limites de descuento;
- reserva de stock y prevencion de sobreventa;
- reversion de pedidos que no llegaron a la pasarela;
- idempotencia del webhook, verificacion de montos y devolucion de stock;
- hash y politica de contrasenas.

Las pruebas usan la base de datos de `DATABASE_URL` y limpian todo lo que crean.

---

## Estructura del proyecto

```
prisma/
  schema.prisma           modelo de datos
  seed.ts                 catalogo, cupones y administrador inicial
  migrations/             migraciones versionadas
scripts/
  generate-art.mjs        ilustraciones SVG del catalogo
  generate-favicon.mjs    favicon.ico
src/
  app/
    page.tsx              portada
    productos/            catalogo y ficha de producto
    coleccion/[slug]/     paginas de coleccion
    carrito/ checkout/    compra
    cuenta/               registro, acceso y pedidos del cliente
    seguimiento/          consulta de pedidos
    admin/                panel de administracion
    api/
      webhooks/mercadopago/   receptor de notificaciones
      auth/logout/            cierre de sesion
      health/                 healthcheck
    actions/              Server Actions (carrito, checkout, cuenta, admin)
  components/             interfaz de tienda y panel
  lib/
    mercadopago.ts        preferencias, consulta de pagos y firma del webhook
    orders.ts             creacion de pedidos, stock y estados
    pricing.ts            calculo de totales (unica fuente de verdad)
    auth.ts               sesiones, roles y auditoria
    cart.ts               carrito por cookie y fusion al iniciar sesion
  middleware.ts           proteccion del panel
tests/
  checkout-flow.test.ts   pruebas de la logica critica
```

---

## Mantenimiento

**Cambiar precios o stock:** desde el panel, en *Productos*. El stock se edita
en linea desde el listado.

**Anadir un producto con variantes de color:** crea el producto en el panel y
luego anade las variantes en la base de datos o amplia `prisma/seed.ts`. Las
variantes aparecen como selector de color en la ficha.

**Modificar el catalogo inicial:** edita el array `PRODUCTS` de
`prisma/seed.ts` y ejecuta `npm run db:seed`. El seed es idempotente.

**Cambiar de moneda o pais:** ajusta `MP_CURRENCY` y los valores de envio. Las
monedas sin decimales (CLP, COP) se redondean a entero automaticamente.

**Copias de seguridad:** todo el estado vive en PostgreSQL. En Coolify activa
los backups programados de la base de datos.

**Registros:** los eventos relevantes (accesos, cambios de pedido, webhooks)
quedan en la tabla `AuditLog` y se ven en *Ajustes → Actividad reciente*.

---

## Nota sobre las imagenes

El diseno de referencia usa fotografia de producto de Wacaco, que no se
redistribuye en este repositorio. En su lugar `scripts/generate-art.mjs` genera
ilustraciones de linea con el mismo lenguaje visual, de modo que la tienda
funciona sin depender de ningun host de imagenes externo. Para usar fotos
reales, subelas a `public/products/` y actualiza las URLs desde el panel.
