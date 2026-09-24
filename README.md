# Consulta de Riesgo Financiero

MVP de consulta de score crediticio por RUT, con autenticación JWT y autorización
basada en roles. Desafío técnico para **ProntoPaga / YOL1**.

- **Backend:** API REST en Node.js + TypeScript (Express 5).
- **Frontend:** SPA en React 19 + TypeScript (Vite).
- **Compartido:** paquete de validación de RUT chileno usado por ambos.

### Documentos

| Documento                                    | Contenido                                                        |
| -------------------------------------------- | ---------------------------------------------------------------- |
| [`ANALISIS.md`](./ANALISIS.md)               | Análisis previo: casos contemplados, puntos débiles y decisiones |
| [`ai_interactions.md`](./ai_interactions.md) | Uso de IA: qué se delegó, qué se corrigió y cómo se verificó     |

---

## Puesta en marcha

Requiere **Node.js 20.10 o superior**. No hace falta base de datos ni ningún
servicio externo.

```bash
npm install
cp apps/api/.env.example apps/api/.env   # y edita JWT_SECRET (ver abajo)
npm run dev
```

- API: <http://localhost:3000>
- SPA: <http://localhost:5173>

`npm run dev` compila el paquete compartido y levanta ambas aplicaciones en
paralelo.

### El único paso manual: el secreto de firma

`apps/api/.env` necesita un `JWT_SECRET` de **32 caracteres como mínimo**. Genera
uno con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Si falta o es demasiado corto, **la API no arranca** y explica por qué. Es
deliberado: un valor por defecto silencioso para un secreto de firma es una
vulnerabilidad disfrazada de comodidad.

### Credenciales de prueba

También aparecen en la pantalla de login, con un botón para rellenar el
formulario.

| Email                   | Contraseña  | Rol     | RUT asociado   |
| ----------------------- | ----------- | ------- | -------------- |
| `admin@prontopaga.cl`   | `Admin123!` | `admin` | —              |
| `juan.perez@example.cl` | `User123!`  | `user`  | `12.345.678-5` |
| `maria.soto@example.cl` | `User123!`  | `user`  | `18.765.432-7` |

Las contraseñas se almacenan hasheadas con bcrypt (coste 10), nunca en claro,
aunque el directorio sea simulado.

---

## Scripts

| Comando                 | Qué hace                                     |
| ----------------------- | -------------------------------------------- |
| `npm run dev`           | Levanta API y SPA en paralelo                |
| `npm test`              | Ejecuta las 111 pruebas de los tres paquetes |
| `npm run test:coverage` | Pruebas con informe de cobertura             |
| `npm run typecheck`     | Verificación de tipos sin emitir             |
| `npm run lint`          | ESLint con reglas basadas en tipos           |
| `npm run format`        | Formatea con Prettier                        |
| `npm run build`         | Compila los tres paquetes para producción    |

---

## La API

### `POST /login`

```bash
curl -X POST http://localhost:3000/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"juan.perez@example.cl","password":"User123!"}'
```

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_client_002",
    "email": "juan.perez@example.cl",
    "role": "user",
    "rut": "12.345.678-5"
  }
}
```

El payload del token contiene `sub`, `role` y, **solo cuando el rol es `user`**,
`rut` — además de `iss`, `aud`, `iat` y `exp`.

Se devuelve también el perfil para que la SPA no tenga que decodificar el JWT por
su cuenta: decodificar un token en el cliente invita a confiar en su contenido
sin verificar la firma, que es un antipatrón frecuente.

### `GET /score/:rut`

```bash
curl http://localhost:3000/score/12.345.678-5 \
  -H "Authorization: Bearer $TOKEN"
