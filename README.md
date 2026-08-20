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

```
Sector          Cocina
└── Mueble      Heladera            ← acá va el QR
    ├── Compartimiento  Freezer     → 2 kg carne molida, 1 kg helado
    └── Compartimiento  Heladera    → mayonesa, 3 mantecas, 750 g de queso
```

Cada producto guarda su **unidad** (unidades, paquetes, kg, g, L, ml), un
**mínimo** para avisar cuándo hay que reponer y el **salto** que aplican los
botones `+` y `−`. Por ejemplo el queso se mide en gramos y descuenta de a 50.

### Cómo se descuenta

En la tarjeta de cada producto:

- `−` y `+` suman o restan el salto configurado. Los toques seguidos se juntan y
  se guardan de una sola vez, así podés apretar rápido sin esperar.
- Tocando **el número** se abre el panel de ajuste: atajos de `−500 / −250 / −100
  / −50`, los mismos en positivo, y un campo para poner la cantidad exacta
  cuando contás lo que realmente hay.
- Todo movimiento queda en el historial con quién lo hizo y cuándo.

---

## Roles

| Acción | Integrante | Administrador |
| --- | :---: | :---: |
| Ver el stock de su familia | ✅ | ✅ |
| Sumar y descontar cantidades | ✅ | ✅ |
| Agregar productos | ✅ | ✅ |
| Editar productos, sectores, muebles y compartimientos | ✅ | ✅ |
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
  (app)/       inicio · sectores · muebles · buscar · qr · cuenta · admin
  m/[token]/   destino de los códigos QR
components/
  ui/          botones, campos, modales, toasts
  stock/       tarjeta de producto, formularios, QR, íconos
lib/
  db/          esquema y cliente de Drizzle
  actions/     server actions (auth, stock, admin)
  auth.ts      sesión y guardas de rol
  password.ts  hashing y reglas de contraseña (lo usan la app y los scripts)
  queries.ts   lecturas acotadas por familia
scripts/
  admin.ts     alta y recuperación del administrador
  seed.ts      datos de ejemplo
```
