# StockHogar

Control de stock de la casa: **sectores → muebles → compartimientos → productos**.
Cada mueble tiene su código QR: lo escaneás y caés directo en su lista para sumar
o descontar lo que sacaste.

Hecho con Next.js 16, PostgreSQL (Neon) y Drizzle ORM.

---

## Puesta en marcha

```bash
npm install
```

El archivo `.env` ya tiene la conexión a Neon. Las otras dos variables son:

| Variable | Para qué sirve |
| --- | --- |
| `DATABASE_URL` | Conexión PostgreSQL. |
| `AUTH_SECRET` | Firma las sesiones. Si la cambiás, se cierran todas las sesiones abiertas. |
| `NEXT_PUBLIC_APP_URL` | URL de respaldo para armar los links de los QR. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `ADMIN_FAMILY` | Opcionales. Las lee **sólo** el script `db:admin`, nunca la app en tiempo de ejecución. |

Creá las tablas (una sola vez):

```bash
npm run db:push
```

Si venís de una versión anterior, las migraciones de `drizzle/` se aplican una
por una con el script que las corre en una transacción. La última es la carga
en lote:

```bash
node --env-file=.env scripts/aplicar-sql.mjs drizzle/0003_carga_en_lote.sql
```

Creá tu cuenta de administrador:

```bash
npm run db:admin -- --email tucorreo@ejemplo.com --password tuclave --nombre "Tu nombre" --familia "Mi casa"
```

Levantá la app:

```bash
npm run dev
```

Entrá a <http://localhost:3000> e ingresá con esa cuenta.

### Alta y recuperación del administrador

`npm run db:admin` es idempotente: podés correrlo todas las veces que quieras.

- Si el correo **no existe**, crea la cuenta como administrador.
- Si **ya existe**, le pone el rol de administrador, la reactiva si estaba
  desactivada, la asigna a una familia si no tenía, y **cambia la contraseña
  sólo si le pasás una**. Es tu vía de escape si te olvidás la clave: la app no
  tiene "recuperar contraseña" por correo.

Los argumentos se pueden reemplazar por `ADMIN_EMAIL` / `ADMIN_PASSWORD` /
`ADMIN_NAME` / `ADMIN_FAMILY` en el `.env`, que es lo cómodo para automatizar un
deploy. Si preferís no dejar la contraseña escrita en el archivo, pasala siempre
por argumento.

> **Antes de publicar la app, creá el administrador.** Mientras no exista ningún
> usuario, `/instalacion` deja que cualquiera que entre se quede con la cuenta de
> administrador. En cuanto hay uno, esa pantalla se cierra sola y redirige al
> login.

### Datos de ejemplo (opcional)

Podés cargar una cocina de muestra —heladera con freezer y heladera, alacena,
botiquín y lavadero— con:

```bash
npm run db:seed -- --admin tucorreo@ejemplo.com
```

---

## Cómo está organizado el stock

La casa es una jerarquía de lugares:

```
Sector          Cocina
└── Mueble      Heladera            ← acá va el QR
    ├── Compartimiento  Freezer
    └── Compartimiento  Heladera
```

Y el producto está partido en dos ideas, para no escribir lo mismo dos veces:

```
Producto (catálogo — se escribe UNA vez por familia)
  Queso cremoso · se mide en gramos · salto 50 g · avisar bajo 250 g

Existencias (dónde está y cuánto — muchas por producto)
  ├── Cocina · Heladera · Freezer     → 1000 g
  └── Cocina · Heladera · Heladera    →  750 g
                                total → 1750 g
```

El **catálogo** guarda lo que no cambia según el lugar: nombre, unidad
(unidades, paquetes, kg, g, L, ml), el salto de los botones `+` y `−`, la nota
y el mínimo de toda la casa. Las **existencias** guardan la cantidad de cada
lugar y, opcionalmente, su vencimiento, una nota y un mínimo propio.

Cuando agregás algo a un compartimiento, primero buscás en el catálogo: si el
producto ya existe, lo único que escribís es la cantidad. El formulario largo
aparece sólo cuando el producto es realmente nuevo.

### Los dos avisos

