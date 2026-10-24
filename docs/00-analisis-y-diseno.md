# Black Vault — Análisis de requerimientos y diseño

> **Fase 0** · 21 de octubre de 2026 · Documento base del desarrollo. De aquí saldrán la documentación del modelo documental y el manual técnico que pide la entrega.
> Fuente: *Sistema de Gestión Documental.pdf* (6 páginas). Las referencias "p. N" apuntan a sus páginas.

---

## 0. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Sistema operativo de desarrollo | Windows 10 22H2 · VS Code |
| Servidor | Node.js 24.12.0 + Express 5.3.0, JavaScript con módulos ES (`"type": "module"`) |
| Acceso a datos | Driver oficial `mongodb` 7.x, **sin ODM** |
| Base de datos | MongoDB 9.0.4 (+ Compass 1.53.0) · base `black_vault` |
| Cliente | Angular 21 LTS (instalado 21.2.x), componentes standalone, **zoneless**, signals |
| Componentes de interfaz | Angular Material 21 (tema Material 3 en SCSS) |
| Gráficas / Markdown | Chart.js 4 usado directamente / `marked` |
| Autenticación | JWT en cabecera `Authorization: Bearer` + contraseñas con `bcryptjs` |
| Validación | `zod` en la API + `$jsonSchema` y `$expr` dentro de MongoDB |
| Subida de archivos | Multer 2 con `memoryStorage` → GridFS (bucket `contenidos`) |
| Pruebas del servidor | `node:test` + `supertest` contra MongoDB 9.0.4 real |
| Idioma | **Todo en español**: colecciones, campos, variables, funciones, rutas de la API, interfaz y documentación |
| Forma de trabajo | Fase por fase; cada fase se entrega probada y se revisa antes de seguir |

### 0.1 Convenciones de nombres

- Identificadores **sin tildes ni ñ** (`clave` en lugar de "contraseña", `bytes` en lugar de "tamaño", `edicion`).
- `camelCase` para variables, funciones y campos · `PascalCase` para clases · `kebab-case` para archivos y rutas de la API.
- Colecciones en plural: `usuarios`, `carpetas`, `archivos`, `comparticiones`, `actividades`.
- Valores de enumeraciones en minúsculas (`administrador`, `lectura`, `edicion`). Acciones del historial en `MAYUSCULAS_CON_GUION_BAJO` (`ARCHIVO_SUBIDO`).
- Excepciones inevitables: `_id`, los campos internos de GridFS fijados por su especificación (`length`, `chunkSize`, `uploadDate`, `filename`, `metadata`, `files_id`, `n`, `data`) y las APIs propias de Node, Express y Angular (`req`, `res`, `next`, `signal`…).

---

## 1. Requerimientos (matriz de trazabilidad)

### 1.1 Funcionales

| ID | Requerimiento | Fuente |
|---|---|---|
| RF-01 | Acceso con credenciales propias | p. 2 |
| RF-02 | Roles Administrador y Usuario; cada uno accede solo a las operaciones y recursos que le correspondan | p. 2 |
| RF-03 | El administrador administra usuarios (información para identificarlos y autenticarlos) | p. 2–3 |
| RF-04 | Usuarios activos o inactivos; desactivar no pierde la información histórica de documentos ni actividades | p. 3 |
| RF-05 | Carpetas y subcarpetas: navegar entre niveles, consultar contenido y modificar la organización | p. 3 |
| RF-06 | Las operaciones sobre una carpeta consideran sus elementos asociados | p. 3 |
| RF-07 | Archivos `.txt` y `.md` con propietario, ubicación, características principales y fechas de almacenamiento | p. 1, 3 |
| RF-08 | Cargar, descargar, consultar, renombrar, mover y eliminar archivos | p. 3 |
| RF-09 | Búsquedas, filtros y mecanismos de clasificación | p. 3 |
| RF-10 | Contenido almacenado con mecanismos de MongoDB y recuperable sin pérdida | p. 3, 6 |
| RF-11 | Compartir archivos y carpetas con usuarios registrados, con nivel lectura, comentar o edición | p. 3 |
| RF-12 | El propietario modifica o retira los permisos concedidos | p. 3 |
| RF-13 | Papelera: el propietario consulta, restaura o elimina definitivamente | p. 4 |
| RF-14 | Historial: qué usuario, sobre qué recurso, cuándo; consulta de actividad de archivos, carpetas y compartidos | p. 4 |
| RF-15 | El administrador consulta información global del uso del sistema | p. 2 |
| RF-16 | Módulo de reportes con filtros y criterios de búsqueda | p. 5 |
| RF-17 | Información suficiente para determinar **propiedad, ubicación y acceso** de cada recurso | p. 2 |

### 1.2 Reglas de negocio

| ID | Regla | Fuente |
|---|---|---|
| RN-01 | Solo se accede a recursos propios o con permiso; el servidor lo garantiza en cada operación | p. 3–4 |
| RN-02 | La jerarquía de carpetas es consistente: sin ciclos ni referencias inválidas | p. 3–4 |
| RN-03 | Mover archivos y carpetas mantiene correctamente su ubicación (incluido el contenido de las carpetas) | p. 4 |
| RN-04 | Los recursos en la papelera no aparecen en las consultas normales | p. 4 |
| RN-05 | Eliminar envía a la papelera; no elimina definitivamente | p. 4 |
| RN-06 | Restaurar y eliminar definitivamente mantienen la consistencia de carpetas y del espacio usado | p. 4 |
| RN-07 | Se conserva la información histórica necesaria para auditoría y reportes | p. 4 |
| RN-08 | Como mínimo se distinguen lectura y edición; el propietario establece, modifica y retira permisos | p. 3 |
| RN-09 | Desactivar un usuario no elimina información | p. 3 |
| RN-10 | Las decisiones de embebidos, referencias e índices deben justificarse | p. 4, 6 |

### 1.3 Técnicos obligatorios

| ID | Requisito | Fuente |
|---|---|---|
| RT-01 | Cliente en Angular 21 LTS | p. 2, 6 |
| RT-02 | Servidor en Node.js (Express) | p. 2, 6 |
| RT-03 | MongoDB; el servidor es el único que se comunica con la base de datos | p. 2, 6 |
| RT-04 | Dos aplicaciones independientes comunicadas por API REST (HTTP/HTTPS) | p. 2 |
| RT-05 | No es válido guardar solo la ruta a un archivo local del servidor | p. 6 |
| RT-06 | Agrupación, acumulación y análisis con funcionalidades de MongoDB | p. 5 |
| RT-07 | La base de datos se puede inicializar con información suficiente para calificar | p. 6 |

### 1.4 Carga inicial

| ID | Mínimo pedido (p. 4–5) | Plan |
|---|---|---|
| RD-01 | 3 usuarios | 12 (1 administrador, 1 inactivo) |
| RD-02 | Carpetas y subcarpetas repartidas entre usuarios | 2–4 carpetas raíz por usuario, hasta 3 niveles |
| RD-03 | 50 archivos de distintos usuarios, carpetas y tipos | 57: 51 activos + 6 en la papelera, `.md` y `.txt` |
| RD-04 | 20 operaciones de compartición | 34 vigentes (más 2 retiradas y 2 modificadas), con los 3 niveles, archivos y carpetas, y herencia |
| RD-05 | Recursos en la papelera | archivos sueltos y una carpeta con contenido |
| RD-06 | Historial suficiente | ~500 eventos repartidos en 6 meses |

### 1.5 Reportes (p. 5)

| ID | Reporte |
|---|---|
| RR-01 | Cantidad de archivos agrupados por tipo |
| RR-02 | Archivos almacenados dentro de un rango de fechas |
| RR-03 | Archivos con mayor cantidad de operaciones registradas |
| RR-04 | Top 10 usuarios con mayor cantidad de archivos almacenados |
| RR-05 | Usuarios con mayor cantidad de recursos compartidos |
| RR-06 | Archivos compartidos con mayor cantidad de usuarios |
| RR-07 | Recursos compartidos por un usuario seleccionado |
| RR-08 | Recursos recibidos por un usuario seleccionado |
| RR-09 | Historial de actividad de un usuario dentro de un rango de fechas |
| RR-10 | Cantidad de operaciones agrupadas por tipo |
| RR-11 | Cantidad de operaciones agrupadas por período |
| RR-12 | Principales acciones realizadas dentro del sistema |

### 1.6 Entregables (p. 6)

| ID | Entregable |
|---|---|
| RE-01 | Repositorio privado en GitHub |
| RE-02 | Código fuente completo del cliente |
| RE-03 | Código fuente completo del servidor |
| RE-04 | Archivos o scripts de carga inicial de MongoDB |
| RE-05 | Documentación del modelo: colecciones, documentos embebidos, referencias e índices |
| RE-06 | Manual técnico |
| RE-07 | Diagramas UML en draw.io: casos de uso, secuencia y despliegue |
| RE-08 | Manual de usuario |

---

## 2. Interpretaciones de puntos ambiguos

