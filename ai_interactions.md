# Uso de herramientas de inteligencia artificial

Documento solicitado en el enunciado. Detalla qué herramienta se usó, cómo, qué
se aceptó, qué se corrigió y qué se rechazó.

## Herramienta

**Claude Code** (Anthropic), modelo Opus 5, ejecutado desde la terminal con
acceso al sistema de archivos, a la shell y a un navegador para verificación
visual.

## Cómo se usó

El asistente se usó como **par de programación**: yo definí el enfoque, las
decisiones de diseño y los criterios de aceptación; el asistente escribió la
mayor parte del código y de las pruebas bajo esa dirección, y yo revisé,
corregí y validé cada pieza antes de confirmarla en un commit.

El flujo por cada porción de trabajo fue:

1. Acordar el alcance y las decisiones de diseño.
2. Implementación.
3. **Verificación real**, no solo lectura: ejecutar las pruebas, levantar la API
   y golpearla con `curl`, abrir la SPA en un navegador y recorrer los flujos.
4. Corregir lo que la verificación destapara.
5. Commit.

Nada se dio por bueno porque "parecía correcto". Cada afirmación de este
repositorio tiene detrás una ejecución.

## Decisiones que tomé yo

Estas no salieron del asistente; marcaron el rumbo del proyecto:

- **Validar el RUT con módulo 11 de forma estricta**, aun sabiendo que eso
  rechaza el RUT de ejemplo del propio enunciado, y comunicar el DV esperado en
  el mensaje de error en lugar de devolver un 400 seco.
- **Extraer la validación de RUT a un paquete compartido** en vez de duplicarla,
  porque la normalización es seguridad-crítica para el control de autorización.
- **Alcance:** cubrir lo pedido con calidad alta más un conjunto acotado de
  extras (pruebas, rate limiting, CI, auditoría), sin caer en sobreingeniería.
  Se descartaron de forma explícita arquitectura hexagonal, Docker y OpenAPI:
  para dos endpoints habrían sido peso muerto.
- **Context API en vez de Redux**, por el mismo criterio.
- **No versionar la API** (`/login` y no `/api/v1/login`) para respetar al pie de
  la letra el contrato del enunciado, dejando la observación en el README.
- **Mantener el campo de RUT editable** para el rol `user`, porque bloquearlo
  ocultaría el caso de error que el enunciado pide cubrir.

## Errores del asistente que detecté y corregí

Esta sección es la parte honesta del documento. El código generado por IA tuvo
fallos reales; se detectaron porque se verificó, no porque se leyera por encima.

### 1. Una prueba mal planteada que daba un falso negativo