| Aviso | Cuándo aparece | Qué significa |
| --- | --- | --- |
| **Comprar** | La suma de todos los lugares no llega al mínimo del producto | Falta en la casa: va a la lista de compras. |
| **Traer acá** | Una existencia no llega a su propio mínimo | Hay en la casa, pero no donde se usa. Alcanza con acercarlo. |

El segundo es opcional y sirve para el caso típico: 2 rollos de papel en el
baño con 12 de reserva en la pieza. En total sobra, pero el baño necesita que
alguien acerque unos cuantos.

### Lista de compras

En **Compras** se junta todo lo que hay que resolver, y la puede usar cualquier
integrante de la familia:

- **Falta en la casa** — se arma sola con los productos por debajo de su
  mínimo, y calcula cuánto comprar. El botón **Ya lo compré** pregunta cuánto
  trajiste y dónde lo guardaste: con eso entra al stock y desaparece de la
  lista.
- **No hace falta comprar** — lo que está faltando sólo en un lugar. Se avisa
  aparte para no comprar de más cuando alcanza con acercarlo.
- **Anotado a mano** — ítems sueltos que no se controlan por stock (pilas, una
  lamparita). Cualquiera los anota, los tacha y los borra: son notas para ir al
  super, no inventario, así que no piden ser administrador.

**Copiar lista** deja todo en el portapapeles para pegarlo en WhatsApp.

### Cargar la compra en lote

**Ya lo compré** está bien para una cosa suelta. Para la vuelta del super con
ochenta productos está **Cargar la compra**, que abre un borrador con todo lo
que faltaba: cantidad sugerida y lugar ya elegidos.

Ahí se revisa todo junto en una sola pantalla —`+` / `−` o el número para la
cantidad, un desplegable para el lugar— y recién al apretar **Guardar todo**
impacta en el stock, en una sola transacción: o entran los ochenta o no entra
ninguno.

Detalles que hacen la diferencia con ochenta ítems:

- **El borrador vive en la base**, no en el navegador. Se puede empezar en el
  super, seguir en casa desde otro teléfono y retomarlo si se corta. Hay uno
  solo abierto por familia y aparece anunciado arriba de la lista de compras.
- **Cada producto aprende dónde va.** Al confirmar se guarda el compartimiento
  usado en `products.default_compartment_id`, así la próxima compra ya viene
  con el lugar puesto y deja de preguntar "¿dónde lo pongo?".
- **Lo que no estaba en el catálogo se crea en el momento**, con lo mínimo
  (nombre y unidad). El resto de la ficha se completa después.
- **Saltear** deja el renglón anotado pero sin impacto; **la papelera** lo saca
  del lote. Ninguna de las dos toca el stock.
- Un producto repetido en dos renglones del mismo lugar se suma antes de
  escribir, porque en el stock hay una sola fila por producto y lugar.
- Todo queda en el historial como reposición, con la nota "Carga de compras".

Los renglones son una tabla (`intake_lines`) que no sabe de dónde salió cada
uno: hoy los llena la lista de compras o el buscador, y el mismo borrador y la
misma pantalla de revisión sirven para lo que venga después (una foto del
ticket, un escáner de códigos de barras, un dictado).

### Cómo se descuenta

En la tarjeta de cada producto:

- `−` y `+` suman o restan el salto configurado. Los toques seguidos se juntan y
  se guardan de una sola vez, así podés apretar rápido sin esperar.
- Tocando **el número** se abre el panel de ajuste: atajos de `−500 / −250 / −100
  / −50`, los mismos en positivo, y un campo para poner la cantidad exacta
  cuando contás lo que realmente hay.
- Desde el menú de la tarjeta podés **mover** una cantidad a otro lugar (por
  ejemplo pasar 1 kg del freezer a la heladera): queda registrado como traslado
  en los dos lugares y el total de la casa no cambia.
- Todo movimiento queda en el historial con quién lo hizo, dónde y cuándo. El
  historial es del producto, así que se ven mezclados todos sus lugares.

---

## Roles

