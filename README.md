# Black Vault

Sistema de gestión documental: almacenar, organizar, consultar y compartir archivos `.txt` y `.md` entre usuarios, con arquitectura cliente-servidor y MongoDB.

| Parte | Carpeta | Tecnología |
|---|---|---|
| Cliente | `black-vault-angular-client/` | Angular 21 LTS + Angular Material |
| Servidor (API REST) | `black-vault-express-server/` | Node.js 24 + Express 5 + driver oficial de MongoDB |
| Base de datos | — | MongoDB 9.0 (contenido de archivos en GridFS) |
| Documentación | `docs/` | Análisis, diseño y modelo documental |

## Requisitos

- Windows 10/11 (o cualquier sistema con las mismas versiones)
- Node.js 24.12 o superior
- MongoDB 9.0 ejecutándose en `127.0.0.1:27017` (servicio "MongoDB" en Windows)
- MongoDB Compass (opcional, para explorar los datos)

## Puesta en marcha

### 1. Servidor

```powershell
cd black-vault-express-server
copy .env.example .env
npm install
npm run semilla
npm run dev
```

- En `.env`, cambia `JWT_SECRETO` por una cadena aleatoria de 32 caracteres o más. Puedes generarla con
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
- `npm run semilla` **borra y vuelve a crear** la base `black_vault` con sus colecciones, validadores, índices y los datos de demostración. Pide confirmación (escribe `SI`); con `npm run semilla -- --forzar` no pregunta.
- `npm run dev` arranca la API. Si la base no existe, crea sus colecciones, validadores e índices (vacías). Comprueba que responde en <http://localhost:8000/api/salud>.

### 2. Cliente

```powershell
cd black-vault-angular-client
npm install
npm start
```

Abre <http://localhost:4200>. El indicador de la barra superior muestra si la API y MongoDB están conectados.

### Pruebas

```powershell
# Servidor (usa una base aparte: black_vault_pruebas)
cd black-vault-express-server
npm test

# Cliente
cd black-vault-angular-client
npx ng test --watch=false
```

## Usuarios de demostración

Los crea `npm run semilla`. Se puede entrar con el usuario o con el correo (`usuario@blackvault.gt`).

| Usuario | Nombre | Rol | Contraseña |
|---|---|---|---|
| `admin` | Administrador del Sistema | Administrador | `Admin2026` |
| `mlopez` | María Fernanda López | Usuario | `Usuario2026` |
| `jramirez` | José Antonio Ramírez | Usuario | `Usuario2026` |
| `agarcia` | Ana Lucía García | Usuario | `Usuario2026` |
| `cmorales` | Carlos Eduardo Morales | Usuario | `Usuario2026` |
| `smendez` | Sofía Alejandra Méndez | Usuario | `Usuario2026` |
| `rcastillo` | Ricardo Castillo Ordóñez | Usuario | `Usuario2026` |
| `lhernandez` | Laura Beatriz Hernández | Usuario | `Usuario2026` |
| `dperez` | Diego Andrés Pérez | Usuario | `Usuario2026` |
| `vrodriguez` | Valeria Rodríguez Muñoz | Usuario | `Usuario2026` |
| `fsoto` | Fernando Soto Cifuentes | Usuario | `Usuario2026` |
| `pjuarez` | Paola Juárez Estrada | Usuario (**inactiva**) | `Usuario2026` |

`pjuarez` está desactivada a propósito: no puede iniciar sesión, pero su información se conserva.

### Documentos de demostración

La semilla también carga **57 archivos** (.txt y .md) en **38 carpetas** repartidas entre 11 usuarios, con categorías,
etiquetas y fechas de 2026. El contenido se guarda en GridFS (bucket `contenidos`) y el espacio usado de cada usuario
coincide con la suma de sus archivos. Algunos casos para probar:

| Usuario | Qué mirar |
|---|---|
| `mlopez` | `Contratos/2026/Clientes` (tres niveles), y `Notas de Windows.txt`, que tiene BOM y saltos CRLF: al editarlo y descargarlo se conservan. |
| `jramirez` | `Registro antiguo de caja chica.txt` está en Latin-1: se puede ver y descargar, pero no editar, para no dañarlo. |
| cualquiera | **Búsqueda**: por nombre o por texto, con filtros de tipo, categoría, etiqueta y rango de fechas. |

También hay **34 comparticiones** entre áreas y **20 comentarios**. Casos para probar el acceso:

| Usuario | Qué mirar |
|---|---|
| `mlopez` | **Compartidos → Por mí**: `Contratos/2026` lo ve Laura (lectura) y la subcarpeta `Clientes` la comenta José. Desde el menú de un archivo o carpeta, **Compartir** muestra el acceso directo y el heredado. |
| `jramirez` | **Compartidos → Conmigo → Clientes**: puede leer y comentar los contratos, pero no editarlos. |
| `lhernandez` | Ve los contratos de 2026 (heredado de la carpeta) solo con lectura: los comentarios se ven, pero no puede escribir. |
| `dperez` | Tiene edición en `Proyecto Atlas` de Sofía: el *checklist* que subió allí es de Sofía y usa su espacio. |
| `agarcia` | Sigue viendo el informe que le compartió `pjuarez` antes de que su cuenta se desactivara. |

La papelera llega en la Fase 5; por ahora no hay archivos eliminados.

## MongoDB con autenticación

Si tu instancia exige usuario y contraseña, crea un usuario solo para la aplicación. En la consola mongosh de Compass, conectado como administrador:

```js
use admin
db.createUser({
  user: "blackvault",
  pwd: "TU_CLAVE",
  roles: [
    { role: "readWrite", db: "black_vault" },         { role: "dbAdmin", db: "black_vault" },
    { role: "readWrite", db: "black_vault_pruebas" }, { role: "dbAdmin", db: "black_vault_pruebas" }
  ]
})
```

Y en `.env`: `URI_MONGODB=mongodb://blackvault:TU_CLAVE@127.0.0.1:27017/black_vault?authSource=admin`.
Si la clave tiene símbolos, van codificados (`@` → `%40`, `#` → `%23`, `:` → `%3A`, `/` → `%2F`, `%` → `%25`).

## Transacciones (opcional)

Una instalación normal de MongoDB es *standalone*: el servidor lo detecta y ejecuta las operaciones compuestas en orden y con compensación. Si conviertes la instancia en un replica set de un nodo, usará transacciones automáticamente:

1. En `C:\Program Files\MongoDB\Server\9.0\bin\mongod.cfg` agrega:
   ```yaml
   replication:
     replSetName: rs0
   ```
2. Reinicia el servicio "MongoDB" y, en la consola mongosh de Compass, ejecuta `rs.initiate()`.
3. En `.env`: `URI_MONGODB=mongodb://127.0.0.1:27017/black_vault?replicaSet=rs0`.

## Estado del desarrollo

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Análisis y diseño | ✅ |
| 1 | Base del servidor y del cliente | ✅ |
| 2 | Autenticación y usuarios | ✅ |
| 3 | Carpetas y archivos | ✅ |
| 4 | Compartición y comentarios | ✅ |
| 5 | Papelera e historial | ⏳ |
| 6 | Reportes | ⏳ |
| 7 | Carga inicial completa | ⏳ |
| 8 | Documentación y entrega | ⏳ |