La prueba de "no filtrar datos en una respuesta 403" afirmaba que el cuerpo no
debía contener la cadena `"score"`. Falló, pero **no por un fallo del código**:
el mensaje del 403 contiene literalmente la palabra ("No tienes permiso para
consultar el _score_ de otro RUT"). La aserción medía la palabra, no el dato.

Se reescribió para comprobar lo que realmente importa: que el cuerpo del 403
tenga exclusivamente la clave `error`, y ni `score` ni `fecha`.

### 2. Aserción non-null que reventaba la aplicación

`ScorePage` hacía `session!.user`. La sesión puede volverse `null` **mientras la
vista está montada**: es exactamente lo que ocurre cuando la API responde que el
token expiró y se cierra la sesión. El componente lanzaba una excepción no
capturada en ese instante.

Salió a la luz al ejecutar las pruebas, que registraron una excepción no
capturada aunque las aserciones pasaran. Se corrigió dividiendo la vista en
`ScorePage` (comprueba la sesión y redirige) y `ScoreForm` (recibe una sesión
garantizada), eliminando la aserción non-null en lugar de silenciar el síntoma.
La auditoría posterior encontró que quedaba otra en el backend
(`score.routes.ts`); también se sustituyó por una comprobación explícita, de modo
que hoy no queda ninguna en código de producción.

### 3. Promesas sin dueño en los formularios

ESLint, con reglas basadas en tipos, detectó que ambos formularios pasaban un
handler `async` a `onSubmit`, donde React espera `void`: la promesa quedaba sin
nadie que capturara un eventual rechazo. Se corrigió descartándola de forma
explícita con `void`.

### 4. Un script declarado sin nada que lo respaldara

El `package.json` declaraba `npm run lint` sin configuración de ESLint: el script
habría fallado en cuanto alguien lo ejecutara. Se añadió la configuración, y al
hacerlo aparecieron los puntos 3 y 5.

### 5. Archivos de prueba fuera de toda verificación de tipos

Los `tsconfig.json` excluían los tests para que no acabaran en el build. El
efecto colateral es que quedaban sin analizar por el linter y sin comprobación de
tipos completa. Se separó `tsconfig.json` (editor y lint, incluye los tests) de
`tsconfig.build.json` (emisión, los excluye).

### 6. Dependencia no declarada

El logger se configuró con `pino-pretty` sin añadirlo a `package.json`. Habría
funcionado en la máquina de desarrollo por estar en el árbol de forma transitiva,
y habría fallado en una instalación limpia.

### 7. Vulnerabilidades en la cadena de herramientas

`npm audit` reportaba 6 vulnerabilidades (2 críticas) en vitest, vite y esbuild.
Eran todas de desarrollo —`npm audit --omit=dev` ya daba cero—, pero se
actualizaron igualmente a versiones parcheadas: en una prueba para una fintech,
una auditoría limpia vale más que la explicación de por qué no lo está.

### 8. Conflicto de resolución en el monorepo

Las pruebas del frontend fallaban al arrancar: `@testing-library/jest-dom`
quedaba en la raíz y `vitest` anidado por workspace, así que el primero no podía
resolver al segundo. Se resolvió declarando `vitest` como herramienta compartida
en la raíz, que es donde ya viven TypeScript y ESLint.

### 9. Errores de tipado que el modo estricto atrapó

Tres, corregidos en su origen y no con un `any`:

- `expiresIn` incumplía `exactOptionalPropertyTypes` por incluir `undefined`.
- Express 5 tipa `req.params.rut` como `string | string[]`; se trata cualquier
  forma inesperada como entrada inválida en lugar de forzar la conversión.
- El middleware de autorización volvía a leer el parámetro crudo en vez de usar
  el RUT ya normalizado; se unificó la fuente del dato.

## Auditoría previa a la entrega

Antes de publicar el repositorio se lanzó una revisión en tres frentes
independientes —cumplimiento del enunciado, seguridad adversarial y veracidad de
la documentación— con instrucciones de verificar contra el código y contra la
aplicación en ejecución, nunca contra lo que afirmaban los documentos.

Lo que confirmó:

- Ningún incumplimiento funcional del enunciado.
- **Ningún bypass del control de acceso.** Se intentó con variantes de formato,
  codificación de URL, recorrido de rutas, parámetros matriz, bytes nulos, 18
  separadores Unicode distintos, homoglifos de la letra K, dígitos no ASCII,
  hasta mil ceros a la izquierda y contaminación de prototipo. Todos devolvieron
  403 o 401. Se comprobó además, por fuzzing, que la normalización del RUT es
  idempotente y libre de colisiones, que es la propiedad de la que depende todo
  el esquema de autorización.

Lo que encontró, y se corrigió antes de entregar:

1. **`npm run test:coverage` fallaba en los tres paquetes.** `@vitest/coverage-v8`
   estaba declarado en los workspaces mientras `vitest` vivía en la raíz, y el
   lockfile fijaba esa disposición: cualquier clon limpio reproducía el fallo. El
   comando estaba documentado dos veces en el README. Es el mismo tipo de error
   de resolución descrito en los puntos 6 y 8 de arriba, lo que confirma que un
   fallo corregido en un sitio no queda cerrado en los demás. Ahora la CI ejecuta
   `test:coverage` en lugar de `npm test`, para que se rompa aquí y no en la
   máquina de quien clone el repositorio.
2. **El mínimo de Node declarado era falso**: se anunciaba 20.10 cuando Vite 7
   exige 20.19. Quien siguiera el README con un Node 20.1x chocaba en el primer
   comando.
3. **Los errores de `body-parser` se respondían como 500** y, fuera de
   producción, con el mensaje interno incluido. El límite de 10 kB —que es un
   control anti-DoS— se reportaba como fallo del servidor, y cada petición
   malformada escribía un stack completo en el log sin autenticación previa. Se
   mapearon a 413, 415 y 400, y se bajaron a nivel `debug`.
4. **El parseo del cuerpo corría antes del rate limiter**, así que un cuerpo
   grande generaba el error antes de que ningún límite pudiera frenarlo: la
   propia protección era el vector de abuso. Se invirtió el orden.
5. **Faltaba `Cache-Control: no-store`** en respuestas que llevan un JWT o el
   score de una persona, y Express añadía un `ETag` que las hacía revalidables.
6. **`exp` no era obligatorio** al verificar el token: uno emitido sin
   expiración se aceptaba indefinidamente, lo que contradecía la vigencia de 15
   minutos que promete el README.
7. **CORS solo admitía `localhost`**, no `127.0.0.1`. El navegador los trata como
   orígenes distintos, así que abrir la SPA por la IP dejaba la aplicación
   mostrando un "no se pudo conectar" indistinguible de un servidor caído.
8. **El esquema `Bearer` se comparaba distinguiendo mayúsculas**, cuando el RFC
   7235 lo define insensible a la caja.
9. **Una respuesta 200 sin cuerpo dejaba la interfaz sin resultado ni error**: el
   cliente devolvía `null` y la vista no mostraba nada.
10. **Los textos visibles iban sin tildes** mientras los mensajes del servidor sí
    las llevaban, de modo que convivían en la misma pantalla la etiqueta
    "Contrasena" y el error "Email o contraseña incorrectos".
11. **Una afirmación del README no era verificable** desde el repositorio: decía
    que se habían actualizado vitest y vite a versiones parcheadas, pero eso
    ocurrió antes del primer commit y no hay rastro en el historial. Se reformuló
    para describir el estado actual en lugar de un hito no comprobable.

Cada corrección de seguridad lleva su prueba de regresión: el 413, la cabecera
`no-store`, el esquema `Bearer` en minúsculas y el token sin `exp` fallan la
suite si alguien los revierte.

## Verificación independiente

Además de las 111 pruebas automatizadas:

- **Se generaron los dígitos verificadores ejecutando el algoritmo**, en lugar de
  usar RUT de ejemplo tomados de memoria. Los datos de prueba están calculados,
  no inventados.
- **Se recorrió la API con `curl`**: login de ambos roles, inspección del payload
  del JWT, consulta propia, el mismo RUT en otro formato, RUT ajeno (403), el RUT
  inválido del enunciado (400), sin token (401) y credenciales incorrectas.
- **Se abrió la SPA en un navegador real** y se recorrieron los flujos de login,
  consulta correcta, RUT no permitido y dígito verificador inválido, además de
  comprobar el diseño a 390 px de ancho y revisar la consola.

El score devuelto por `curl` y el mostrado en el navegador coinciden, lo que
confirma el determinismo de punta a punta.

## Qué no se delegó

- El criterio sobre qué construir y qué dejar fuera.
- La decisión sobre el RUT inválido del enunciado, que es de producto.
- El modelo de amenazas: qué se protege y por qué.
- La aceptación de cada commit.

## Nota sobre el enfoque

El enunciado y la descripción del cargo insisten en comprender el código generado
y no caer en _vibe coding_. Lo que este repositorio puede acreditar es que
**ninguna decisión se tomó por inercia**: el orden de los middlewares, la elección
de una función hash frente a un generador pseudoaleatorio, el ataque concreto que
cierra cada medida de seguridad y las limitaciones asumidas están razonados por
escrito en el README y en [`ANALISIS.md`](./ANALISIS.md), y cada uno de esos
razonamientos tiene detrás una ejecución que lo verifica.

El trabajo se hizo con un asistente escribiendo la mayor parte del código bajo mi
dirección, y la revisión se apoyó en la ejecución —pruebas automatizadas,
peticiones reales con `curl`, recorrido de la aplicación en un navegador y una
auditoría posterior en tres frentes— más que en la lectura línea por línea. Las
decisiones de criterio, el alcance y la aceptación de cada commit fueron mías.

Las limitaciones conocidas están documentadas antes de que nadie tenga que
encontrarlas: el token en `sessionStorage` en lugar de una cookie `httpOnly`, el
rate limiting en memoria que no sobrevive a varias instancias, la ausencia de
registro de auditoría y el sesgo despreciable del módulo en el cálculo del score.
