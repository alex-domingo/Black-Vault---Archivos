# Black Vault

Sistema de gestión documental para guardar, organizar y compartir archivos `.txt` y `.md` entre usuarios.

- **Cliente:** `black-vault-angular-client/` (Angular 21 + Angular Material)
- **Servidor:** `black-vault-express-server/` (Node.js 24 + Express 5)
- **Base de datos:** MongoDB 9.0 (el contenido de los archivos va en GridFS)
- **Documentación:** `docs/` (manual técnico, manual de usuario y diagramas UML)

## Requisitos

- Node.js 24.12 o superior
- MongoDB 9.0 ejecutándose en `127.0.0.1:27017`

## 1. Levantar el servidor

```powershell
cd black-vault-express-server
copy .env.example .env
npm install
npm run dev
```

En `.env`, cambia `JWT_SECRETO` por una cadena aleatoria de 32 caracteres o más. La API queda en <http://localhost:8000/api/salud>.

## 2. Cargar la base de datos

Con MongoDB encendido, desde `black-vault-express-server`:

```powershell
npm run semilla
```

**Borra y vuelve a crear** la base `black_vault` con los datos de demostración (usuarios, carpetas, archivos, comparticiones e historial). Pide escribir `SI` para confirmar; `npm run semilla -- --forzar` no pregunta.

## 3. Levantar el cliente

```powershell
cd black-vault-angular-client
npm install
npm start
```

Abre <http://localhost:4200>.

## Usuarios de demostración

Se puede entrar con el usuario o con el correo (`usuario@blackvault.gt`).

| Usuario | Rol | Contraseña |
|---|---|---|
| `admin` | Administrador | `Admin2026` |
| `mlopez`, `jramirez`, `agarcia`, `cmorales`, `smendez`, `rcastillo`, `lhernandez`, `dperez`, `vrodriguez`, `fsoto` | Usuario | `Usuario2026` |
| `pjuarez` | Usuario **desactivado** (no puede entrar) | `Usuario2026` |

## Otros comandos (en `black-vault-express-server`)

| Comando | Qué hace |
|---|---|
| `npm run integridad` | Revisa que los datos de la base sean consistentes |
| `npm test` | Pruebas del servidor (usa otra base: `black_vault_pruebas`) |

Las pruebas del cliente se corren con `npx ng test --watch=false` en `black-vault-angular-client`.

## Si MongoDB pide usuario y contraseña

Cambia `URI_MONGODB` en `.env`:

```
URI_MONGODB=mongodb://USUARIO:CLAVE@127.0.0.1:27017/black_vault?authSource=admin
```

Si la clave tiene símbolos, van codificados: `@` → `%40`, `#` → `%23`, `:` → `%3A`, `/` → `%2F`, `%` → `%25`.
