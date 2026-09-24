# Análisis del requerimiento

Análisis que guió la implementación: qué pide el enunciado, qué casos hay que
contemplar, dónde están los puntos débiles y qué decisiones se tomaron sobre cada
uno. Recoge el razonamiento previo a escribir cada porción de código; el
documento se redactó al cerrar el desarrollo, de modo que las tablas de casos
referencian las pruebas que efectivamente los cubren.

---

## 1. Entendimiento del problema

Se pide un MVP de **consulta de score crediticio por RUT** con control de acceso
por rol. El dominio es una fintech bancaria chilena, lo que condiciona dos cosas
que el enunciado no dice de forma explícita pero que un sistema real exige:

1. **El RUT es un identificador con checksum**, no una cadena libre. Aceptar RUT
   sintácticamente inválidos significa consultar identidades que no existen.
2. **El dato consultado es sensible.** El score crediticio de una persona no
   puede quedar accesible a quien no le corresponde, ni siquiera de forma
   parcial (por ejemplo, confirmando su existencia mediante un mensaje de error).

El corazón del ejercicio no es el CRUD: es el **control de autorización a nivel
de registro** (un usuario solo ve su propia fila) y la **corrección del dato de
identidad** sobre el que se aplica ese control.

---

## 2. Actores y matriz de permisos

| Actor       | Autenticado | `rut` en el token | Puede consultar          |
| ----------- | ----------- | ----------------- | ------------------------ |
| Anónimo     | No          | —                 | Nada                     |
| Rol `user`  | Sí          | Sí (obligatorio)  | Únicamente su propio RUT |
| Rol `admin` | Sí          | No                | Cualquier RUT            |

Consecuencia de diseño: **un token de rol `user` sin `rut` es un token inválido**,
no un token con permisos reducidos. Si llegara uno así, no hay forma de evaluar
la regla de autorización, y lo seguro es rechazarlo, no dejarlo pasar.

---

## 3. El punto crítico: la comparación de RUT

Esta es la pieza que decide si la solución es correcta o tiene un agujero.

La regla dice: _el RUT consultado debe coincidir con el RUT del token_. La
pregunta es **qué significa "coincidir"**.

Un mismo RUT admite muchas escrituras:

```
12.345.678-5     12345678-5     123456785
012.345.678-5    12.345.678 - 5    10.000.013-k  vs  10.000.013-K
```

Si la comparación se hace sobre las cadenas crudas:

```ts
if (req.params.rut !== req.auth.rut) return res.status(403); // ❌ frágil
```

...la regla deja de ser de **identidad** y pasa a ser de **formato**. Eso produce
dos fallos distintos:

- **Falso negativo:** el usuario escribe su propio RUT sin puntos y recibe un 403. Es un fallo funcional visible.
- **Falso positivo (el grave):** en una implementación donde el RUT del token se
  normalizara pero el de la ruta no —o al revés—, una variante de formato podría
  colarse. El riesgo depende de por dónde se normalice, y esa asimetría es
  exactamente el tipo de error que no se ve leyendo el código por encima.

**Decisión:** reducir ambos lados a una **forma canónica** antes de comparar, y
encapsular esa operación en una única primitiva (`areSameRut`) que:

- normaliza separadores, caja y ceros a la izquierda;
- **falla cerrado**: ante cualquier entrada inválida devuelve `false`, porque una
  comprobación de permisos nunca debe fallar abriendo el paso.

**Decisión derivada:** esa primitiva vive en un **paquete compartido** entre API
y SPA. Si cada lado tuviera su propia implementación y llegaran a divergir, el
hueco se abriría solo. Un módulo único lo hace imposible por construcción.

---

## 4. Casos a contemplar

### Autenticación