| # | El documento dice | Interpretación adoptada | Por qué |
|---|---|---|---|
| I-01 | "(lectura, edición y comentar)" y "como mínimo… lectura y edición" | Tres niveles: `lectura` < `comentario` < `edicion`. Los comentarios se hacen sobre archivos; el nivel `comentario` en una carpeta permite comentar sus archivos | El paréntesis enumera tres niveles; el mínimo no impide implementar los tres |
| I-02 | "Cantidad de archivos agrupados por **tipo**" | Por tipo de archivo (`txt` / `md`). Extra: por categoría | El documento usa "tipos de archivo" para `.txt`/`.md` (p. 3 y p. 5) |
| I-03 | Clasificación "que el estudiante considere adecuada" | Categoría fija (`administrativo`, `informe`, `contrato`, `otro`) + etiquetas libres | Las categorías salen de la descripción (p. 1) |
| I-04 | "Operaciones agrupadas por tipo" vs. "Principales acciones" | RR-10: distribución completa por tipo de operación, agrupada por categoría. RR-12: ranking Top-N con % del total, usuarios distintos, usuario que más la realiza y última vez | Evita que sean el mismo reporte. **Confirmar con el catedrático** |
| I-05 | "Top 10 usuarios…" con un mínimo de 3 usuarios | La carga inicial tendrá 12 usuarios | Con 3 usuarios el límite de 10 no se demuestra |
| I-06 | "Usuarios con mayor cantidad de recursos compartidos" | Recursos que el usuario compartió como propietario (recursos distintos, comparticiones y destinatarios) | "Recibidos" ya tiene su propio reporte (RR-08) |
| I-07 | "Archivos compartidos con mayor cantidad de usuarios" | Se muestran dos cifras: usuarios con acceso **directo** y con acceso **efectivo** (incluye el heredado de carpetas compartidas) | El acceso real a un archivo incluye la herencia |
| I-08 | El administrador "consulta información global" | Ve usuarios, reportes, actividad y metadatos, pero **no** abre el contenido privado de otros usuarios | Primera regla general: solo recursos propios o con permiso |
| I-09 | El administrador "administra usuarios" | Solo el administrador crea cuentas; no hay auto-registro. Los usuarios nunca se eliminan físicamente | Organización con cuentas controladas; RN-09 |
| I-10 | Espacio de almacenamiento y papelera | Lo que está en la papelera **sigue ocupando espacio** (sus bytes siguen en GridFS); se libera al eliminarlo definitivamente | Refleja el espacio físico real. **Confirmar con el catedrático** |
| I-11 | Restaurar cuando la carpeta original ya no está disponible | El elemento vuelve a la raíz del propietario; si hay conflicto de nombre, se renombra (`nombre (1).md`) | Evita referencias inválidas (RN-02, RN-06) |
| I-12 | Permiso de edición sobre una carpeta compartida | Puede subir archivos, crear subcarpetas, renombrar y editar contenido dentro. Lo creado pertenece al **propietario de la carpeta** (`creadoPor` registra al editor) y consume su cuota | Todo un árbol tiene un solo propietario, lo que mantiene simples los permisos, la papelera y el espacio |
| I-13 | "Consultar" archivos | Ver la vista previa queda registrado en el historial (`ARCHIVO_CONSULTADO`) | "Consultar" está en la lista de operaciones de la p. 3 |

---

## 3. Matriz de permisos

| Acción | Propietario | Edición | Comentar | Lectura |
|---|:---:|:---:|:---:|:---:|
| Ver en listados, navegar, ver detalles, vista previa y descarga | ✔ | ✔ | ✔ | ✔ |
| Ver comentarios | ✔ | ✔ | ✔ | ✔ |
| Agregar comentarios | ✔ | ✔ | ✔ | ✘ |
| Editar contenido, renombrar, cambiar categoría, etiquetas y descripción | ✔ | ✔ | ✘ | ✘ |
| Subir archivos o crear subcarpetas dentro de una carpeta compartida | ✔ | ✔ | ✘ | ✘ |
| Mover | ✔ | ✘ | ✘ | ✘ |
| Enviar a la papelera, restaurar, eliminar definitivamente | ✔ | ✘ | ✘ | ✘ |
| Compartir, modificar y retirar permisos | ✔ | ✘ | ✘ | ✘ |
| Ver quién tiene acceso al recurso | ✔ | ✘ | ✘ | ✘ |

Reglas del cálculo:

1. **Permiso efectivo** = el mayor entre la compartición directa del recurso y las de cualquiera de sus carpetas ancestro (herencia).
2. El propietario siempre tiene control total sobre su árbol.
3. Un recurso en la papelera no es accesible para nadie más que su propietario, y solo desde la vista de papelera.
4. Si el usuario no tiene acceso, la respuesta es **404** (no se revela que el recurso existe). Un rol insuficiente en rutas de administración responde **403**.
5. Un usuario solo puede eliminar sus propios comentarios; el propietario del archivo puede eliminar cualquiera.
6. Para quien recibe una carpeta compartida, la ruta (breadcrumb) empieza en la carpeta compartida más alta a la que tiene acceso: nunca ve nombres de carpetas privadas del propietario.

---

## 4. Modelo documental

### 4.1 Relaciones

```
usuarios ─1:N─ carpetas            (carpetas.propietarioId)
carpetas ─1:N─ carpetas            (carpetas.padreId + carpetas.ancestros[])
carpetas ─1:N─ archivos            (archivos.carpetaId + archivos.ancestros[])
usuarios ─1:N─ archivos            (archivos.propietarioId)
archivos ─1:1─ contenidos (GridFS) (archivos.contenido.gridFsId ↔ contenidos.files.metadata.archivoId)
usuarios ─N:M─ archivos/carpetas   (comparticiones: propietarioId, destinatarioId, recursoId)
actividades ──► usuarios/recursos  (referencias + copia de datos del momento)
```

`ancestros` = todas las carpetas que contienen al elemento, desde la raíz hasta su carpeta padre (sin incluirse a sí mismo). Su último elemento siempre es el padre (`padreId` en carpetas, `carpetaId` en archivos); en la raíz es un arreglo vacío.

### 4.2 Colecciones y documentos de ejemplo

#### `usuarios`

```js
{
  _id: ObjectId("…U2"),
  nombreUsuario: "mlopez",               // único, minúsculas
  correo: "mlopez@blackvault.gt",        // único, minúsculas
  claveHash: "$2b$12$…",                 // bcrypt; nunca sale en las respuestas
  nombreCompleto: "María Fernanda López",
  rol: "usuario",                        // "administrador" | "usuario"
  activo: true,
  versionSesion: 0,                      // aumenta al cambiar/restablecer la clave, cambiar el rol o desactivar:
                                         // invalida los JWT emitidos antes (va dentro del token como "ver")
  almacenamiento: { usadoBytes: 48213, cuotaBytes: 104857600 },  // embebido 1:1
  ultimoAcceso: ISODate("2026-10-20T15:02:11Z"),
  desactivadoEn: null,
  creadoEn: ISODate("2026-05-04T14:00:00Z"),
  actualizadoEn: ISODate("2026-10-20T15:02:11Z")
}
```

#### `carpetas`

```js
{
  _id: ObjectId("…C3"),
  nombre: "Clientes",
  nombreNormalizado: "clientes",         // minúsculas, sin tildes en vocales, conserva la ñ
  propietarioId: ObjectId("…U2"),
  padreId: ObjectId("…C2"),              // null en la raíz
  ancestros: [ObjectId("…C1"), ObjectId("…C2")],
  creadoPor: ObjectId("…U2"),            // puede ser un editor (I-12)
  creadoEn: ISODate("…"),
  actualizadoEn: ISODate("…"),
  enPapelera: false,
  papelera: null
  // en la papelera:
  // enPapelera: true,
  // papelera: { enviadoEn: ISODate("…"), enviadoPor: ObjectId("…U2"),
  //             raizId: ObjectId("…C2"), esRaiz: false }
}
```

- `papelera.raizId`: el elemento que el usuario envió a la papelera; todo lo que se fue con él comparte ese valor.
- `papelera.esRaiz`: `true` solo en el elemento enviado directamente. La vista de papelera muestra solo las raíces.

#### `archivos`

```js
{
  _id: ObjectId("…A1"),
  nombre: "Contrato de servicios - Agrícola del Sur.md",
  nombreNormalizado: "contrato de servicios - agricola del sur.md",
  extension: "md",                       // "txt" | "md"
  tipoMime: "text/markdown",             // "text/plain" | "text/markdown"
  categoria: "contrato",                 // "administrativo" | "informe" | "contrato" | "otro"
  etiquetas: ["cliente", "2026", "vigente"],
  descripcion: "Contrato anual de asesoría contable.",
  propietarioId: ObjectId("…U2"),
  carpetaId: ObjectId("…C3"),            // null en la raíz
  ancestros: [ObjectId("…C1"), ObjectId("…C2"), ObjectId("…C3")],
  contenido: {                           // embebido 1:1, apunta a GridFS
    gridFsId: ObjectId("…G1"),
    bytes: 4821,
    sha256: "9f2c…e1",
    version: 3,
    actualizadoEn: ISODate("…"),
    actualizadoPor: ObjectId("…U5")
  },
  comentarios: [                         // embebido, máximo 200
    { _id: ObjectId("…K1"),
      autor: { _id: ObjectId("…U5"), nombreUsuario: "jramirez", nombreCompleto: "José Antonio Ramírez" },
      texto: "Revisar la cláusula 4.",
      creadoEn: ISODate("…") }
  ],
  creadoPor: ObjectId("…U2"),
  creadoEn: ISODate("…"),                // fecha de carga
  actualizadoEn: ISODate("…"),
  enPapelera: false,
  papelera: null
}
```