| Acción | Integrante | Administrador |
| --- | :---: | :---: |
| Ver el stock de su familia | ✅ | ✅ |
| Usar la lista de compras (anotar, tachar, borrar ítems) | ✅ | ✅ |
| Sumar y descontar cantidades | ✅ | ✅ |
| Agregar productos y guardarlos en un mueble | ✅ | ✅ |
| Cargar una compra en lote (abrir, revisar, confirmar, descartar) | ✅ | ✅ |
| Mover cantidades de un lugar a otro | ✅ | ✅ |
| Editar productos, sectores, muebles y compartimientos | ✅ | ✅ |
| **Sacar** un producto de un lugar | ❌ | ✅ |
| **Eliminar** productos, sectores, muebles y compartimientos | ❌ | ✅ |
| Crear, editar y eliminar usuarios | ❌ | ✅ |
| Asignar usuarios a familias | ❌ | ✅ |
| Cambiar la contraseña de otro usuario | ❌ | ✅ |
| Cambiar su propia contraseña | ✅ | ✅ |
| Regenerar el QR de un mueble | ❌ | ✅ |

Los permisos se validan en el servidor dentro de cada server action, no sólo
escondiendo botones. Además, todas las consultas están acotadas a la familia del
usuario: nadie puede ver ni tocar el stock de otra casa.

---

## Códigos QR

- Cada mueble recibe un token corto e irrepetible al crearse.
- El QR apunta a `/m/<token>`, que redirige al mueble. Si la persona no tiene la
  sesión abierta, primero pasa por el login y después vuelve sola al mueble.
- En **Códigos QR** están todos juntos para imprimir de una (`Imprimir todo`), y
  desde cada mueble podés descargar el PNG suelto.
- Si un código se pierde o se filtra, el administrador lo regenera y el viejo
  deja de funcionar.

> Los QR usan el dominio desde el que estés navegando. Para escanearlos con el
> celular, entrá a la app por la IP de tu PC en la red (por ejemplo
> `http://192.168.0.10:3000`) o desde el dominio donde la publiques, y generá los
> códigos desde ahí.

---

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` / `npm start` | Build y arranque de producción. |
| `npm run db:push` | Sincroniza el esquema con la base. |
| `npm run db:generate` | Genera el SQL de migración en `drizzle/`. |
| `npm run db:studio` | Explorador visual de la base. |
| `npm run db:admin -- --email … --password …` | Crea el administrador o le recupera el acceso. |
| `npm run db:seed -- --admin correo@…` | Carga los datos de ejemplo. |
| `npm run typecheck` | TypeScript sin emitir archivos. |
| `npm run lint` | ESLint. |

---

## Estructura

```
app/
  (auth)/      ingresar · instalacion
  (app)/       inicio · sectores · muebles · productos · compras · buscar · qr · cuenta · admin
    compras/cargar/[id]/   revisión de la carga en lote
  m/[token]/   destino de los códigos QR
components/
  ui/          botones, campos, modales, toasts
  stock/       tarjeta de producto, formularios, QR, íconos
lib/
  db/          esquema y cliente de Drizzle
  actions/     server actions (auth, stock, compras, carga en lote, admin)
  auth.ts      sesión y guardas de rol
  password.ts  hashing y reglas de contraseña (lo usan la app y los scripts)
  queries.ts   lecturas acotadas por familia
scripts/
  admin.ts             alta y recuperación del administrador
  aplicar-sql.mjs      aplica un .sql de drizzle/ en una transacción
  seed.ts              datos de ejemplo
  migrar-catalogo.mjs  migración al modelo catálogo + existencias
```

## Nota sobre la migración al catálogo

Las primeras versiones guardaban el producto colgado de un compartimiento, así
que el mismo queso en dos lugares eran dos filas sin relación. `scripts/migrar-catalogo.mjs`
aplica `drizzle/0001_catalogo.sql`: agrupa los duplicados por nombre, crea una
existencia por lugar y reapunta el historial.

No borra nada. Deja un respaldo en `respaldos/` y conserva la tabla vieja como
`products_legacy`. Cuando estés seguro de que quedó todo bien, se puede
eliminar con `DROP TABLE products_legacy;`. Hasta entonces, `drizzle-kit push`
va a ofrecer borrarla porque no está en el esquema: es esperable.
