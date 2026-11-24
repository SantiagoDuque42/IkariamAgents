# Protocolo de aprendizaje 1.0

## Dos circuitos compatibles

El aprendizaje de hechos usa `learning_claim` y no exige respuesta humana cuando
la evidencia es suficiente. Los casos `learning_case` de UPGRADERS siguen atendiendo
preguntas de preferencias. No convertir automáticamente un caso antiguo pendiente
en una respuesta ni modificar su contrato o sus transiciones.

`candidate → active → superseded/rejected`. Antes de activar, ejecutar el evaluador.
La elegibilidad es calculada, no una declaración editable de confianza. Una
afirmación activa puede dejar de ser utilizable aunque el estado siga siendo activo:
comprobar vigencia y dependencias en cada lectura. `retire_claim` conserva el motivo
y el historial; crear una afirmación nueva si cambia el valor.

## Evidencia y alcance

Cada registro tiene cuenta, mundo, versión exacta y entorno `live`/`pts`. El comodín
`*` solo se permite para cuenta y mundo en mecánicas o procedimientos compartidos;
los parámetros, preferencias e hipótesis quedan en su cuenta y mundo. La versión
nunca es comodín. Una observación de PTS no valida una regla live.

Una fuente tiene `source_type`, `origin`, `locator`, `observed_at`, `game_version`,
`environment`, `access`, `stance`, `summary` y SHA-256 del fragmento consultado.
Para anuncios de versión, exigir `effective_at`; conservar `published_at` cuando
se conozca. Un anuncio futuro no activa una regla antes de entrar en vigor.
`origin` identifica al autor o conjunto de datos original: una wiki que copia un
anuncio no es una confirmación independiente. La huella sirve para detectar cambios,
no acredita por sí sola la verdad. No inventar hashes de contenido no leído.

- **Mecánica:** evidencia accesible de ayuda observada dentro del juego
  (`game_observation`) o anuncio live para esa
  versión, o dos orígenes independientes de wiki/informes más pruebas reservadas.
  La ayuda pública web (`official_help`) sin versión no basta por sí sola.
- **Parámetro:** observación de interfaz o informe de la misma cuenta y mundo.
- **Preferencia:** confirmación explícita del usuario, de esa cuenta y mundo.
- **Procedimiento:** comprobaciones reproducibles y conjunto reservado que pase.
- **Hipótesis:** conservar para investigación; nunca activar como regla.

Una contradicción accesible del mismo ámbito impide activación. Resolverla mediante
una afirmación nueva con explicación, sin borrar el hallazgo anterior. Un anuncio
de parche no certifica todas las cifras de una guía ni la versión actual del servidor.

## Pruebas y caducidad

Los tests incluyen `case_id`, `partition: development|holdout`, `passed` y
`evidence_ids`. Una prueba debe referenciar evidencia existente. Un test de datos
ficticios prueba el software; no confirma fidelidad frente al juego. Mantener
separados esos resultados al informar.

Los TTL de perfiles son valores de revisión del plugin, no reglas de Ikariam.
Acortar la caducidad según riesgo y volatilidad; un valor de stock o ETA necesita
observación mucho más reciente que un concepto. No renovar `observed_at` por releer
una nota. Si cambia una dependencia o versión, revisar todas sus reglas consumidoras.

## Memoria y coordinación

Reutilizar el mismo ID para la misma afirmación, valor y ámbito. Una nueva evidencia
requiere conciliación con la revisión recién leída; no sobrescribir historial ajeno.
Guardar un resumen del ciclo por módulo: lagunas, fuentes consultadas, reglas
activadas/retiradas, error observado y próxima condición de revisión. No aumentar
contadores de progreso del Debugger al escribir una nota de aprendizaje.

ORQUESTRADOR mantiene una cola común y resuelve dependencias; cada especialista
mantiene su evidencia. Evitar siete búsquedas repetidas del mismo parche. Anotar una
sola observación de fuente y referenciarla donde corresponda. Un módulo pausado no
impide que otros investiguen. Ningún circuito cambia reservas, autorizaciones ni
reglas de ejecución. No enviar mensajes ni actuar en Gameforge por aprender un dato.