#### GridFS: bucket `contenidos` (`contenidos.files` y `contenidos.chunks`)

```js
// contenidos.files (campos fijados por la especificación de GridFS)
{
  _id: ObjectId("…G1"),
  length: 4821,
  chunkSize: 261120,
  uploadDate: ISODate("…"),
  filename: "Contrato de servicios - Agrícola del Sur.md",
  metadata: { archivoId: ObjectId("…A1"), propietarioId: ObjectId("…U2"),
              tipoMime: "text/markdown", sha256: "9f2c…e1" }
}
// contenidos.chunks: { _id, files_id: ObjectId("…G1"), n: 0, data: BinData(…) }
```

`tipoMime` va en `metadata` porque la opción `contentType` de GridFS está obsoleta en el driver.

#### `comparticiones`

```js
{
  _id: ObjectId("…S1"),
  tipoRecurso: "carpeta",                // "archivo" | "carpeta"
  recursoId: ObjectId("…C2"),
  propietarioId: ObjectId("…U2"),        // quien comparte (dueño del recurso)
  destinatarioId: ObjectId("…U5"),
  permiso: "edicion",                    // "lectura" | "comentario" | "edicion"
  creadoEn: ISODate("…"),
  actualizadoEn: ISODate("…")
}
```

#### `actividades`

```js
{
  _id: ObjectId("…"),
  accion: "COMPARTICION_CREADA",
  categoria: "comparticiones",           // ver sección 6
  fecha: ISODate("…"),
  actor: { _id: ObjectId("…U2"), nombreUsuario: "mlopez",
           nombreCompleto: "María Fernanda López", rol: "usuario" },
  recurso: { tipo: "carpeta", _id: ObjectId("…C2"), nombre: "2026",
             propietarioId: ObjectId("…U2") },          // opcional
  usuarioAfectado: { _id: ObjectId("…U5"), nombreUsuario: "jramirez",
                     nombreCompleto: "José Antonio Ramírez" },  // opcional
  detalles: { permiso: "edicion" },      // flexible según la acción
  ip: "127.0.0.1"
}
```

### 4.3 Embebido o referencia: justificación

| Decisión | Tipo | Justificación |
|---|---|---|
| `almacenamiento` dentro de `usuarios` | Embebido 1:1 | Se lee y actualiza siempre con el usuario. Un `$inc` condicional sobre un solo documento es atómico: el uso nunca supera la cuota, aun sin transacciones |
| Carpetas → usuario | Referencia (`propietarioId`) | Un usuario tiene muchas carpetas, sin límite, consultadas de forma independiente |
| Jerarquía de carpetas | Referencia `padreId` + arreglo `ancestros` (patrón *Array of Ancestors* de la documentación de MongoDB) | Con una consulta indexada se obtiene un subárbol completo (papelera en cascada, mover, eliminar), se detectan ciclos, se arma la ruta y se heredan permisos. `padreId` es la fuente de verdad y `ancestros` se puede reconstruir a partir de él. Costo aceptado: al mover una carpeta se actualizan los ancestros de sus descendientes con un `updateMany` de pipeline |
| Carpetas anidadas dentro de carpetas | **Descartado** | Profundidad ilimitada, límite de 16 MB por documento, cada movimiento reescribiría documentos enormes y las búsquedas entre carpetas serían difíciles |
| Archivos → carpeta | Referencia (`carpetaId` + `ancestros`) | Los archivos son numerosos, tienen ciclo de vida propio (mover, compartir, papelera) y se buscan a través de todas las carpetas |
| Bytes del archivo | GridFS, referenciado desde `contenido.gridFsId` | Es el mecanismo de MongoDB para guardar archivos (p. 3 y 6). Separa los bytes de los metadatos (los listados no cargan contenido), no tiene el límite de 16 MB y permite lectura en streaming. El `sha256` demuestra la recuperación sin pérdida |
| Metadatos del contenido | Embebido (`contenido`) | Relación 1:1 con el archivo; al editar se reemplaza completo (versión, bytes, hash) en una sola escritura atómica |
| Etiquetas | Embebido (arreglo) | Pocas por archivo, se leen siempre con él; índice multikey para filtrar |
| Comentarios | Embebido con tope de 200 | Relación 1-a-pocos: solo tienen sentido dentro del archivo, se muestran con él y desaparecen con él. El tope evita el crecimiento sin límite y la copia del autor evita `$lookup` |
| Estado de papelera | Embebido (`papelera`) | Es estado propio del recurso; `raizId` agrupa lo que se eliminó junto para restaurarlo junto |
| Comparticiones | Colección propia con referencias | Relación N:M entre usuarios y recursos de dos colecciones. Se consulta desde ambos lados ("compartidos conmigo" / "compartidos por mí"), tiene ciclo de vida propio (crear, modificar, retirar) y alimenta 4 reportes. Embebida en los recursos obligaría a consultar dos colecciones para cada vista del destinatario |
| Historial | Colección propia + copia de datos (patrón *Extended Reference*) | Crece sin límite y se consulta por usuario, fecha, recurso y acción. La copia del actor y del recurso conserva los nombres aunque el recurso se renombre o se elimine definitivamente y el usuario se desactive (RN-07), sin `$lookup` en los reportes |

### 4.4 Índices

| # | Colección | Nombre | Definición | Opciones | Uso |
|---|---|---|---|---|---|
| 1 | usuarios | `uq_usuarios_nombreUsuario` | `{ nombreUsuario: 1 }` | único | Inicio de sesión, unicidad |
| 2 | usuarios | `uq_usuarios_correo` | `{ correo: 1 }` | único | Inicio de sesión, unicidad |
| 3 | usuarios | `ix_usuarios_rol_activo` | `{ rol: 1, activo: 1 }` | — | Filtros del admin; validar que quede al menos un admin activo |
| 4 | carpetas | `uq_carpetas_nombre_en_padre` | `{ padreId: 1, propietarioId: 1, nombreNormalizado: 1 }` | único, parcial `{ enPapelera: false }` | Sin nombres repetidos entre carpetas hermanas activas; listar subcarpetas ordenadas |
| 5 | carpetas | `ix_carpetas_ancestros` | `{ ancestros: 1 }` | multikey | Subárbol: papelera en cascada, mover, eliminar |
| 6 | carpetas | `ix_carpetas_papelera` | `{ propietarioId: 1, "papelera.esRaiz": 1, "papelera.enviadoEn": -1 }` | parcial `{ enPapelera: true }` | Vista de papelera |
| 7 | carpetas | `ix_carpetas_papelera_raiz` | `{ "papelera.raizId": 1 }` | parcial `{ enPapelera: true }` | Restaurar todo lo que se eliminó junto |
| 8 | archivos | `uq_archivos_nombre_en_carpeta` | `{ carpetaId: 1, propietarioId: 1, nombreNormalizado: 1 }` | único, parcial `{ enPapelera: false }` | Sin nombres repetidos en la misma carpeta; listar archivos ordenados |
| 9 | archivos | `ix_archivos_ancestros` | `{ ancestros: 1 }` | multikey | Subárbol y búsqueda dentro de carpetas compartidas |
| 10 | archivos | `ix_archivos_propietario_fecha` | `{ propietarioId: 1, enPapelera: 1, creadoEn: -1 }` | — | "Mis archivos", recientes y búsquedas |
| 11 | archivos | `ix_archivos_fecha` | `{ creadoEn: -1 }` | — | RR-02 (rango de fechas global) |
| 12 | archivos | `ix_archivos_etiquetas` | `{ etiquetas: 1 }` | multikey | Filtro por etiqueta |
| 13 | archivos | `tx_archivos_busqueda` | texto: `nombre` (peso 10), `etiquetas` (5), `descripcion` (1) | `default_language: "spanish"` | Búsqueda por palabras con relevancia |
| 14 | archivos | `ix_archivos_papelera` | `{ propietarioId: 1, "papelera.esRaiz": 1, "papelera.enviadoEn": -1 }` | parcial `{ enPapelera: true }` | Vista de papelera |
| 15 | archivos | `ix_archivos_papelera_raiz` | `{ "papelera.raizId": 1 }` | parcial `{ enPapelera: true }` | Restaurar en grupo |
| 16 | comparticiones | `uq_comparticiones_recurso_destinatario` | `{ recursoId: 1, destinatarioId: 1 }` | único | Una compartición por recurso y usuario; cálculo del permiso efectivo (`$in` sobre la ruta) |
| 17 | comparticiones | `ix_comparticiones_destinatario` | `{ destinatarioId: 1, creadoEn: -1 }` | — | "Compartidos conmigo", RR-08 |
| 18 | comparticiones | `ix_comparticiones_propietario` | `{ propietarioId: 1, creadoEn: -1 }` | — | "Compartidos por mí", RR-05, RR-07 |
| 19 | actividades | `ix_actividades_actor_fecha` | `{ "actor._id": 1, fecha: -1 }` | — | Historial de un usuario, RR-09 |
| 20 | actividades | `ix_actividades_recurso_fecha` | `{ "recurso._id": 1, fecha: -1 }` | — | Línea de tiempo de un recurso, RR-03 |
| 21 | actividades | `ix_actividades_propietario_fecha` | `{ "recurso.propietarioId": 1, fecha: -1 }` | — | Actividad sobre mis recursos |
| 22 | actividades | `ix_actividades_accion_fecha` | `{ accion: 1, fecha: -1 }` | — | Filtro por tipo de operación |
| 23 | actividades | `ix_actividades_fecha` | `{ fecha: -1 }` | — | RR-10, RR-11, RR-12 por rango |
| 24 | contenidos.files | `ix_contenidos_archivo` | `{ "metadata.archivoId": 1 }` | — | Verificación de integridad (huérfanos) |
| 25 | actividades | `ix_actividades_afectado_fecha` | `{ "usuarioAfectado._id": 1, fecha: -1 }` | — | "Lo que otros hicieron conmigo"; tercera rama del `$or` del historial de un usuario |

