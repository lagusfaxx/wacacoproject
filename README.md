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
4. [Contenido que debes cargar antes de publicar](#contenido-que-debes-cargar-antes-de-publicar)
5. [Configurar Mercado Pago](#configurar-mercado-pago)
6. [Configurar Blue Express](#configurar-blue-express)
7. [Correos de la tienda (Resend)](#correos-de-la-tienda-resend)
8. [SEO en Google](#seo-en-google)
9. [Despliegue en Coolify](#despliegue-en-coolify)
10. [Panel de administracion](#panel-de-administracion-admin)
11. [Operar el panel](#operar-el-panel)
12. [Seguridad](#seguridad)
13. [Pruebas](#pruebas)
14. [Estructura del proyecto](#estructura-del-proyecto)
15. [Mantenimiento](#mantenimiento)

---

## Que incluye

### Tienda

| Funcion | Detalle |
| --- | --- |
| Portada | Carrusel de destacados, cintas animadas, mas vendidos y colecciones |
| Catalogo | Filtro por coleccion, orden por precio/novedad/nombre, buscador |
| Ficha de producto | Galeria, variantes de color con stock propio, especificaciones y bloques de contenido editables |
| Carrito | Persistente por cookie, se fusiona con el del usuario al iniciar sesion |
| Cupones | Porcentaje o monto fijo, minimo de compra y limite de usos |
| Envio | Cotizado en vivo con **Blue Express** segun comuna, peso y medidas; tarifa plana de respaldo |
| Checkout | Compra como invitado o con cuenta, redireccion a Mercado Pago |
| Seguimiento | Enlace privado por pedido + busqueda por numero y correo |
| Cuentas | Registro, inicio de sesion, y un area privada dividida en resumen, pedidos, datos, direccion y seguridad |
| Marca | Logo, favicon, banners de portada, menu y textos editables desde el panel |
| Correo | Comprobantes, avisos de estado y codigos de verificacion con Resend |
| SEO | Titulo, descripcion e imagen propios por producto y coleccion, con vista previa de Google y datos estructurados |

### Imagenes y contenido de la portada

Las imagenes se **suben desde el panel**, no se referencian por URL. Se guardan
en PostgreSQL y se sirven desde `/api/media/<id>` con cache indefinida.

> Se guardan en la base y no en disco a proposito: el contenedor de Coolify es
> efimero y cualquier archivo escrito en el sistema de archivos desaparece en el
> siguiente despliegue. Ademas quedan incluidas en los respaldos de la base sin
> configurar nada aparte.

Formatos: JPG, PNG, WEBP, AVIF y SVG, hasta 10 MB por imagen. Los SVG con scripts se
rechazan. Al guardar, las imagenes que dejaron de usarse se borran solas
(con una hora de gracia, por si quedaron en un formulario a medio llenar).

**Optimizacion.** El archivo que subes se guarda tal cual y no se toca nunca.
Lo que se optimiza es lo que viaja al navegador: la tienda pide cada foto en el
ancho que de verdad ocupa en pantalla (`?w=320` … `?w=1920`) y, si el navegador
acepta AVIF o WEBP, se le manda en ese formato. Esas versiones se calculan la
primera vez que alguien las pide y quedan guardadas en `MediaVariant`, que es
solo cache: si borras esa tabla entera se vuelven a generar solas y no se
pierde ninguna imagen.

La calidad esta puesta alta a proposito (AVIF 62, WEBP 85) para que no se note
la diferencia, y nunca se agranda una foto: pedir 1920 de una de 800 devuelve
la de 800. Un SVG no se toca, porque ya es texto y escala solo. Si el servidor
no puede optimizar — sin `sharp` instalado, por ejemplo — se sirve el original,
que es exactamente lo que se hacia antes.

En numeros, con una foto real de la tienda:

| Version | Peso |
| --- | --- |
| Original PNG de 1183x1183 | 4102 KB |
| WEBP, mismo tamano | 1024 KB |
| AVIF, mismo tamano | 1080 KB |
| AVIF a 640 px (telefono) | 207 KB |
| AVIF a 320 px (miniatura) | 34 KB |

| Donde | Que se sube |
| --- | --- |
| **Ajustes → Marca** | Logo de la tienda. Sin logo se muestra el nombre en texto |
| **Ajustes → Marca** | Icono de la pestana (favicon). Sin icono propio se usa el que trae la tienda |
| **Banners** | Imagen de cada diapositiva del carrusel de portada |
| **Colecciones** | Imagen de la categoria, la que sale en la cuadricula de la portada |
| **Productos** | Galeria completa: varias fotos, reordenables, la primera es la principal |
| **Productos → Contenido bajo la ficha** | Fotos de uso, logo del relato, cartel del video y fotografias de los bloques |

### Contenido bajo la ficha del producto

Bajo la descripcion de cada producto puedes armar una pagina de venta con
bloques, sin tocar codigo. Se editan en **Productos → Contenido bajo la ficha**:
se agregan, se reordenan con *Subir* y *Bajar*, y cada uno se puede ocultar sin
borrarlo. Se muestran en ese mismo orden, entre la ficha y los productos
relacionados.

| Bloque | Que muestra |
| --- | --- |
| **Franja de fotos** | Fila de fotografias de uso a lo ancho de la pantalla. En el telefono se desliza de lado |
| **Relato de marca** | Logo, titular grande y un parrafo centrado, normalmente sobre fondo oscuro |
| **Video** | Video a lo ancho que se reproduce solo, en silencio, en bucle y sin controles. Admite YouTube, Vimeo o un archivo `.mp4` / `.webm` |
| **Imagen y texto** | Fotografia a un costado y el texto al otro. Por defecto el lado se alterna en cada bloque |

Cada bloque elige su fondo (oscuro, blanco o arena) y puede llevar un boton con
su destino. Un bloque que queda sin contenido no se guarda, para que la pagina
nunca dibuje una franja en blanco.

Los bloques con imagen eligen tambien su tamano — *pequena*, *mediana* o
*grande* — y lo que mide cambia con el tipo: la altura del logo en el relato,
el alto de la fila en la franja de fotos y el alto de la fotografia en el
bloque de imagen y texto.

El ajuste se nota en todas las pantallas. En el telefono, donde no hay altura
de franja con la que jugar, lo que cambia es la forma de la foto — apaisada la
pequena, cuadrada la grande — y en la franja de fotos, ademas, cuanto ocupa
cada una del ancho: con la pequena caben mas de dos en pantalla y con la
grande una sola.

La franja de fotos y el bloque de imagen y texto eligen ademas como encaja la
foto en su hueco. **Recortada** es lo de siempre: llena todo el hueco y lo que
sobra se corta, que con una foto alta o muy apaisada puede comerse media
imagen. **Entera** la muestra completa y deja aire del color del bloque
alrededor. Si subiste una foto grande y solo se ve una franja de ella, esta es
la opcion que buscas.

El bloque de imagen y texto ademas fija el lado de la foto. Por defecto
alterna, para que dos bloques seguidos no se lean como una sola columna, pero
puedes dejarla siempre a la izquierda o siempre a la derecha.

### Banners

En **Banners** creas las diapositivas del carrusel: texto superior, titular,
bajada, boton con su destino, imagen y fondo (cinco degradados preparados). Hay
vista previa en vivo mientras editas.

La bajada tiene una casilla **Bajada en negrita**: cuando el texto se pierde
sobre la foto, la deja en negrita y en blanco puro. El titular no cambia.

La imagen se puede colocar de dos formas:

| Modo | Cuando usarlo |
| --- | --- |
| **Fondo completo** (por defecto) | Fotografias. La imagen ocupa todo el banner. Conviene apaisada, de al menos 1920x900 |
| **A un costado** | Productos recortados con fondo transparente. Se apoyan a la derecha sobre un circulo claro |
| **Mitad y mitad, foto a la derecha** | El texto ocupa media franja sobre el color de fondo y la foto llena la otra mitad |
| **Mitad y mitad, foto a la izquierda** | Lo mismo al reves, para alternar cuando pones varias franjas seguidas |

En los dos modos de mitad y mitad, en telefono no hay dos mitades: la foto se
pone arriba y el texto debajo, porque partir una pantalla estrecha deja las dos
cosas ilegibles.

Como el titular va en blanco, en modo fondo completo puedes subir o bajar el
velo que oscurece la foto (*sin velo*, *suave*, *medio* o *fuerte*) hasta que el
texto se lea bien.

Cada banner elige en que parte de la portada aparece:

| Ubicacion | Donde sale |
| --- | --- |
| **Carrusel principal** | Primera pantalla. Si hay varios se turnan solos |
| **Franja bajo "Mas vendidos"** | Banda ancha en medio de la portada |
| **Franja bajo "Colecciones"** | Mas abajo, tras la tira de colecciones y antes de los beneficios |

En las dos franjas anchas puedes poner los banners que quieras: se apilan uno
tras otro segun el **orden** de cada uno, igual que las bandas que bajan por la
portada de una tienda grande.

Si no hay ningun banner activo, la portada arma el carrusel sola con tus
productos destacados y la franja del medio usa el producto marcado como
&quot;Nuevo&quot;, de modo que nunca se ve vacia. La franja de abajo, en cambio,
solo aparece si creas banners para ella.

### Tiras de productos

En **Tiras** armas filas de productos elegidos a mano, con el titulo que
quieras. Es lo contrario de &quot;Mas vendidos&quot;, que se arma sola con los
productos marcados como destacados: aqui eliges tu que productos van, en que
orden y en cual de las dos franjas anchas aparecen.

Cada tira se dibuja igual que la fila de &quot;Mas vendidos&quot;, con el mismo
deslizamiento lateral en telefono. Se muestran hasta ocho productos, y los que
esten ocultos en el catalogo no aparecen aunque esten en la tira.

### Estadisticas

En **Estadisticas** ves lo que pasa en la tienda, medido por la propia tienda:
no hay Google Analytics ni ninguna etiqueta de terceros, asi que no se manda
nada fuera ni hace falta pedir consentimiento para cookies de rastreo.

Arriba, la vista **en vivo**, que se refresca sola cada quince segundos (y se
pausa cuando cambias de pestana): cuanta gente hay en la tienda en los ultimos
cinco minutos, que paginas estan mirando, cuantas vistas hubo en la ultima hora
y cuantos carritos estan activos ahora mismo.

Debajo, el **trafico** de los ultimos 7, 30 o 90 dias: visitantes, paginas
vistas, grafico por dia, conversion (pedidos pagados por cada cien visitantes),
de donde llegan agrupado por sitio, las paginas y los productos mas vistos, y
el reparto entre telefono y computador.

Al final, los **carritos abandonados**: los que tienen productos dentro, llevan
mas de media hora quietos y nunca llegaron a pedido, con lo que hay en cada uno
y cuanto suma. Si la persona tenia sesion iniciada aparece su correo, para
poder escribirle; de un visitante anonimo no se guarda ningun dato de contacto.

De cada visita se guarda la ruta, de donde venia, si era telefono o computador
y un numero al azar que caduca a la media hora sin actividad. **No se guarda la
IP** ni nada que identifique a una persona. Las paginas del panel no se cuentan
y los robots que se presentan como tales se descartan. Las visitas de mas de 90
dias se borran solas.

### Menu

En **Menu** defines los enlaces de la cabecera: texto, destino, orden y si estan
visibles. El desplegable con tus colecciones se arma solo a partir del catalogo.
Si borras todos los enlaces, vuelven los de por defecto.

Solo se aceptan rutas internas (`/products`) o URLs completas `http(s)`, para
que nadie pueda dejar un `javascript:` en la cabecera.

---

## Panel de administracion (`/admin`)

| Seccion | Detalle |
| --- | --- |
| Resumen | Ventas del periodo con comparativa, ticket promedio, grafico diario, mas vendidos, stock bajo |
| Estadisticas | Visitantes en vivo, trafico del periodo, de donde llegan, paginas y productos mas vistos, conversion y carritos abandonados |
| Pedidos | Filtro por estado, buscador, cambio de estado, transportista y numero de seguimiento |
| Productos | Alta, edicion, galeria con subida de fotos, bloques de contenido, colecciones, stock en linea, archivado seguro |
| Clientes | Listado con gasto acumulado y bloqueo de cuentas |
| Colecciones | Alta, edicion, imagen, orden y SEO propio |
| Banners | Carrusel de portada con imagen, textos, boton y fondo |
| Menu | Enlaces de la cabecera, ordenables |
| Envios | Tarifa, plazo y cobertura por region, sin depender de un courier |
| Cupones | Creacion y edicion de descuentos |
| Ajustes | Datos de la tienda, logo, textos de portada, estado de Mercado Pago y Blue Express, registro de actividad |

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
| `npm run db:demo` | Carga stock de demostracion para probar el flujo (`-- --reset` lo deja en 0) |
| `npm run db:relink` | Reescribe a `/products` los enlaces del menu y de los banners que apuntaban a `/productos` |
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

### Correo (Resend)

| Variable | Por defecto | Descripcion |
| --- | --- | --- |
| `RESEND_API_KEY` | — | Clave de API de Resend. Vacia = la tienda no envia correos |
| `EMAIL_FROM` | — | Remitente, formato `Nombre <correo@dominio>`. El dominio debe estar verificado en Resend |
| `EMAIL_REPLY_TO` | `STORE_EMAIL` | A donde responde el cliente |

### Administrador inicial

`ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME` se usan **solo la primera vez**
que corre el seed. Un re-seed no sobrescribe la contrasena que hayas cambiado
despues desde el panel.

---

## Contenido que debes cargar antes de publicar

Esta tienda **no inventa datos de producto**. El catalogo inicial solo trae lo
verificable —nombre, categoria y SKU— y deja el resto vacio a proposito:

| Dato | Estado inicial | Por que |
| --- | --- | --- |
| Descripcion y caracteristicas | Vacias | Deben salir de la ficha oficial del fabricante |
| Especificaciones tecnicas | Vacias | Publicar medidas o presiones inventadas induce a error al comprador |
| Precios | Valores de referencia | Son tu lista de precios, no un dato del producto |
| Stock | En cero | Un stock inventado vende unidades que no tienes |
| Logo | Sin cargar | Se muestra el nombre de la tienda en tipografia hasta que subas el tuyo |
| Imagenes | Ilustraciones de linea generadas | La fotografia de producto es de Wacaco y no se redistribuye aqui |

El panel muestra un aviso en **Resumen** con lo que falta y enlaces directos
para corregirlo. Mientras el stock siga en cero los productos se ven pero no se
pueden comprar, que es el comportamiento seguro.

Un producto sin stock puede marcarse como **Reposicion "En camino"** en
*Productos → Visibilidad*. Entonces, en vez de &quot;Agotado&quot;, la tarjeta
y la ficha anuncian que viene en camino, con un avioncito dibujado — no un
emoji, para que se vea igual en todos los telefonos. El boton sigue apagado: no
hay unidades que reservar, y prometer una compra que no se puede completar
seria peor que decir que no hay. Para Google la ficha pasa a declararse como
`BackOrder`, que es justo eso y no un agotado.

Para recorrer la tienda completa antes de tener el inventario real:

```bash
npm run db:demo            # carga stock ficticio
npm run db:demo -- --reset # lo devuelve a cero
```

Los textos de portada (titular del hero, cinta desplazante, barra de anuncio)
tambien se editan en **Ajustes → Tienda**, para que la comunicacion sea tuya y
no un texto de relleno.

---

## Configurar Mercado Pago

### 1. Crear la aplicacion

1. Entra a <https://www.mercadopago.com/developers/panel/app> y crea una aplicacion.
2. Elige el producto **Checkout Pro**.
3. Copia el **Access token** en `MP_ACCESS_TOKEN`.

> Solo hace falta el access token. La *public key* se usa unicamente cuando el
> navegador tokeniza la tarjeta (Checkout Bricks o Checkout API), y el
> *client id/secret* solo en integraciones OAuth donde se cobra en nombre de
> otros vendedores. Con Checkout Pro ni una ni otros intervienen.

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

## Envios

El costo de despacho se resuelve en cascada, de lo mas especifico a lo mas
general:

| Paso | Condicion | Resultado |
| --- | --- | --- |
| 1 | La compra supera `FREE_SHIPPING_THRESHOLD` | Gratis |
| 2 | Blue Express configurado y cotiza el destino | Tarifa real del courier |
| 3 | Hay tarifa manual para esa region | Esa tarifa |
| 4 | No hay nada de lo anterior | `SHIPPING_FLAT_RATE` |

**Blue Express es opcional.** Sin sus credenciales la tienda funciona con los
pasos 3 y 4, y el despliegue no falla: solo `POSTGRES_PASSWORD`, `APP_URL` y
`SESSION_SECRET` son obligatorias.

### Tarifas manuales por region

En **Envios** del panel defines, para cada una de las 16 regiones:

- el **precio** del despacho (vacio = se usa la tarifa general);
- los **dias habiles** estimados, que se muestran al comprador;
- si **despachas** o no a esa region. Al desmarcarla, quien elija esa region ve
  un aviso y no puede pagar, en lugar de comprar algo que no vas a enviar.

Ahi mismo se define el **nombre del transportista** que ve el cliente
(Chilexpress, Starken, despacho propio...).

---

## Configurar Blue Express

Opcional. Si lo activas, cotiza en tiempo real y tiene prioridad sobre las
tarifas manuales, que pasan a ser el respaldo si su API no responde.

### 1. Pedir las credenciales

Solicita al equipo de integraciones de Blue Express el acceso a la API de
comercio electronico. Te entregaran:

- una **API key** (`BLUEX_API_KEY`),
- un **token** (`BLUEX_TOKEN`),
- el **codigo de distrito** de la comuna desde donde despachas
  (`BLUEX_ORIGIN_DISTRICT`).

### 2. Configurar las variables

```env
BLUEX_API_KEY=...
BLUEX_TOKEN=...
BLUEX_ORIGIN_DISTRICT=...
BLUEX_SERVICE_TYPES=EX        # separa con comas si cotizas varios servicios
BLUEX_PRODUCT_FAMILY=PAQU
```

En **Ajustes → Envios** el panel indica si la integracion quedo activa.

### 3. Cargar peso y medidas de cada producto

Blue Express cotiza por bulto. En la ficha de cada producto, en **Bulto para el
envio**, carga el peso en gramos y el largo, ancho y alto de la caja. Si estan
mal, el costo que ve el cliente tambien lo estara.

### Como funciona la cotizacion

```
El comprador elige region y comuna en el checkout
        │
        ├─ /api/ecommerce/comunas/v1/bxgeo   comuna -> codigo de distrito
        │                                     (el resultado se cachea 30 dias)
        ├─ /api/ecommerce/pricing/v1         cotiza con origen, destino y bultos
        │
        ▼
Se muestra el transportista, el servicio, el plazo estimado y el costo
```

- La cotizacion se refresca sola mientras el comprador escribe su comuna.
- **Al confirmar el pedido el servidor vuelve a cotizar.** El precio que viajo
  al navegador nunca se usa para cobrar.
- Si Blue Express no responde, no reconoce la comuna o no esta configurado, se
  aplica `SHIPPING_FLAT_RATE` y se avisa en pantalla. La tienda nunca queda sin
  poder vender por una caida del courier.
- Si la compra supera `FREE_SHIPPING_THRESHOLD`, el envio es gratis y esa regla
  manda por sobre cualquier tarifa.
- Al despachar, si cargas el numero de seguimiento y el transportista es Blue
  Express, el enlace de rastreo se genera solo.

---

## Correos de la tienda (Resend)

La tienda envia correo transaccional con [Resend](https://resend.com). Sin
`RESEND_API_KEY` y `EMAIL_FROM` todo lo demas funciona igual: cada correo que
se habria enviado queda anotado como *omitido* en **Ajustes → Correo**, asi que
se nota de inmediato que falta configurarlo.

### 1. Configurar Resend

1. Crea una cuenta en [resend.com](https://resend.com).
2. **Domains → Add Domain**: agrega tu dominio y copia los registros DNS
   (SPF y DKIM) en tu proveedor. Sin dominio verificado Resend rechaza los
   envios, y los correos que salen desde un dominio sin firmar terminan en
   la carpeta de no deseado.
3. **API Keys → Create API Key** con permiso de envio.
4. Pon la clave en `RESEND_API_KEY` y una direccion de ese dominio en
   `EMAIL_FROM` (por ejemplo `Wacaco Store <pedidos@tudominio.com>`).

### 2. Que se envia y cuando

| Correo | Cuando sale | A quien |
| --- | --- | --- |
| Pedido recibido | Al crear el pedido, antes de pagar | Cliente |
| Comprobante de compra | Cuando Mercado Pago acredita el pago | Cliente |
| Nuevo pedido pagado | El mismo pago acreditado | Correo de la tienda |
| Cambio de estado | En preparacion, despachado, entregado, cancelado, reembolsado o rechazado | Cliente |
| Codigo para confirmar el correo | Al crear la cuenta y al pedir otro codigo | Cliente |
| Codigo para recuperar la contrasena | Desde *Recuperar contrasena* | Cliente |

El pago pendiente y el pago en revision **no** generan correo: son estados de
tramite que el cliente ya vio en la pantalla de resultado.

Al cambiar el estado desde el panel hay una casilla **Avisar al cliente por
correo**, marcada por defecto. La nota que escribas para el cliente viaja en
ese mismo correo, y el aviso de despacho incluye el numero y el enlace de
seguimiento.

### 3. Codigos de verificacion

Los codigos son de seis digitos, viven quince minutos, admiten cinco intentos
y se invalidan al usarse o al pedir uno nuevo. En la base de datos solo queda
un hash con pimienta, nunca el numero.

Confirmar el correo **no** es obligatorio para comprar: la cuenta queda creada
y la tienda insiste con un aviso en *Mi cuenta*. Recuperar la contrasena
responde siempre lo mismo exista o no la cuenta, para no revelar que correos
estan registrados.

### 4. Si un correo no llega

**Ajustes → Correo** muestra los ultimos doce envios con su estado: *Enviado*,
*Omitido* (falta configuracion) o *Fallo*, con el motivo que devolvio Resend.
Un envio marcado como fallido se puede reintentar repitiendo la accion; los
que salieron bien no se duplican aunque Mercado Pago reintente la misma
notificacion.

---

## SEO en Google

Cada producto y cada coleccion tiene su propia ficha de SEO, como en Shopify, y
la portada tiene la suya.

### El SEO de la portada

La portada es la pagina por la que se busca el **nombre de la marca**, y es la
mas dificil de posicionar en una tienda: es casi toda imagen. Un carrusel, unas
tarjetas de producto y los pies de las secciones no le dan a Google casi nada
que leer, por muy bien escritas que esten las fichas.

Se edita en **Ajustes → Tienda**:

| Campo | Que hace | Si lo dejas vacio |
| --- | --- | --- |
| Titulo de la portada en Google | El `<title>` y el titulo azul del resultado | Nombre de la tienda + tus tres primeros productos |
| Descripcion para buscadores | El parrafo gris bajo el titulo | Nombre de la tienda + hasta cinco productos + despacho y pago |
| Encabezado del texto de portada | El **h1** de la pagina, el titulo con mas peso | Nombre de la tienda + tus tres primeros productos |
| Texto de portada | El unico parrafo largo de la portada | Se arma con tus productos y colecciones |

El encabezado y el texto **se ven en la pagina**, al final, antes de los
beneficios: no son etiquetas escondidas. Debajo va una fila de enlaces con el
nombre de cada producto, que le da a Google un camino directo desde la portada
a cada ficha con la palabra exacta que se busca.

El titular del carrusel paso a ser un `h2`. El `h1` de la portada es el
encabezado del texto: cambia solo cuando tu lo cambias, mientras que el del
carrusel cambia con cada diapositiva y esta pensado para vender, no para
describir la tienda.

En los datos estructurados, la portada se declara como `OnlineStore` con el
pais al que despacha, la moneda y la lista de productos, y cada coleccion como
`CollectionPage` con su miga de pan y los productos que contiene.

> Nada de esto hace aparecer una tienda en Google de un dia para otro. Que la
> pagina diga con claridad quien es y que vende es la condicion necesaria, no
> la suficiente: despues hacen falta enlaces desde otros sitios y tiempo. Lo
> que si cambia de inmediato es que el resultado se lea bien cuando aparezca.

### Editar el SEO de un producto

1. **Productos** → abre el producto → panel **SEO en buscadores**
2. Veras la **vista previa de Google** actualizandose mientras escribes:

| Campo | Que hace | Si lo dejas vacio |
| --- | --- | --- |
| Titulo para buscadores | El `<title>` y el titulo azul del resultado | Nombre del producto + nombre de la tienda |
| Descripcion para buscadores | El parrafo gris bajo el titulo | Subtitulo y descripcion de la ficha |
| Imagen para compartir | Lo que aparece al pegar el enlace en WhatsApp o redes | Primera imagen del producto |
| Ocultar de los buscadores | `noindex` + lo saca del sitemap | Se indexa normalmente |

Los contadores marcan en rojo al pasar los **60 caracteres** del titulo o los
**160** de la descripcion, que es donde Google recorta. No se bloquea el
guardado: se avisa, porque el limite es orientativo.

La **URL** de la ficha es el campo *Slug*. Cambiarla rompe los enlaces que ya
esten publicados o indexados, asi que solo conviene tocarla antes de lanzar.

### Que se genera solo

Sin tocar nada, cada ficha ya publica:

- `<title>`, `meta description` y **canonical**;
- **Open Graph** y **Twitter Card** con imagen absoluta, para que el enlace se
  vea bien al compartirlo;
- **JSON-LD `Product`** con SKU, precio, moneda y disponibilidad real, que es lo
  que permite a Google mostrar el precio y el "En stock" en el resultado;
- **JSON-LD `BreadcrumbList`** con la ruta Inicio › Productos › Coleccion;
- en la portada, **`Organization`** y **`WebSite`** con el buscador interno;
- `sitemap.xml` y `robots.txt`, con las paginas privadas excluidas.

Al marcar *Ocultar de los buscadores*, los datos estructurados dejan de emitirse
y la URL sale del sitemap: seria contradictorio pedir que no se indexe y a la
vez ofrecerla.

### Ajustes globales

En **Ajustes → Tienda**: el nombre (que se agrega a todos los titulos), la
*Descripcion para buscadores* de la portada y el titular del hero.

### Despues de publicar

1. Da de alta el sitio en [Google Search Console](https://search.google.com/search-console)
2. Envia `https://TU-DOMINIO/sitemap.xml`
3. Comprueba una ficha en la
   [prueba de resultados enriquecidos](https://search.google.com/test/rich-results):
   debe detectar *Producto* y *Secuencia de navegacion*

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

## Operar el panel

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
| Robo de sesion | JWT en cookie `httpOnly`, `SameSite=Lax`, y `Secure` cuando `APP_URL` es https |
| Subida de archivos | Solo imagenes, maximo 10 MB, y los SVG con scripts se rechazan; la ruta de subida exige rol de administrador |
| Enlaces inyectados | Banners y menu solo aceptan rutas internas o URLs http(s) |
| Escalada de privilegios | El rol se comprueba contra la base de datos en cada pagina del panel, no solo en el token |
| Acceso a pedidos ajenos | Las consultas filtran por usuario; los invitados usan un token aleatorio de 192 bits |
| Redirecciones abiertas | Solo se aceptan rutas internas en el parametro `next` |
| XSS | React escapa el contenido; no se usa `dangerouslySetInnerHTML` |
| CSRF | Server Actions con verificacion de origen de Next.js; cierre de sesion solo por POST |
| Cotizacion de envio manipulada | El costo se recotiza en el servidor al confirmar; la tarifa que vio el navegador es informativa |
| Caida del courier | Respaldo automatico a tarifa plana, con aviso al comprador |
| Logo subido por el panel | Solo PNG/JPG/WEBP/SVG hasta 256 KB; los SVG con scripts se rechazan |
| Datos de tarjeta | Nunca pasan por este servidor: los captura Mercado Pago |

---

## Pruebas

```bash
npm run test
```

Cubre 86 comprobaciones sobre:

- validacion de la firma `x-signature` (valida, alterada, ausente, mal formada,
  antigua y sin `request-id`);
- validacion del formulario de checkout y del panel;
- calculo de totales, cupones y limites de descuento;
- reserva de stock y prevencion de sobreventa;
- reversion de pedidos que no llegaron a la pasarela;
- idempotencia del webhook, verificacion de montos y devolucion de stock;
- cotizador de envios: cascada completa (gratis, courier, tarifa manual, tarifa
  general), regiones bloqueadas, plazos, transportista configurable, enlaces de
  seguimiento y padron de regiones;
- SEO: titulos y descripciones de respaldo, limites de caracteres, recorte sin
  partir palabras, URLs absolutas y vista previa de Google;
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
    (tienda)/             sitio publico, con su cabecera y pie
      page.tsx            portada
      products/           catalogo y ficha de producto
      coleccion/[slug]/   paginas de coleccion
      carrito/ checkout/  compra
      cuenta/             acceso, y area privada: resumen, pedidos, datos, direccion y seguridad
      seguimiento/        consulta de pedidos
    (panel)/admin/        panel de administracion, con layout propio
    api/
      webhooks/mercadopago/   receptor de notificaciones
      envio/cotizar/          cotizacion en vivo de Blue Express
      media/[id]/             servido de las imagenes subidas
      admin/media/            subida de imagenes (solo administradores)
      auth/logout/            cierre de sesion
      health/                 healthcheck
    actions/              Server Actions (carrito, checkout, cuenta, admin)
  components/             interfaz de tienda y panel
  lib/
    email/                correo transaccional
      resend.ts           cliente HTTP del proveedor
      layout.ts           armado del HTML, en tablas y estilos en linea
      templates.ts        cada correo: asunto, HTML y texto plano
      send.ts             registro, idempotencia y tolerancia a fallos
      notifications.ts    los correos ya conectados a los pedidos
    verification.ts       codigos de un solo uso
    media.ts              subida, servido y limpieza de imagenes
    mercadopago.ts        preferencias, consulta de pagos y firma del webhook
    seo.ts                titulos, descripciones y respaldos para buscadores
    product-blocks.ts     tipos y ayudas de los bloques de contenido del producto
    shipping/             cotizador de envios
      bluexpress.ts       cliente de la API de Blue Express
      index.ts            eleccion de tarifa y respaldo
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

**Editar una coleccion:** en *Colecciones*. Ahi tambien se define su SEO y su
orden en la portada.

**Cambiar el logo:** en *Ajustes → Marca*. Se guarda en la base de datos, no
en disco, para que sobreviva a los redespliegues de Coolify.

**Cambiar el icono de la pestana (favicon):** en *Ajustes → Marca*, mismo
formulario. Sube un PNG cuadrado (512x512) o un SVG; no hace falta tocar el
repositorio. `public/icon.svg` es solo el icono por defecto, el que se usa
mientras no subas ninguno.

**Cambiar de moneda o pais:** ajusta `MP_CURRENCY` y los valores de envio. Las
monedas sin decimales (CLP, COP) se redondean a entero automaticamente.

**Copias de seguridad:** todo el estado vive en PostgreSQL. En Coolify activa
los backups programados de la base de datos.

**Registros:** los eventos relevantes (accesos, cambios de pedido, webhooks)
quedan en la tabla `AuditLog` y se ven en *Ajustes → Actividad reciente*.

---

## Nota sobre imagenes y marca

El diseno de referencia usa fotografia de producto de Wacaco, que no se
redistribuye en este repositorio. En su lugar `scripts/generate-art.mjs` genera
ilustraciones de linea, de modo que la tienda funciona sin depender de ningun
host externo. Para usar las fotos oficiales, subelas a `public/products/` y
actualiza las URLs en la ficha de cada producto.

Tampoco se dibuja ningun isotipo: el logotipo lo subes tu en *Ajustes → Marca* y
hasta entonces se muestra el nombre de la tienda en la tipografia del sitio. El
icono del navegador (`public/favicon.ico`) es una figura geometrica neutra que
puedes reemplazar por el tuyo.