```

```json
{ "rut": "12.345.678-5", "score": 12, "fecha": "2026-09-24T19:24:53Z" }
```

### `GET /health`

Sonda de vida sin autenticación. No la pide el enunciado, pero cualquier
despliegue real la necesita.

### Respuestas de error

Todos los errores comparten una única forma, para que el cliente no tenga que
distinguir entre formatos:

```json
{ "error": { "code": "RUT_FORBIDDEN", "message": "No tienes permiso para..." } }
```

| Código                    | HTTP | Cuándo                                        |
| ------------------------- | ---- | --------------------------------------------- |
| `VALIDATION_ERROR`        | 400  | Cuerpo de la petición inválido                |
| `INVALID_JSON`            | 400  | El cuerpo no es JSON válido                   |
| `RUT_INVALID`             | 400  | RUT mal formado o con dígito verificador malo |
| `INVALID_CREDENTIALS`     | 401  | Email o contraseña incorrectos                |
| `TOKEN_MISSING`           | 401  | Falta el header `Authorization: Bearer`       |
| `TOKEN_INVALID`           | 401  | Firma, emisor o audiencia inválidos           |
| `TOKEN_EXPIRED`           | 401  | El token caducó                               |
| `RUT_FORBIDDEN`           | 403  | Un `user` pidió un RUT que no es el suyo      |
| `ROUTE_NOT_FOUND`         | 404  | Ruta inexistente                              |
| `TOO_MANY_LOGIN_ATTEMPTS` | 429  | Se superó el límite de intentos de login      |
| `TOO_MANY_REQUESTS`       | 429  | Se superó el límite global                    |
| `INTERNAL_ERROR`          | 500  | Error inesperado (sin detalles en producción) |

---

## Hallazgo: el RUT de ejemplo del enunciado es inválido

El enunciado usa `12.345.678-9` como RUT de ejemplo. Verificado con el algoritmo
**módulo 11**, su dígito verificador correcto es **5**, no 9:

```
Cuerpo: 12345678
8×2 + 7×3 + 6×4 + 5×5 + 4×6 + 3×7 + 2×2 + 1×3 = 138
138 mod 11 = 6  →  11 − 6 = 5
El RUT válido es 12.345.678-5
```

**Decisión tomada:** validar de forma estricta. En una fintech chilena el dígito
verificador se valida siempre; aceptar RUT inválidos significaría consultar
identidades que no existen y ensuciar cualquier análisis posterior.

Para que el rechazo no sea una pared, la respuesta indica el DV esperado:

```json
{
  "error": {
    "code": "RUT_INVALID",
    "message": "El RUT ingresado no es valido: el digito verificador no corresponde al cuerpo (el esperado es \"5\").",
    "details": { "reason": "RUT_INVALID_DV" }
  }
}
```

Los usuarios de prueba se sembraron con RUT válidos para que todo funcione sin
fricción. Si la intención del enunciado era que `12.345.678-9` fuese consultable,
basta con relajar la validación en `packages/rut`; queda documentado aquí porque
es una decisión de producto, no de implementación.

---

## Arquitectura

```
prontopaga-riesgo-financiero/
├── packages/rut/          Validación de RUT chileno (compartido)
├── apps/api/              API REST (Express 5 + TypeScript)
│   └── src/
│       ├── config/        Entorno validado con Zod y logger
│       ├── domain/        Cálculo del score
│       ├── auth/          Directorio mock, contraseñas y JWT
│       ├── middlewares/   Autenticación, autorización, validación, errores
│       ├── routes/        Endpoints
│       └── schemas/       Esquemas Zod de entrada
└── apps/web/              SPA (React 19 + Vite)
    └── src/
        ├── api/           Cliente HTTP y tipos del contrato
        ├── auth/          Sesión en Context API y guarda de rutas
        ├── components/    Componentes reutilizables
        └── pages/         Login y consulta