GridFS crea solo `{ filename: 1, uploadDate: 1 }` en `contenidos.files` y `{ files_id: 1, n: 1 }` (único) en `contenidos.chunks`.

Notas:
- Los índices únicos parciales solo obligan a los elementos activos; un elemento en la papelera no bloquea que se cree otro con su nombre (por eso restaurar puede requerir renombrar).
- Las consultas de listado incluyen `enPapelera: false` y el `propietarioId` del padre para poder usar los índices parciales 4 y 8 completos, incluido el orden por nombre.

### 4.5 Validación dentro de MongoDB

Cada colección se crea con `validator` (`validationLevel: "strict"`, `validationAction: "error"`), visible en la pestaña *Validation* de Compass:

- **`$jsonSchema`**: campos requeridos, tipos BSON (`objectId`, `date`, `bool`, arreglos de `objectId`), enumeraciones (`rol`, `extension`, `categoria`, `permiso`, `tipoRecurso`, `categoria` del historial), patrones (`nombreUsuario`, `accion`) y mínimos (`bytes ≥ 0`). Los campos numéricos aceptan `int`, `long` o `double`, porque el driver guarda los enteros pequeños como `int` y `$inc` puede producir `long`.
- **`$expr`** (reglas que cruzan campos, garantizadas por la base de datos):
  - `usuarios`: `almacenamiento.usadoBytes ≤ almacenamiento.cuotaBytes`.
  - `carpetas`: `_id` no está en `ancestros` (no hay ciclos locales) y el último elemento de `ancestros` es `padreId` (o ambos vacíos en la raíz).
  - `archivos`: el último elemento de `ancestros` es `carpetaId` (o ambos vacíos en la raíz).
  - `comparticiones`: `propietarioId ≠ destinatarioId` (no se comparte con uno mismo).

Las colecciones, validadores e índices se crean al arrancar el servidor y desde el script de carga inicial, de forma idempotente (`createCollection` o `collMod` si ya existe, y `createIndexes`).

---

## 5. Reglas de negocio: algoritmos

**Notación.** `acceso(u, recurso)` devuelve `propietario`, `edicion`, `comentario`, `lectura` o nada (§3). "Atómico" significa: dentro de una transacción si el servidor de MongoDB es un replica set; si no, en el orden indicado y con compensación ante fallos (§12).