| Caso                                       | Esperado            | Cubierto en           |
| ------------------------------------------ | ------------------- | --------------------- |
| Credenciales válidas                       | 200 + token         | `auth.routes.test.ts` |
| Contraseña incorrecta                      | 401 genérico        | `auth.routes.test.ts` |
| Email inexistente                          | 401 **idéntico**    | `auth.routes.test.ts` |
| Email con otra caja (`JUAN@...`)           | 200                 | `auth.routes.test.ts` |
| Email con formato inválido                 | 400                 | `auth.routes.test.ts` |
| Campos ausentes                            | 400                 | `auth.routes.test.ts` |
| Cuerpo que no es JSON                      | 400                 | `auth.routes.test.ts` |
| Cuerpo con campos de más (`role: 'admin'`) | 200, campo ignorado | `auth.routes.test.ts` |
| Muchos intentos seguidos                   | 429                 | `rateLimit.test.ts`   |

### Token

| Caso                           | Esperado            | Cubierto en      |
| ------------------------------ | ------------------- | ---------------- |
| Token válido de `user`         | `sub`+`role`+`rut`  | `tokens.test.ts` |
| Token válido de `admin`        | sin `rut`           | `tokens.test.ts` |
| Token expirado                 | 401 `TOKEN_EXPIRED` | `tokens.test.ts` |
| Token firmado con otro secreto | 401 `TOKEN_INVALID` | `tokens.test.ts` |
| Token con `alg: none`          | 401                 | `tokens.test.ts` |
| Token para otra audiencia      | 401                 | `tokens.test.ts` |
| Token de `user` **sin** `rut`  | 401                 | `tokens.test.ts` |
| Token con rol desconocido      | 401                 | `tokens.test.ts` |
| Cadena que no es un JWT        | 401                 | `tokens.test.ts` |

### Autorización sobre el score

| Caso                                             | Esperado     | Cubierto en            |
| ------------------------------------------------ | ------------ | ---------------------- |
| Sin header `Authorization`                       | 401          | `score.routes.test.ts` |
| Esquema distinto de `Bearer`                     | 401          | `score.routes.test.ts` |
| Token manipulado                                 | 401          | `score.routes.test.ts` |
| `user` consulta su propio RUT                    | 200          | `score.routes.test.ts` |
| **`user` consulta su RUT en otro formato**       | **200**      | `score.routes.test.ts` |
| `user` consulta un RUT ajeno                     | 403          | `score.routes.test.ts` |
| **`user` consulta un RUT ajeno en otro formato** | **403**      | `score.routes.test.ts` |
| `admin` consulta cualquier RUT                   | 200          | `score.routes.test.ts` |
| El cuerpo del 403 no filtra datos del titular    | solo `error` | `score.routes.test.ts` |

### Validación del RUT

| Caso                             | Esperado          | Cubierto en            |
| -------------------------------- | ----------------- | ---------------------- |
| DV incorrecto                    | 400 + DV esperado | `score.routes.test.ts` |
| Cuerpo con letras                | 400               | `index.test.ts` (unit) |
| DV distinto de dígito o `K`      | 400               | `index.test.ts` (unit) |
| Cuerpo demasiado corto o largo   | 400               | `index.test.ts` (unit) |
| RUT vacío                        | 400               | `index.test.ts` (unit) |
| DV `K` y DV `0` (casos borde)    | válidos           | `index.test.ts` (unit) |
| RUT inválido con token de `user` | **400**, no 403   | `score.routes.test.ts` |

### Score

| Caso                            | Esperado              | Cubierto en            |
| ------------------------------- | --------------------- | ---------------------- |
| Mismo RUT, muchas llamadas      | mismo valor           | `score.test.ts` (unit) |
| Mismo RUT en distintos formatos | mismo valor           | `score.test.ts` (unit) |
| RUT distintos                   | valores dispersos     | `score.test.ts` (unit) |
| Rango                           | entero en `[0, 100]`  | `score.test.ts` (unit) |
| Extremos alcanzables (0 y 100)  | sí, en muestra amplia | `score.test.ts` (unit) |

### Frontend

