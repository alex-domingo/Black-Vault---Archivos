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
npm run dev
```

Al arrancar crea la base `black_vault` con sus colecciones, validadores e índices. Comprueba que responde en <http://localhost:8000/api/salud>.

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
| 2 | Autenticación y usuarios | ⏳ |
| 3 | Carpetas y archivos | ⏳ |
| 4 | Compartición y comentarios | ⏳ |
| 5 | Papelera e historial | ⏳ |
| 6 | Reportes | ⏳ |
| 7 | Carga inicial completa | ⏳ |
| 8 | Documentación y entrega | ⏳ |