### 5.1 Normalización y validación de nombres
1. `nombre.trim()`, normalizado Unicode NFC, máximo 255 caracteres.
2. Se rechazan `\ / : * ? " < > |`, caracteres de control, nombres que terminan en punto y los nombres reservados de Windows (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`), porque los usuarios descargan en Windows.
3. `nombreNormalizado` = minúsculas, sin tildes en las vocales (á→a, é→e, í→i, ó→o, ú→u, ü→u) y **conservando la ñ** (para que "año" y "ano" sean distintos).

### 5.2 Subir archivo — `POST /api/archivos` (multipart)
1. Multer (`memoryStorage`, `limits.fileSize` = 5 MB, `limits.files` = 1, `defParamCharset: 'utf8'`). Nunca se escribe en el disco del servidor.
2. Extensión `.txt` o `.md` (sin distinguir mayúsculas) → si no, **415**. `tipoMime` se deduce de la extensión.
3. Destino: si viene `carpetaId`, se requiere `acceso ≥ edicion` sobre esa carpeta y que no esté en la papelera; el dueño del archivo será el dueño de la carpeta y `ancestros = [...carpeta.ancestros, carpeta._id]`. Sin `carpetaId`: el dueño es el usuario y `ancestros = []`.
4. Si ya existe un archivo activo con ese nombre en el destino, se renombra automáticamente a `nombre (1).ext`, `nombre (2).ext`…
5. Se calcula el `sha256` del contenido.
6. **Reserva de cuota** (atómica en un solo documento):
   `usuarios.updateOne({ _id: propietarioId, $expr: { $lte: [{ $add: ["$almacenamiento.usadoBytes", bytes] }, "$almacenamiento.cuotaBytes"] } }, { $inc: { "almacenamiento.usadoBytes": bytes } })` → si no modifica nada, **409 `CUOTA_EXCEDIDA`**.
7. Se escribe en GridFS (`openUploadStream` con `metadata`) usando un `_id` de archivo generado de antemano.
8. Se inserta el documento en `archivos`.
9. Si 7 u 8 fallan → **compensación**: se borra lo escrito en GridFS y se devuelve la cuota reservada (`$inc` negativo). Si el fallo fue un nombre duplicado por carrera (E11000), se reintenta con el siguiente sufijo.
10. Historial `ARCHIVO_SUBIDO` (bytes, carpeta destino).

### 5.3 Consultar (vista previa) y descargar
- **Vista previa** `GET /api/archivos/:id/contenido` (`acceso ≥ lectura`): se lee de GridFS y se decodifica como UTF-8 en modo estricto. Responde `{ contenido, esUtf8, version, sha256 }`. Si no es UTF-8 válido, `esUtf8: false`, la vista previa muestra una versión aproximada y **la edición queda bloqueada** (editar destruiría bytes). Historial `ARCHIVO_CONSULTADO`.
- **Descarga** `GET /api/archivos/:id/descarga` (`acceso ≥ lectura`): stream directo desde GridFS, byte por byte, con `Content-Length`, `Content-Type` y `Content-Disposition` (`res.attachment(nombre)`, compatible con tildes). CORS expone `Content-Disposition` para que Angular lea el nombre. Historial `ARCHIVO_DESCARGADO`.

### 5.4 Editar contenido — `PUT /api/archivos/:id/contenido`
1. `acceso ≥ edicion`, el archivo no está en la papelera y el contenido original es UTF-8 válido (si no, **422**).
2. **Concurrencia optimista**: el cliente envía `versionEsperada`; si no coincide con `contenido.version`, **409** ("el archivo cambió mientras lo editabas").
3. Se conservan la marca BOM UTF-8 y el tipo de salto de línea (CRLF o LF) del original. El navegador entrega LF, así que se convierte de vuelta.
4. `delta = bytesNuevos − bytesAnteriores`. Si `delta > 0`, se reserva con el mismo `$inc` condicional sobre la cuota del **propietario**.
5. Se escribe el nuevo contenido en GridFS (nuevo `gridFsId`).
6. `archivos.updateOne({ _id, "contenido.version": versionEsperada }, { $set: { contenido: { …nuevo, version: versionEsperada + 1 } } })`. Si no coincide (otra edición ganó la carrera): se borra el nuevo GridFS, se devuelve la reserva y **409**.
7. Se borra el contenido anterior de GridFS. Si `delta < 0`, se descuenta del espacio usado.
8. Historial `ARCHIVO_EDITADO` (bytes antes/después, versión).

### 5.5 Renombrar y clasificar — `PATCH /api/archivos/:id`, `PATCH /api/carpetas/:id`
- `acceso ≥ edicion`; no en la papelera.
- En archivos se **conserva la extensión** (solo cambia el nombre base), para que el tipo y los reportes se mantengan coherentes.
- Nombre repetido en el mismo destino → **409**.
- Historial `ARCHIVO_RENOMBRADO` / `CARPETA_RENOMBRADA` (nombre anterior y nuevo) o `ARCHIVO_ACTUALIZADO` (categoría, etiquetas, descripción).
- Renombrar una carpeta **no** obliga a actualizar a sus descendientes, porque `ancestros` guarda ids, no nombres.

### 5.6 Crear carpeta — `POST /api/carpetas`
- Con `padreId`: `acceso ≥ edicion` sobre el padre, que no esté en la papelera; dueño = dueño del padre; `ancestros = [...padre.ancestros, padre._id]`.
- Sin `padreId`: carpeta raíz del usuario.
- Nombre repetido entre hermanas activas → **409**. Historial `CARPETA_CREADA`.

### 5.7 Mover archivo — `PATCH /api/archivos/:id/mover`
1. Solo el propietario; el archivo no está en la papelera.
2. Destino `null` (raíz) o una carpeta del **mismo propietario** que exista y no esté en la papelera.
3. Si el destino es la ubicación actual, no hay cambios. Si hay nombre repetido en el destino → **409**.
4. `$set: { carpetaId: destino?._id ?? null, ancestros: destino ? [...destino.ancestros, destino._id] : [] }`.
5. Historial `ARCHIVO_MOVIDO` (origen y destino).

### 5.8 Mover carpeta — `PATCH /api/carpetas/:id/mover`
1. Solo el propietario; la carpeta `S` no está en la papelera.
2. Si hay destino `T`: existe, mismo propietario, no está en la papelera, `T._id ≠ S._id` y **`S._id ∉ T.ancestros`** (si no, habría un ciclo → **409**).
3. Si el destino es el padre actual, no hay cambios. Si hay nombre repetido en el destino → **409**.
4. `nuevos = T ? [...T.ancestros, T._id] : []`.
5. Atómico:
   - `carpetas.updateOne({ _id: S._id }, { $set: { padreId: T?._id ?? null, ancestros: nuevos } })`
   - En `carpetas` **y** en `archivos`, a todos los descendientes (`{ ancestros: S._id }`, incluidos los que están en la papelera, para que la estructura siga consistente):
     ```js
     updateMany({ ancestros: S._id }, [
       { $set: { ancestros: { $concatArrays: [
           nuevos,
           [S._id],
           { $slice: ["$ancestros",
                      { $add: [{ $indexOfArray: ["$ancestros", S._id] }, 1] },
                      { $size: "$ancestros" }] }
       ] } } }
     ])
     ```
6. Historial `CARPETA_MOVIDA` (origen, destino, elementos afectados).

### 5.9 Enviar a la papelera — `DELETE /api/archivos/:id`, `DELETE /api/carpetas/:id`
- Solo el propietario; el elemento no está ya en la papelera.
- **Archivo**: `$set: { enPapelera: true, papelera: { enviadoEn, enviadoPor, raizId: _id, esRaiz: true } }`.
- **Carpeta `F`** (atómico):
  1. Carpetas y archivos con `{ ancestros: F._id, enPapelera: false }` → `enPapelera: true`, `papelera: { …, raizId: F._id, esRaiz: false }`.
     Los descendientes que ya estaban en la papelera conservan su propia raíz.
  2. `F` → `papelera: { …, raizId: F._id, esRaiz: true }`.
  Sin transacciones (standalone), el contenido va primero y la carpeta al final: si el paso 2 falla, se **compensa** devolviendo a su estado activo todo lo que tenga `papelera.raizId = F._id`. Así nunca queda un elemento activo dentro de una carpeta en la papelera.
- La ubicación (`carpetaId`/`padreId`/`ancestros`) **no cambia**, así se sabe dónde restaurar.
- Las comparticiones se conservan pero dejan de tener efecto (el recurso es invisible para otros).
- El espacio usado **no cambia** (I-10).
- **Invariante**: ningún elemento activo tiene un ancestro en la papelera.
- Historial `ARCHIVO_ENVIADO_PAPELERA` / `CARPETA_ENVIADA_PAPELERA` (elementos afectados).

### 5.10 Restaurar — `POST /api/papelera/:tipo/:id/restaurar`
1. Solo el propietario; el elemento está en la papelera y `papelera.esRaiz = true`. Un elemento interno no se restaura solo: se restaura su raíz (**400**).
2. Destino: el padre original si existe y no está en la papelera; si no, **la raíz** (I-11).
3. Si hay un elemento activo con el mismo nombre en el destino, se renombra (`nombre (1)`).
4. Atómico, en este orden:
   - La raíz primero, en **una sola escritura** (nombre, padre, ancestros, `enPapelera: false`, `papelera: null`). Si el nombre choca por una carrera (índice único, E11000), no cambió nada más y se reintenta con el siguiente nombre libre.
   - Si el destino cambió a la raíz, se recalculan los `ancestros` de sus descendientes (mismo pipeline que 5.8 con `nuevos = []`).
   - Carpeta: se reactiva lo que se fue con ella (`papelera.raizId = id`, ids reunidos antes de empezar). Lo que se había eliminado por separado antes sigue en la papelera.
   - Sin transacciones, si un paso posterior falla se compensa: la raíz y su contenido vuelven a la papelera tal como estaban.
5. El espacio usado no cambia. Las comparticiones vuelven a tener efecto.
6. Historial `ARCHIVO_RESTAURADO` / `CARPETA_RESTAURADA` (destino, si se renombró, elementos restaurados).

### 5.11 Eliminar definitivamente — `DELETE /api/papelera/:tipo/:id` y vaciar papelera — `DELETE /api/papelera`
1. Solo el propietario; elemento en la papelera con `esRaiz = true`.
2. Se reúne el subárbol: la carpeta y todo lo que tenga `ancestros: id` (por el invariante, todo está en la papelera; si no, se aborta con **409**). Se suman los bytes de los archivos y se guardan sus `gridFsId`.
3. Atómico:
   - `comparticiones.deleteMany({ recursoId: { $in: idsDelSubarbol } })`
   - `archivos.deleteMany(…)`, `carpetas.deleteMany(…)`
   - `usuarios.updateOne({ _id: propietarioId }, { $inc: { "almacenamiento.usadoBytes": -bytes } })`
4. Después: `bucket.delete(gridFsId)` por cada archivo. Un fallo aquí deja bytes huérfanos sin afectar al usuario; la verificación de integridad los detecta y limpia.
5. **El historial no se toca** (RN-07).
6. Historial `ARCHIVO_ELIMINADO_DEFINITIVO` / `CARPETA_ELIMINADA_DEFINITIVO` / `PAPELERA_VACIADA` (archivos, carpetas y bytes liberados).

### 5.12 Compartir, modificar y retirar
- **Crear** `POST /api/comparticiones`: solo el propietario (otro nivel → **403**; sin acceso → **404**); el recurso no está en la papelera; el destinatario existe (**404**), está **activo** (**409**) y no es el propietario (**400**); si ya existe para ese recurso y usuario → **409** con `detalles.comparticionId` (se modifica en su lugar). Historial `COMPARTICION_CREADA`.
- **Modificar** `PATCH /api/comparticiones/:id`: solo el propietario; a cualquier otro se le responde **404** (no se revela que existe). Si el recurso está en la papelera → **409**. Si el permiso no cambia, no se registra nada. Historial `COMPARTICION_MODIFICADA` (permiso anterior y nuevo).
- **Retirar** `DELETE /api/comparticiones/:id`: solo el propietario; se elimina el documento, también si el recurso está en la papelera (quitar acceso nunca hace daño). Historial `COMPARTICION_RETIRADA` (permiso que tenía y desde cuándo). El historial conserva la auditoría de quién tuvo acceso y cuándo.
- **Quién tiene acceso** `GET /api/comparticiones/recurso/:tipo/:id`: solo el propietario. Devuelve las comparticiones **directas** (editables) y las **heredadas** de cada carpeta ancestro, con el nombre de la carpeta de la que vienen. El detalle de una carpeta o un archivo incluye `compartidoCon` (cantidad de comparticiones directas) y los listados marcan `compartido: true`, ambos solo para el propietario.
- **Permiso efectivo**:
  `comparticiones.find({ destinatarioId: u._id, recursoId: { $in: [recurso._id, ...recurso.ancestros] } })` → el nivel máximo (índice 16).
- **Compartidos conmigo**: aggregation sobre `comparticiones` (`destinatarioId`) con `$lookup` a `archivos` y `carpetas` (excluyendo la papelera) y al propietario. Lo que está dentro de una carpeta compartida se ve al entrar en ella.
- **Compartidos por mí**: aggregation sobre `comparticiones` (`propietarioId`) que agrupa por recurso (`$group` con `$push` de cada destinatario y su permiso), sin lo que está en la papelera.
- Ambas aceptan `?tipo=archivo|carpeta&buscar=&pagina=&limite=`.
- **Búsqueda en lo compartido**: `{ $or: [{ _id: { $in: archivosCompartidos } }, { ancestros: { $in: carpetasCompartidas } }], enPapelera: false }`.

### 5.13 Comentarios
- Agregar: `acceso ≥ comentario`, no en la papelera, texto de 1 a 1000 caracteres, con tope atómico:
  `updateOne({ _id, "comentarios.199": { $exists: false } }, { $push: { comentarios: {…} } })` → si no actualiza, **409** (límite alcanzado).
- Eliminar: el autor del comentario o el propietario del archivo (`$pull`).
- Ver: `GET /api/archivos/:id/comentarios` con `acceso ≥ lectura`; devuelve los comentarios en orden, `puedeComentar` y, en cada uno, `puedeEliminar`. Quien bajó a lectura conserva el derecho de borrar sus propios comentarios.
- Los listados excluyen `comentarios` con proyección. Historial `COMENTARIO_AGREGADO` / `COMENTARIO_ELIMINADO` (con un extracto del texto y, al borrar el de otra persona, su autor como `usuarioAfectado`).

### 5.14 Usuarios y sesión
- **Inicio de sesión** con nombre de usuario o correo. Usuario inactivo → **403**. JWT de 8 horas con `sub` y `rol`. Se actualiza `ultimoAcceso`. Historial `INICIO_SESION`; los intentos fallidos sobre usuarios existentes quedan como `INICIO_SESION_FALLIDO`.
- En **cada petición** el middleware verifica el JWT y vuelve a leer al usuario: si fue desactivado, o si su `versionSesion` ya no coincide con la del token (cambió o se restableció la clave, o cambió su rol), la sesión deja de servir de inmediato (**401**). Al cambiar la propia clave se devuelve un token nuevo para la sesión actual.
- El inicio de sesión responde igual si el usuario no existe o si la clave es incorrecta (y tarda lo mismo), para no revelar qué cuentas existen. Se limita a 10 intentos fallidos por IP cada 15 minutos (**429**).
- El administrador crea, edita (nombre, correo, rol, cuota), activa/desactiva y restablece claves. No puede desactivarse a sí mismo ni dejar el sistema sin administradores activos. La cuota no puede quedar por debajo del espacio ya usado. **No existe eliminación de usuarios**.
- Desactivar solo impide iniciar sesión: los archivos, las comparticiones y el historial del usuario se conservan intactos. Los usuarios inactivos no aparecen en el directorio para compartir.
- Política de claves: mínimo 8 caracteres con letras y números; `bcryptjs` con costo 10 (el mínimo que recomienda OWASP; `bcryptjs` es JavaScript puro y un costo mayor haría lentos el inicio de sesión y la semilla).

### 5.15 Verificación de integridad (administración)
Pipelines que comprueban (`GET /api/mantenimiento/integridad`, página **Administración → Integridad**) y, con `npm run integridad -- --reparar`, reparan:
1. `usadoBytes` de cada usuario = suma de `contenido.bytes` de sus archivos (incluida la papelera). **Se repara** fijando la suma.
2. Ningún elemento activo tiene un ancestro en la papelera. **Revisión manual** (decidir si se restaura la carpeta o se envía el elemento a la papelera es del usuario).
3. `ancestros` coincide con la cadena de `padreId` (`$graphLookup` + `$sortArray`) y todo el árbol es del mismo propietario; en archivos, `ancestros` = los de su carpeta + la carpeta. **Se repara** recalculándolos (primero carpetas, después archivos).
4. Cada archivo tiene su contenido en GridFS (con el mismo tamaño) y no hay contenido ni trozos (`chunks`) huérfanos. **Se reparan** los huérfanos; un archivo sin contenido requiere revisión manual.
5. Toda compartición apunta a un recurso y a un destinatario que existen, y el propietario coincide. **Se reparan** borrándolas.

La carga inicial termina ejecutando la verificación y falla si encuentra problemas.

---

## 6. Catálogo de acciones del historial

| Categoría | Acciones |
|---|---|
| `autenticacion` | `INICIO_SESION`, `INICIO_SESION_FALLIDO`, `CIERRE_SESION`, `CLAVE_CAMBIADA` |
| `usuarios` | `USUARIO_CREADO`, `USUARIO_ACTUALIZADO`, `USUARIO_ACTIVADO`, `USUARIO_DESACTIVADO`, `USUARIO_CLAVE_RESTABLECIDA` |
| `carpetas` | `CARPETA_CREADA`, `CARPETA_RENOMBRADA`, `CARPETA_MOVIDA` |
| `archivos` | `ARCHIVO_SUBIDO`, `ARCHIVO_CONSULTADO`, `ARCHIVO_DESCARGADO`, `ARCHIVO_EDITADO`, `ARCHIVO_RENOMBRADO`, `ARCHIVO_ACTUALIZADO`, `ARCHIVO_MOVIDO`, `COMENTARIO_AGREGADO`, `COMENTARIO_ELIMINADO` |
| `papelera` | `ARCHIVO_ENVIADO_PAPELERA`, `CARPETA_ENVIADA_PAPELERA`, `ARCHIVO_RESTAURADO`, `CARPETA_RESTAURADA`, `ARCHIVO_ELIMINADO_DEFINITIVO`, `CARPETA_ELIMINADA_DEFINITIVO`, `PAPELERA_VACIADA` |
| `comparticiones` | `COMPARTICION_CREADA`, `COMPARTICION_MODIFICADA`, `COMPARTICION_RETIRADA` |

Quién ve qué (`GET /api/actividades?alcance=todo|mias|mis-recursos|conmigo`):
- Un **usuario** ve las acciones que hizo (`mias`), las que otros hicieron sobre sus recursos (`mis-recursos`) y las que otros hicieron **con él** (`conmigo`: le compartieron algo, le quitaron un acceso, desactivaron su cuenta, intentos fallidos de entrar a su cuenta). `todo` es la unión de las tres; cada rama del `$or` usa su índice (19, 21 y 25). No ve la IP.
- El **administrador** ve todo, con filtros por usuario (actor), acción, categoría y fechas, e incluye la IP.
- La línea de tiempo de un recurso (`GET /api/actividades/recurso/:tipo/:id`) la ven su propietario y el administrador, también después de eliminarlo definitivamente (se reconoce al propietario por `recurso.propietarioId` en el historial). Quien solo tiene acceso compartido recibe **403**; quien no tiene acceso, **404**.
- El cliente describe cada acción con una frase en español, en segunda persona cuando quien lee es el actor o el afectado ("Tú compartiste…", "María compartió «Plan.md» contigo").

---

## 7. API REST

Prefijo `/api`. JSON en las peticiones y respuestas (salvo la subida multipart y la descarga). Todas las rutas, excepto iniciar sesión y salud, requieren JWT.

**Formato de error**: `{ "error": { "codigo": "CONFLICTO", "mensaje": "…", "detalles": … } }`.
Códigos: 400 `VALIDACION` · 401 `NO_AUTENTICADO` · 403 `PROHIBIDO` · 404 `NO_ENCONTRADO` · 409 `CONFLICTO` / `CUOTA_EXCEDIDA` · 413 `ARCHIVO_DEMASIADO_GRANDE` · 415 `TIPO_NO_PERMITIDO` · 422 `NO_PROCESABLE` · 500 `ERROR_INTERNO`.
**Paginación**: `?pagina=1&limite=20` (máximo 100) → `{ datos, total, pagina, limite }`.
**Fechas de filtro**: `desde`/`hasta` en formato `AAAA-MM-DD`, interpretadas en `America/Guatemala`; `hasta` incluye todo ese día.

| Módulo | Método y ruta | Quién |
|---|---|---|
| Salud | `GET /salud` | público |
| Autenticación | `POST /autenticacion/iniciar-sesion` | público |
| | `POST /autenticacion/cerrar-sesion` · `GET /autenticacion/perfil` · `PATCH /autenticacion/clave` | autenticado |
| Usuarios | `GET /usuarios` · `POST /usuarios` · `GET /usuarios/:id` · `PATCH /usuarios/:id` · `PATCH /usuarios/:id/estado` · `PATCH /usuarios/:id/clave` | administrador |
| | `GET /usuarios/directorio?buscar=` (activos, para compartir) | autenticado |
| Carpetas | `GET /carpetas/raiz/contenido` · `GET /carpetas/arbol` · `POST /carpetas` | autenticado |
| | `GET /carpetas/:id` (detalle, ruta, acceso, propietario) · `GET /carpetas/:id/contenido` | lectura+ |
| | `PATCH /carpetas/:id` (renombrar) | edición+ |
| | `PATCH /carpetas/:id/mover` · `DELETE /carpetas/:id` (a la papelera) | propietario |
| Archivos | `GET /archivos?buscar=&texto=&tipo=&categoria=&etiqueta=&desde=&hasta=&carpetaId=&alcance=propios\|compartidos&orden=&direccion=&pagina=&limite=` | autenticado |
| | `POST /archivos` (multipart: `archivo`, `carpetaId`, `categoria`, `etiquetas`, `descripcion`) | propietario o edición+ en la carpeta |
| | `GET /archivos/:id` · `GET /archivos/:id/contenido` · `GET /archivos/:id/descarga` | lectura+ |
| | `PUT /archivos/:id/contenido` · `PATCH /archivos/:id` | edición+ |
| | `PATCH /archivos/:id/mover` · `DELETE /archivos/:id` (a la papelera) | propietario |
| | `GET /archivos/:id/comentarios` | lectura+ |
| | `POST /archivos/:id/comentarios` | comentario+ |
| | `DELETE /archivos/:id/comentarios/:comentarioId` | autor o propietario |
| Comparticiones | `GET /comparticiones/recurso/:tipo/:id` (directas y heredadas) · `POST /comparticiones` · `PATCH /comparticiones/:id` · `DELETE /comparticiones/:id` | propietario |
| | `GET /comparticiones/conmigo` · `GET /comparticiones/realizadas` (`?tipo=&buscar=&pagina=&limite=`) | autenticado |
| Papelera | `GET /papelera?tipo=&buscar=&pagina=&limite=` (raíces, con contenido, ubicación original y si volverán a la raíz; `$unionWith` de archivos y carpetas) · `POST /papelera/:tipo/:id/restaurar` · `DELETE /papelera/:tipo/:id` · `DELETE /papelera` | propietario |
| Actividad | `GET /actividades?alcance=&accion=&categoria=&desde=&hasta=&usuarioId=&pagina=&limite=` (`usuarioId` solo administrador) | autenticado (alcance según rol) |
| | `GET /actividades/recurso/:tipo/:id` | propietario o administrador |
| Almacenamiento | `GET /almacenamiento` (usado, cuota, por tipo, en papelera) | autenticado |
| Reportes | `GET /reportes/resumen` y los 12 de la sección 8 | administrador |
| Mantenimiento | `GET /mantenimiento/integridad` | administrador |

---

## 8. Reportes: aggregation pipelines

Todos aceptan filtros (rango de fechas, usuario, tipo, límite) y se calculan en MongoDB. Solo el administrador puede consultarlos (otro rol → **403**). Las fechas `desde`/`hasta` son días `AAAA-MM-DD` en hora de Guatemala (`hasta` incluye todo el día); los rankings aceptan `limite` de 1 a 50 (10 por defecto).

| ID | Ruta | Colección | Pipeline (esencia) |
|---|---|---|---|
| RR-01 | `/reportes/archivos-por-tipo` | archivos | `$match {enPapelera:false}` (opción `incluirPapelera`) → `$group {_id:"$extension", cantidad:{$sum:1}, bytes:{$sum:"$contenido.bytes"}, promedio:{$avg:"$contenido.bytes"}}` → `$sort`. Extra con `$facet`: por categoría |
| RR-02 | `/reportes/archivos-por-fecha?desde&hasta` | archivos | `$match {creadoEn:{$gte,$lt}, enPapelera:false}` (opción `incluirPapelera`) → `$sort {creadoEn:-1}` → `$facet {total:[$count], datos:[$skip,$limit,$lookup usuarios]}`. Además, una serie para la gráfica: `$group` por `$dateTrunc` → `$densify`, por día si el rango es de hasta 62 días, por semana hasta ~1 año y por mes si es más largo o no hay rango (`unidadSerie` en la respuesta) |
| RR-03 | `/reportes/archivos-mas-operaciones` | actividades | `$match {"recurso.tipo":"archivo"}` → `$group` por {archivo, acción} → `$group` por archivo (`operaciones`, `porAccion`, `ultima`) → `$sort` → `$limit` → `$lookup archivos` para el estado actual (activo, en papelera o eliminado, con el último nombre registrado) |
| RR-04 | `/reportes/usuarios-mas-archivos` | archivos | `$group {_id:"$propietarioId", activos:{$sum:{$cond:["$enPapelera",0,1]}}, enPapelera:{$sum:{$cond:["$enPapelera",1,0]}}, bytes:{$sum:"$contenido.bytes"}}` → `$sort {activos:-1, bytes:-1}` → `$limit 10` → `$lookup usuarios`. El orden usa los archivos activos (RN-04) y la papelera se muestra aparte |
| RR-05 | `/reportes/usuarios-mas-compartidos` | comparticiones | `$lookup` a archivos y carpetas (sin papelera) → `$group` por `propietarioId` (`$addToSet` de recursos y destinatarios, comparticiones de archivos/carpetas) → `$size` → `$sort` → `$lookup usuarios` |
| RR-06 | `/reportes/archivos-mas-compartidos` | archivos | `$set {ruta: $concatArrays[ancestros, [_id]]}` → `$lookup comparticiones` con `localField: "ruta"` (arreglo) → usuarios directos vs. efectivos con `$filter`/`$setUnion` → `$size` → `$sort` → `$limit` |
| RR-07 | `/reportes/compartidos-por-usuario/:usuarioId` | comparticiones | `$match {propietarioId}` → `$lookup` archivos y carpetas (con su `estado`: activo o en la papelera) → `$facet` (total, por permiso, personas distintas, página con `$lookup` del destinatario) |
| RR-08 | `/reportes/recibidos-por-usuario/:usuarioId` | comparticiones | `$match {destinatarioId}` → `$lookup` recursos → `$lookup` propietario → `$sort` |
| RR-09 | `/reportes/actividad-usuario/:usuarioId?desde&hasta&categoria` | actividades | `$match {"actor._id", fecha}` → `$sort {fecha:-1}` → `$facet` (total y página); aparte, el desglose `$group` por categoría |
| RR-10 | `/reportes/operaciones-por-tipo` | actividades | `$match fecha` → `$group {categoria, accion}` → `$group` por categoría con `$push` de acciones → `$sort` |
| RR-11 | `/reportes/operaciones-por-periodo?unidad=dia\|semana\|mes&categoria` | actividades | `$group {_id: {$dateTrunc: {date:"$fecha", unit, timezone:"America/Guatemala", startOfWeek:"monday"}}}` (con el desglose por categoría) → `$densify` (rellena períodos sin actividad con 0) → `$sort`. Sin rango: los últimos 30 días, 12 semanas o 6 meses. Máximo 400 períodos (**400**) |
| RR-12 | `/reportes/principales-acciones` | actividades | `$group {accion, actor}` → `$sort` → `$group` por acción (`cantidad`, `usuariosDistintos`, `usuarioPrincipal: $first`) → `$setWindowFields` (total) → `%` del total → `$sort` → `$limit` |
| Resumen | `/reportes/resumen` | varias | Conteos de usuarios activos/inactivos, carpetas, archivos, bytes, papelera, comparticiones y actividad de los últimos 30 días |

Ejemplo completo (RR-11):

```js
// inicio y fin deben estar ALINEADOS al inicio de la unidad (día, lunes o día 1 del mes)
// en America/Guatemala; si no, $densify generaría fechas que no coinciden con los grupos.
db.actividades.aggregate([
  { $match: { fecha: { $gte: inicio, $lt: fin } } },
  { $group: {
      _id: { $dateTrunc: { date: "$fecha", unit: "month",
                           timezone: "America/Guatemala", startOfWeek: "monday" } },
      cantidad: { $sum: 1 } } },
  { $project: { _id: 0, periodo: "$_id", cantidad: 1 } },
  { $densify: { field: "periodo", range: { step: 1, unit: "month", bounds: [inicio, fin] } } },
  { $set: { cantidad: { $ifNull: ["$cantidad", 0] } } },
  { $sort: { periodo: 1 } }
])
```

---

## 9. Arquitectura

### 9.1 Despliegue (desarrollo)

```
[Navegador] ──HTTP──► Angular dev server :4200 (cliente)
     │
     └──HTTP REST + JWT──► Express :8000 (servidor) ──driver mongodb──► MongoDB 9.0.4 :27017
                                                                          ├─ black_vault (colecciones)
                                                                          └─ GridFS contenidos.*
```

El cliente nunca toca la base de datos (RT-03). CORS permite el origen `http://localhost:4200` y expone `Content-Disposition`.

### 9.2 Servidor (`black-vault-express-server`)

```
src/
  servidor.js                   arranque: conecta, prepara el esquema y escucha
  app.js                        Express: middlewares, rutas, 404 y errores
  config/entorno.js             variables de entorno validadas
  bd/conexion.js                MongoClient, bucket GridFS, detección de transacciones
  bd/esquema.js                 validadores ($jsonSchema + $expr) e índices
  bd/atomico.js                 ejecutarAtomico(): transacción si hay replica set
  middlewares/                  autenticar, requerirRol, validar (zod), subida (multer), manejarErrores
  modulos/<modulo>/             <modulo>.rutas.js, .controlador.js, .servicio.js, .esquemas.js
     autenticacion, usuarios, carpetas, archivos, comparticiones, papelera,
     actividades, almacenamiento, reportes, mantenimiento
  servicios/                    permisos.js, historial.js, cuota.js, gridfs.js
  utilidades/                   errores.js (ErrorApi), ids.js, nombres.js, fechas.js, paginacion.js
scripts/
  semilla.js                    carga inicial (npm run semilla)
  datos-semilla/                plantillas de documentos .md/.txt
  verificar-integridad.js       npm run verificar
pruebas/                        node:test + supertest
.env.example
```

Variables de entorno: `PUERTO`, `URI_MONGODB` (`mongodb://127.0.0.1:27017/black_vault`), `JWT_SECRETO`, `JWT_EXPIRACION`, `ORIGEN_CLIENTE`, `TAMANO_MAXIMO_MB`, `CUOTA_POR_DEFECTO_MB`, `ZONA_HORARIA`.

Scripts: `dev` (`node --watch --env-file=.env src/servidor.js`), `start`, `semilla`, `verificar`, `test`. Node 24 trae `--watch` y `--env-file`, así que no hacen falta nodemon ni dotenv.

### 9.3 Cliente (`black-vault-angular-client`)

```
src/app/
  nucleo/        modelos (interfaces), servicios de API, interceptores (token, errores), guardias (autenticado, administrador)
  compartido/    componentes (diálogo de confirmación, ruta/breadcrumb, selector de carpeta en árbol, ícono de archivo), pipes (bytes, fecha relativa)
  diseno/        contenedor principal: barra lateral, barra superior, indicador de espacio
  paginas/
    inicio-sesion/
    mi-unidad/          explorador: subir, crear carpeta, renombrar, mover, compartir, panel de detalles
    compartidos/        compartidos conmigo y por mí
    busqueda/
    visor/              vista previa (.md renderizado), editor y comentarios
    papelera/
    actividad/
    perfil/             datos, cambio de clave, espacio
    administracion/     usuarios, reportes, panel resumen
```

- Standalone, **zoneless** y signals para todo el estado. Formularios reactivos (los *signal forms* de Angular 21 son experimentales).
- Rutas con carga diferida para no superar el presupuesto del bundle inicial.
- `provideHttpClient(withInterceptors([…]))` **sin** `withFetch()`: el backend XHR es el que informa el progreso de las subidas. `environments` con la URL de la API, `LOCALE_ID` `es-GT` y datepicker en español.
- Las carpetas ajenas se abren en `/compartidos/carpeta/:id` (el mismo explorador que `/mi-unidad/carpeta/:id`), para que el menú lateral marque la sección correcta y la ruta empiece en "Compartidos".
- Las descargas usan `HttpClient` con `responseType: 'blob'` (el token va en la cabecera, así que un `<a href>` simple no sirve).
- Markdown con `marked` y la sanitización de `[innerHTML]` de Angular.
- Gráficas de los reportes con componentes propios en HTML/CSS (barras y columnas), con los colores del tema, tooltip por marca y leyenda cuando hay dos series; sin librerías de gráficas (`ng2-charts` exige Angular 22). Cada reporte también muestra su tabla y la exporta a CSV.

---

## 10. Carga inicial (`npm run semilla`)

- Borra y recrea la base `black_vault` (pide confirmación salvo con `--forzar`), crea validadores e índices y termina ejecutando la verificación de integridad.
- **12 usuarios**: 1 administrador y 11 usuarios de distintas áreas (legal, finanzas, recursos humanos, operaciones…), 1 de ellos inactivo con archivos e historial (demuestra RN-09). Distribución desigual de archivos para que el Top 10 se note.
- **Carpetas**: 2–4 raíces por usuario, hasta 3 niveles (por ejemplo `Contratos/2026/Clientes`).
- **57 archivos** en GridFS: 51 activos y 6 en la papelera (la papelera se carga en la fase 7), mezcla de `.md` y `.txt`, las cuatro categorías, con etiquetas. Contenido realista en español (contratos, actas, informes, políticas). Incluye nombres con tildes y ñ, un archivo con saltos CRLF y uno con BOM.
- **34 comparticiones vigentes** de archivos y carpetas con los 3 niveles: herencia (una carpeta y una subcarpeta compartidas con personas distintas), un archivo compartido con 6 personas, lo que compartió una usuaria hoy inactiva, y un archivo que un editor subió a una carpeta ajena (queda a nombre del dueño). El historial incluye 2 cambios de permiso y 2 retiros.
- **20 comentarios** en archivos compartidos. La carga verifica que cada comentario y cada archivo subido por otra persona tuvieran, en su fecha, el permiso necesario.
- **Papelera** (6 archivos): archivos sueltos, una carpeta con subcarpeta y archivos (cascada) que contiene un archivo eliminado antes por separado (conserva su propia raíz y se restaurará en la raíz), y un archivo eliminado por separado dentro de una carpeta activa. El historial incluye además una restauración y dos archivos eliminados definitivamente que ya no existen en la base. La carga verifica que nada en la papelera tenga actividad posterior a su envío.
- **~500 actividades** coherentes con todo lo anterior y repartidas de mayo a octubre de 2026.
- El espacio usado de cada usuario se calcula a partir de sus archivos.

Credenciales de prueba documentadas en el README.

---

## 11. Plan por fases y criterios de aceptación

| Fase | Contenido | Se considera terminada cuando… |
|---|---|---|
| 0 | Análisis y diseño | Este documento está revisado y aprobado |
| 1 | Base | Un solo repo git en la raíz (sin `.git` anidado). `npm run dev` levanta el servidor y `GET /api/salud` reporta MongoDB y si hay transacciones. Colecciones, validadores e índices visibles en Compass. Errores uniformes, 404 y CORS. Cliente con Angular Material (tema M3 en SCSS), layout, rutas diferidas, HttpClient, environments y español; `ng build` y `ng test` sin errores |
| 2 | Autenticación y usuarios | Login/logout con JWT; guardias e interceptor; un usuario inactivo no entra y su sesión se corta; CRUD del admin con sus reglas (no autodesactivarse, último admin, cuota ≥ usado); perfil y cambio de clave; historial; pruebas automáticas |
| 3 | Carpetas y archivos | Crear, navegar con ruta, renombrar, mover sin ciclos; subir (5 MB, tildes), descargar byte a byte (sha256), vista previa, edición con versión optimista (BOM y CRLF conservados); categoría, etiquetas y descripción; búsqueda, filtros y orden; cuota; historial; pruebas |
| 4 | Compartición y comentarios | Compartir, modificar y retirar con 3 niveles; herencia; compartidos conmigo/por mí; panel de acceso directo y heredado; comentarios; la matriz de permisos completa probada automáticamente |
| 5 | Papelera e historial | Papelera en cascada; restaurar (a la raíz si falta el padre, renombrando si hay conflicto); eliminar definitivo (GridFS, comparticiones, espacio); vaciar; vistas de actividad; verificación de integridad |
| 6 | Reportes | Los 12 reportes con filtros, tablas y gráficas; panel resumen del admin |
| 7 | Carga inicial completa | `npm run semilla` deja la base lista para calificar y la integridad sale limpia |
| 8 | Documentación y entrega | `docs/`: modelo documental, manual técnico, manual de usuario con capturas, UML en `.drawio` (casos de uso, secuencias clave, despliegue), README de instalación; repo privado en GitHub |

La semilla crece desde la fase 2 para tener datos de prueba en cada fase.

---

## 12. Notas técnicas y riesgos

| Tema | Detalle y medida |
|---|---|
| Compatibilidad | MongoDB 9.0.4 ↔ driver `mongodb` 7.7 (soporta 9.0 desde 7.3, wire version 29) ↔ Node 24.12 (el driver exige ≥ 20.19). Angular Material **21.2.x** (no 22). `ng2-charts@11` exige Angular 22 → Chart.js directo. `ngx-markdown` exige `zone.js` → `marked` |
| Transacciones | Requieren replica set y MongoDB en Windows se instala standalone. GridFS no acepta sesiones en el driver 7.7. `ejecutarAtomico()` usa una transacción si detecta replica set; si no, ejecuta en orden con compensación. Opcional: convertir la instancia local en replica set de un nodo (`replication.replSetName: rs0` en `mongod.cfg` y `rs.initiate()`) |
| `localhost` en Windows | Node puede resolver `localhost` a `::1` mientras mongod escucha en `127.0.0.1` → usar `mongodb://127.0.0.1:27017` |
| `npm install` | Siempre en Windows. Nunca desde un entorno Linux sobre tus carpetas (instalaría binarios de otra plataforma, como los de esbuild) |
| Express 5 | Los errores de handlers async llegan solos al manejador de errores; comodines con nombre (`/*splat`); `req.query` es de solo lectura (lo validado se guarda en otra propiedad); `req.body` es `undefined` si no hay cuerpo |
| Multer 2 | `defParamCharset: 'utf8'` para nombres con tildes y ñ (por defecto usa latin1) |
| ESM en Node | Sin `__dirname`: usar `import.meta.dirname` |
| Angular zoneless | El estado de la vista va en signals; nada de depender de `setTimeout` para refrescar la vista. `app.spec.ts` se actualiza al quitar la plantilla de bienvenida |
| Texto y codificación | La descarga devuelve los bytes exactos. La vista previa decodifica UTF-8; si el archivo no es UTF-8, la edición se bloquea para no dañar el contenido |
| MongoDB 9.0 | Ningún cambio de compatibilidad afecta al diseño (no se usa JavaScript del lado del servidor; las fechas se agrupan con `$dateTrunc` y zona horaria explícita) |
| Pruebas | Cada fase se prueba contra MongoDB 9.0.4 real antes de entregarse |
| Verificación previa del diseño | Ya se comprobó en MongoDB 9.0.4 (31 de 31 pruebas correctas): validadores `$jsonSchema` + `$expr` (cuota, ciclos, ancestros, compartir consigo mismo), índices únicos parciales, reserva atómica de cuota, pipeline de mover carpeta (a otra carpeta y a la raíz), papelera en cascada y restauración por `raizId`, permiso efectivo heredado, RR-06 con `$lookup` sobre arreglo, RR-11 con `$dateTrunc` en hora de Guatemala + `$densify`, RR-12 con `$setWindowFields`, índice de texto en español, plan de consulta del listado (usa el índice, sin ordenar en memoria) y GridFS byte a byte con BOM, CRLF y tildes |

---

## 13. Pendiente de confirmar con el catedrático

1. Diferencia esperada entre RR-10 ("operaciones agrupadas por tipo") y RR-12 ("principales acciones") — I-04.
2. Si lo que está en la papelera debe contar en el espacio usado — I-10.
3. Si el administrador debe poder abrir el contenido de archivos ajenos — I-08 (se propone que no).
4. Si basta con comentar archivos o también se esperan comentarios sobre carpetas — I-01.

---

### Fuentes verificadas (21-oct-2026)
- [MongoDB 9.0 — cambios de compatibilidad](https://www.mongodb.com/docs/upcoming/release-notes/9.0-compatibility/)
- [Driver de Node.js para MongoDB — notas de versión](https://www.mongodb.com/docs/drivers/node/current/reference/release-notes/)
- Registro de npm: `mongodb` 7.7.0, `mongoose` 9.11.3 (depende de `mongodb ~7.7`), `@angular/material` 21.2.14, `ng2-charts` 11.0.0 (Angular ≥ 22) y 10.0.0 (Angular ≥ 21), `ngx-markdown` 21.3.0 (requiere `zone.js`), `multer` 2.4.0 (`defParamCharset`, por defecto `latin1`).
- Definiciones de tipos del driver `mongodb` 7.7.0: `GridFSBucketWriteStreamOptions` sin opción `session`.