| Caso                               | Esperado                 | Cubierto en          |
| ---------------------------------- | ------------------------ | -------------------- |
| Campos vacíos                      | error local, sin llamada | `LoginPage.test.tsx` |
| Credenciales incorrectas           | mensaje claro            | `LoginPage.test.tsx` |
| Servidor caído                     | mensaje de red           | `LoginPage.test.tsx` |
| Contraseña tras fallo              | se limpia                | `LoginPage.test.tsx` |
| `user` ve su RUT precargado        | sí, editable             | `ScorePage.test.tsx` |
| `admin` ve el campo vacío          | sí                       | `ScorePage.test.tsx` |
| DV inválido                        | error local, sin llamada | `ScorePage.test.tsx` |
| RUT ajeno                          | mensaje de permisos      | `ScorePage.test.tsx` |
| Resultado previo tras un error     | desaparece               | `ScorePage.test.tsx` |
| Token expirado durante la consulta | cierra sesión y explica  | `ScorePage.test.tsx` |

---

## 5. Puntos débiles identificados

Riesgos detectados en el análisis, con la decisión tomada sobre cada uno.

### 5.1 El RUT de ejemplo del enunciado es inválido

`12.345.678-9` no pasa módulo 11; su DV correcto es `5`.

**Riesgo:** si validamos estricto, quien evalúe prueba el ejemplo del propio PDF
y recibe un 400, pudiendo interpretarlo como un fallo.

**Decisión:** validar estricto igualmente —en una fintech chilena el DV se valida
siempre— y **mitigar el riesgo devolviendo el DV esperado en el mensaje**, además
de documentarlo en el README. El rechazo pasa de ser un muro a ser una
demostración de conocimiento del dominio.

### 5.2 Enumeración de usuarios en el login

**Riesgo:** responder distinto ante "email no existe" y "contraseña incorrecta"
permite descubrir qué cuentas existen. La diferencia puede ser de **contenido** o
de **latencia**: si el email no existe no se ejecuta bcrypt, y la respuesta llega
notablemente antes.

**Decisión:** respuesta idéntica en código y mensaje, **y** comparación bcrypt
contra un hash señuelo cuando el email no existe, para igualar los tiempos.

### 5.3 Fuerza bruta sobre el login

**Decisión:** rate limiting específico en `/login`, más estricto que el global.

**Debilidad conocida y asumida:** el contador vive **en memoria del proceso**. Con
varias instancias detrás de un balanceador, el límite efectivo se multiplica por
el número de instancias. La solución correcta es un almacén compartido (Redis);
queda fuera del alcance de un MVP y documentado como tal.

### 5.4 El token en el navegador

**Riesgo:** cualquier almacenamiento accesible desde JavaScript (`localStorage`,
`sessionStorage`) queda expuesto ante un XSS.

**Decisión:** `sessionStorage`, que al menos muere al cerrar la pestaña, y
**documentar explícitamente** que la opción correcta en producción es una cookie
`httpOnly` + `SameSite` emitida por el backend. No se implementó porque el
enunciado especifica una API que devuelve el JWT en el cuerpo, y el flujo
completo de cookies —CSRF, refresco, cierre en servidor— excede el MVP.

### 5.5 Confusión de algoritmo en el JWT

**Riesgo:** una verificación que no fija el algoritmo acepta `alg: none` o un
cambio de asimétrico a simétrico.

**Decisión:** algoritmo fijado a HS256 en firma y verificación, con `issuer` y
`audience` obligatorios.

### 5.6 Sesgo del módulo en el cálculo del score

**Riesgo:** `uint32 % 101` no reparte de forma perfectamente uniforme, porque 2³²
no es múltiplo de 101.

**Evaluación:** el sesgo es del orden de `1e-8` en la frecuencia relativa de los
primeros valores. Irrelevante para este caso de uso.

**Decisión:** asumirlo y **dejarlo escrito en el código**, en lugar de
complicar la implementación con rechazo por muestreo para un MVP.

