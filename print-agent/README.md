# Agente de impresion

Programa chico que corre en el PC que tiene la impresora (la Brother de la
casa) y saca de la cola lo que Claude manda a imprimir:

- **Etiquetas de Mercado Envios** de la cuenta de Mercado Libre (Wacaco / nomadbrew).
- **Packing slips** de los pedidos de TAUPOC.

```
Tu: "imprime las etiquetas pendientes de TAUPOC y Mercado Libre"
        |
Claude ── ml_imprimir_etiquetas (Wacaco) ──┐
       └─ imprimir_packing_slips (TAUPOC) ─┤  cada tienda arma el PDF y lo deja en su cola
                                           v
              agente.mjs en tu PC (pregunta cada 15 s) ──> Brother
```

Las tiendas nunca se conectan a tu PC: es el agente el que sale a buscar los
trabajos por HTTPS. No hay que abrir puertos en el router y funciona aunque le
pidas a Claude desde el celular estando fuera de la casa: lo encolado se
imprime apenas el PC este encendido.

## 1. En el servidor (una vez por tienda)

En Coolify agrega la variable `PRINT_AGENT_TOKEN` a **Wacaco** y a **TAUPOC**
y redespliega. Genera una distinta para cada una:

```bash
openssl rand -hex 32
```

Sin esa variable las herramientas de impresion quedan apagadas (y la de
Mercado Libre no descarga nada, para no marcar etiquetas como impresas sin
imprimirlas).

## 2. En el PC

1. Instala **Node.js LTS** desde <https://nodejs.org>.
2. **Windows:** instala **SumatraPDF** desde <https://www.sumatrapdfreader.org>
   (es lo que manda el PDF a la impresora sin abrir ventanas). En macOS y Linux
   no hace falta nada: se usa `lp`.
3. Copia esta carpeta `print-agent` al PC (por ejemplo a `C:\agente-impresion`).
4. Copia `config.example.json` como `config.json` y completa:
   - `impresora`: el nombre exacto de la Brother. Para verlo:
     ```
     node agente.mjs --impresoras
     ```
     Vacio = la impresora predeterminada.
   - `tiendas[].url`: la direccion publica de cada tienda.
   - `tiendas[].token`: el `PRINT_AGENT_TOKEN` de esa tienda.
   - `impresoras` (opcional, normalmente vacio): si algun dia quieres mandar
     las etiquetas (`ml_label`) o los packing slips (`packing_slip`) a otra
     impresora. Vacio usa `impresora`.
5. Prueba:
   ```
   node agente.mjs --probar
   ```
   Tiene que decir `OK` en las dos tiendas (y encontrar SumatraPDF en Windows).
6. Dejalo corriendo:
   - **Windows**: clic derecho en `instalar-windows.ps1` → *Ejecutar con
     PowerShell*. Crea una tarea programada que arranca sola al iniciar sesion,
     sin ventana, y se reinicia si se cae. Para quitarla:
     `Unregister-ScheduledTask -TaskName "Agente de impresion" -Confirm:$false`
   - **macOS / Linux**: `node agente.mjs` dentro de `tmux`, o un servicio de
     `launchd` / `systemd` que lo ejecute.

Todo lo que imprime (y cada error) queda en `agente.log`, en esta carpeta.

## 3. Pedirselo a Claude

Con los dos conectores MCP agregados (Mercado Libre de Wacaco y TAUPOC):

- *"Imprime las etiquetas pendientes de TAUPOC y Mercado Libre"*
- *"Cuantas etiquetas de Mercado Libre tengo por imprimir?"* (solo mira)
- *"Reimprime la etiqueta del envio 44123456789"*
- *"Imprime el packing slip del TP-1042, 2 copias"*
- *"Se imprimio lo que mande?"* (revisa la cola y si el agente esta conectado)

| Tienda | Herramientas |
| --- | --- |
| Wacaco (Mercado Libre) | `ml_etiquetas_pendientes`, `ml_imprimir_etiquetas`, `ml_cola_impresion`, `ml_cancelar_impresion` |
| TAUPOC | `packing_slips_pendientes`, `imprimir_packing_slips`, `cola_impresion`, `cancelar_impresion` |

## Como se comporta

- **Pendiente** en Mercado Libre = envio `ready_to_ship / ready_to_print` (listo
  para despachar y sin imprimir). Al descargarla Mercado Libre la marca
  `printed`, igual que si la bajaras desde su panel. Los envios Full no tienen
  etiqueta y se ignoran.
- **Pendiente** en TAUPOC = pedido `PAID` o `PROCESSING` cuyo packing slip no se
  ha impreso por esta via. Imprimir no cambia el estado del pedido.
- Lo que ya esta en la cola no se vuelve a encolar aunque se pida dos veces.
- Si el agente descarga un trabajo y no avisa en 10 minutos (se apago el PC a
  mitad), vuelve a la cola. Un error de impresora se reintenta hasta 3 veces y
  despues queda como fallido con el motivo, visible para Claude.
- Los trabajos se borran solos a los 30 dias.
- Pensado para una impresora de hoja normal (laser o tinta). Mercado Libre
  entrega cada etiqueta en una pagina de 10 x 15 cm; la tienda las acomoda **2
  por hoja carta, a tamano real**, para que no salgan ampliadas a una hoja
  entera. Los packing slips salen uno por hoja. El agente ajusta cada pagina al
  papel cargado ("fit"), asi que funciona igual con carta o A4.
