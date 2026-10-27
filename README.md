# Tamales Tolimenses — prototipo frontend móvil

Prototipo de cliente basado en la ilustración aprobada. No incluye administrador, Firebase ni backend. Utiliza `data.json` como configuración inicial y `localStorage` para conservar el inventario de demostración y el borrador del pedido.

## Archivos
- `index.html`: pantallas de inicio, producto, resumen, cerrado y ubicación.
- `styles.css`: diseño mobile-first.
- `app.js`: navegación, horario, inventario de demostración y envío del pedido a WhatsApp.
- `data.json`: datos editables de la marca, horario, dirección, precios y stock.
- `assets/tamal-hero.jpg`: imagen de producto.

## Cómo ejecutarlo
Recomendado: abre la carpeta en VS Code y usa Live Server. La página intenta leer `data.json`. Si abres el HTML directamente con `file://`, usa una configuración de respaldo incluida en `app.js`.

## Estados para la demostración
- `index.html?demo=abierto` — presenta la pantalla de inicio abierta, respetando que haya stock.
- `index.html?demo=horario` — presenta el estado cerrado por horario.
- `index.html?demo=agotado` — presenta el estado cerrado por existencias agotadas.
- Sin `demo` en la URL — calcula el estado real según la hora de Bogotá y el stock guardado en el navegador.

Con Live Server, por ejemplo:
- `http://127.0.0.1:5500/index.html?demo=abierto`
- `http://127.0.0.1:5500/index.html?demo=horario`
- `http://127.0.0.1:5500/index.html?demo=agotado`

Estos parámetros son únicamente ayudas para presentar el prototipo. No son un panel administrativo.

## Horario
En `data.json`, la sección `hours` define:
- `openDays`: días de apertura en formato JavaScript (`0` domingo, `1` lunes, ..., `6` sábado). Por defecto: `[4, 5, 6, 0]` (jueves a domingo).
- `openHour`: hora de apertura, en formato 24 horas (`7` = 7:00 a. m.).
- `closeHour`: hora de cierre (`22` = 10:00 p. m.).
- `openLabel`: texto visible del horario.

El sistema utiliza la zona horaria `America/Bogota`. Para cambiar el horario, modifica esos valores en `data.json`. Si `localStorage` ya tiene inventario, ese inventario persistirá hasta que se borre.

## Inventario de demostración
Los valores iniciales son:
- Normal: 18 unidades.
- Picante: 12 unidades.

El inventario se guarda en `localStorage` bajo la clave `tamalesTolimensesInventoryV1`. Para probar manualmente que ambos sabores se agotaron, abre la consola del navegador y ejecuta:

```js
localStorage.setItem("tamalesTolimensesInventoryV1", JSON.stringify({ normal: 0, picante: 0 }));
location.reload();
```

Para restaurar las existencias iniciales de `data.json`, ejecuta:

```js
localStorage.removeItem("tamalesTolimensesInventoryV1");
localStorage.removeItem("tamalesTolimensesDraftV1");
location.reload();
```

Para probar un sabor agotado y otro disponible:

```js
localStorage.setItem("tamalesTolimensesInventoryV1", JSON.stringify({ normal: 0, picante: 12 }));
location.reload();
```

El prototipo no descuenta inventario al abrir WhatsApp porque el envío de un mensaje no confirma una venta.

## WhatsApp y datos
Edita `whatsapp`, `address`, `mapsUrl`, precios y existencias en `data.json`. Cambia `whatsapp` por el número real con indicativo internacional, sin `+`, espacios ni guiones.

`localStorage` solo afecta el navegador donde se usa. No sincroniza existencias entre dispositivos; eso requeriría un backend o una base de datos compartida.