### 5.7 Un 403 puede filtrar información

**Riesgo:** si la respuesta de "no autorizado" incluyera el score, la fecha o
incluso el RUT consultado, estaría confirmando datos de un titular ajeno.

**Decisión:** el cuerpo del 403 contiene **exclusivamente** la clave `error`, con
un test que lo verifica.

### 5.8 Confundir la causa del rechazo

**Riesgo:** si la autorización corriera antes de la validación, un RUT mal
escrito devolvería 403 y el usuario creería que es un problema de permisos.

**Decisión:** orden explícito **autenticar → validar → autorizar**, con un test
que comprueba que un RUT inválido da 400 incluso con un token de rol `user`.

### 5.9 Mass assignment en el login

**Riesgo:** confiar en campos del cuerpo que el cliente no debería controlar
(`role`, `rut`).

**Decisión:** validación Zod que **reemplaza** el body por el resultado del
parseo, descartando todo lo no declarado. El rol sale siempre del directorio.

### 5.10 Sin registro de auditoría

**Debilidad asumida:** no se registra quién consultó qué RUT y cuándo. En un
contexto financiero real esto es un requisito regulatorio, no una mejora. Queda
fuera del alcance y documentado en el README.

---

## 6. Decisiones con sus contrapartidas

| Decisión                                 | A favor                                                    | En contra                                      |
| ---------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| Monorepo con paquete compartido          | Imposible que cliente y API diverjan en el RUT             | Un paso de build extra                         |
| npm workspaces (no pnpm/yarn)            | `npm install && npm run dev` sin instalar nada más         | Hoisting menos predecible                      |
| Express 5                                | El enunciado habla de "middlewares"; errores async nativos | Ecosistema de tipos algo menos maduro          |
| Hash en vez de generador pseudoaleatorio | Sin estado, reproducible entre máquinas y reinicios        | Sesgo de módulo despreciable                   |
| Context API en vez de Redux              | Proporcionado al alcance: dos vistas, un dato              | Habría que revisarlo si el estado creciera     |
| Rutas en la raíz (sin `/api/v1`)         | Respeta el contrato del enunciado al pie de la letra       | No es lo que haría en producción               |
| Campo de RUT editable para `user`        | Hace alcanzable el error que el enunciado pide cubrir      | Permite un 403 "autoinfligido"                 |
| Validación de RUT en cliente y API       | Respuesta inmediata sin perder la barrera real             | Lógica en dos sitios (mitigado por el paquete) |

---

## 7. Criterios de aceptación

Lo que debe cumplirse para considerar el trabajo terminado.

- [x] `POST /login` con credenciales mock y sin persistencia.
- [x] JWT firmado con `sub`, `role` y `rut` únicamente si `role === 'user'`.
- [x] `GET /score/:rut` devuelve `{ rut, score, fecha }` con score en `[0, 100]`.
- [x] El score es determinista por RUT y varía entre RUT distintos.
- [x] Middleware de autenticación que valida **firma y expiración**.
- [x] Middleware de autorización: `user` solo su RUT, `admin` cualquiera.
- [x] SPA responsive con login y consulta de score.
- [x] Mensajes claros ante RUT no permitido y ante fallo de autenticación.
- [x] `README.md` con instrucciones de ejecución local.
- [x] `ai_interactions.md` con el detalle del uso de IA.
- [x] La autorización resiste variantes de formato del RUT (prueba de regresión).
- [x] Lint, tipos, formato, pruebas y build en verde.
- [x] `npm audit` sin vulnerabilidades.

---

## 8. Fuera de alcance

Consciente y documentado, no olvidado: cookie `httpOnly` con refresh token,
versionado de la API, proveedor de identidad real, trazabilidad distribuida,
registro de auditoría, rate limiting distribuido y gestor de secretos. El detalle
está en la sección final del [README](./README.md).