```

### Por qué un monorepo con un paquete compartido

La normalización de RUT es **seguridad-crítica**: la autorización compara el RUT
del token contra el RUT solicitado. Si la API y la SPA tuvieran implementaciones
separadas y llegaran a divergir, se abriría un hueco en ese control. Un único
módulo compartido hace que esa divergencia sea imposible por construcción.

Se usa **npm workspaces** y no pnpm o Yarn para que el proyecto se levante con
`npm install && npm run dev` sin exigir que quien lo evalúe instale nada más.

---

## Decisiones técnicas

El razonamiento completo —incluidos los casos contemplados y los puntos
débiles asumidos— está en [`ANALISIS.md`](./ANALISIS.md). Aquí va lo esencial.

### El punto más delicado: comparar RUT, no cadenas

Un mismo RUT se escribe de muchas formas: `12.345.678-5`, `12345678-5`,
`123456785`, `012.345.678-5`, con `k` minúscula. Si el middleware de autorización
comparara el parámetro de la ruta contra el `rut` del token **tal como llegan**,
la regla dejaría de ser de identidad y pasaría a ser de formato.

Por eso ambos lados se reducen a una **forma canónica** antes de compararse, y
hay pruebas de regresión para cada variante:

```ts
// apps/api/src/middlewares/authorizeRut.ts
if (!auth.rut || !areSameRut(auth.rut, requestedRut)) {
  /* 403 */
}
```

`areSameRut` **falla cerrado**: ante cualquier entrada inválida devuelve `false`.
Una comparación de permisos nunca debe fallar abriendo el paso.

### Orden de los middlewares

`autenticar → validar → autorizar`. Validar antes de autorizar evita responder
403 a un RUT que en realidad estaba mal escrito, lo que atribuiría el fallo a una
falta de permisos inexistente y dejaría al usuario sin saber qué corregir.

### Score determinista sin estado

El score sale de `SHA-256` sobre la forma canónica del RUT, tomando los primeros
4 bytes como entero sin signo y aplicando módulo 101 para cubrir `[0, 100]`.

Frente a un generador pseudoaleatorio con semilla, el hash no necesita estado, es
estable entre procesos, reinicios y máquinas, y es **reproducible** por quien
evalúe. No lleva sal ni secreto: el score es un dato del dominio, no una
credencial.

El módulo 101 introduce un sesgo del orden de `1e-8` (2³² no es múltiplo exacto
de 101), despreciable para este caso y documentado en el código.

### Estado en el frontend

**Context API**, no Redux. Dos vistas y un único dato compartido —la sesión— no
justifican el peso de un store global. Elegir Redux aquí sería sobreingeniería.

### Dónde vive el token

En `sessionStorage`, que muere al cerrar la pestaña.

**En producción la opción correcta sería una cookie `httpOnly` + `SameSite`
emitida por el backend**, inaccesible desde JavaScript y por tanto no expuesta
ante un XSS. No se implementó aquí porque el enunciado especifica una API que
devuelve el JWT en el cuerpo de la respuesta, y montar el flujo de cookies
—CSRF, refresco, cierre de sesión en servidor— excede el alcance de un MVP.

### El campo del RUT queda editable para un `user`

Se precarga con su propio RUT, pero no se bloquea. Bloquearlo ocultaría
justamente el caso que el enunciado pide cubrir: el mensaje claro al intentar un
RUT no permitido. La barrera real está en el servidor.

Del mismo modo, `ProtectedRoute` es una barrera de experiencia de usuario, **no
un control de seguridad**: quien autoriza de verdad es la API en cada petición.

---

## Seguridad

Referencias a **OWASP Top 10**, aplicadas a lo que el alcance permite.

| Medida                                                           | Contra                                    |
| ---------------------------------------------------------------- | ----------------------------------------- |
| Algoritmo fijado a HS256 + `iss`/`aud` obligatorios              | Confusión de algoritmo, `alg: none`       |
| Tokens de vida corta (15 min por defecto)                        | Ventana de uso de un token robado         |
| Respuesta y **latencia** idénticas ante email o contraseña malos | Enumeración de cuentas (A07)              |
| bcrypt coste 10 incluso para credenciales mock                   | Contraseñas en claro                      |
| Límite de 10 intentos/min en `/login`                            | Fuerza bruta, credential stuffing (A07)   |
| Límite de 200 caracteres en la contraseña                        | DoS por coste de bcrypt                   |
| Validación Zod que descarta campos no declarados                 | Mass assignment (A08)                     |
| `JWT_SECRET` obligatorio y validado al arranque                  | Secretos por defecto (A05)                |
| `.env` excluido del control de versiones                         | Filtración de secretos                    |
| CORS con lista blanca explícita, sin comodines                   | Uso de la API desde orígenes no previstos |
| `helmet` y `X-Powered-By` eliminado                              | Cabeceras faltantes, revelar tecnología   |
| Cuerpo limitado a 10 kB                                          | DoS por payload grande                    |
| Errores genéricos en producción, sin stack traces                | Fuga de información (A05)                 |
| Logs con `Authorization`, cookies y contraseñas redactados       | Filtración de credenciales por los logs   |
| El 403 no devuelve score, fecha ni el RUT consultado             | Confirmar datos de un titular ajeno       |

`npm audit --omit=dev` reporta **0 vulnerabilidades**. Durante el desarrollo se
subieron vitest y vite a versiones parcheadas para dejar también en cero la
auditoría completa.

---

## Pruebas

**111 pruebas**, todas en verde:

| Paquete        | Nº  | Qué cubren                                                    |
| -------------- | --- | ------------------------------------------------------------- |
| `packages/rut` | 33  | Módulo 11, casos borde `K` y `0`, formatos, códigos de error  |
| `apps/api`     | 58  | Login, JWT, autorización, validación, rate limiting, contrato |
| `apps/web`     | 20  | Formularios, errores, validación local, expiración de sesión  |

```bash
npm test
npm run test:coverage
```

Las pruebas que más valor aportan son las de **regresión del control de acceso**
en `apps/api/src/routes/score.routes.test.ts`: comprueban que un `user` accede a
su propio RUT escrito de cualquier forma y que sigue bloqueado ante un RUT ajeno,
también escrito de cualquier forma.

Los datos de prueba no son inventados: los RUT válidos se generaron ejecutando el
propio algoritmo de módulo 11.

---

## Integración continua

`.github/workflows/ci.yml` ejecuta en cada push y pull request:

1. **Calidad** — lint, tipos, formato, pruebas y build de producción.
2. **Seguridad** — `npm audit` sobre dependencias de producción (bloqueante) y
   sobre las de desarrollo (informativo).

Se usa `npm ci` para que la CI instale exactamente las versiones del lockfile.

---

## Qué haría distinto en producción

Fuera del alcance de un MVP de 3 horas, pero parte de la conversación técnica:

- **Cookie `httpOnly` + refresh token** con rotación, en lugar de
  `sessionStorage`.
- **Versionado de la API** (`/api/v1/...`). Aquí las rutas van en la raíz para
  respetar al pie de la letra el contrato del enunciado.
- **Directorio de usuarios real** con proveedor de identidad (OIDC/OAuth2) en vez
  de un arreglo en memoria.
- **Trazabilidad distribuida** (OpenTelemetry) y métricas, más allá del logging
  estructurado que ya existe.
- **Registro de auditoría** de cada consulta de score: en un contexto financiero,
  quién consultó qué RUT y cuándo es un requisito regulatorio.
- **Rate limiting distribuido** con Redis: el actual vive en memoria y no
  sobrevive a varias instancias.
- **Secretos en un gestor** (AWS Secrets Manager, Vault) en lugar de variables de
  entorno planas.

---

## Uso de inteligencia artificial

El desarrollo se apoyó en Claude Code. El detalle de cómo se usó, qué se aceptó,
qué se corrigió y qué se rechazó está en **[`ai_interactions.md`](./ai_interactions.md)**.
