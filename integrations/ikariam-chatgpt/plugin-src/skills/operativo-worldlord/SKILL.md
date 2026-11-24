---
name: operativo-worldlord
description: "WORLDLORD: Extraer datos del mapamundi de Ikariam: islas, jugadores, ciudades, puntuaciones y clanes o alianzas. Usar cuando se invoque WORLDLORD o se gestione este ámbito operativo."
---

# WORLDLORD

Actuar como módulo independiente del área indicada, coordinado por ORQUESTRADOR. Leer [arquitectura por módulos](../operativo-orquestador/references/dominios.md) y usar los contratos comunes. Identificar el módulo como `operativo-worldlord` en sobres, propuestas, errores y registros propios.

Extraer el estado externo del servidor: islas y coordenadas, recursos, yacimientos, maravillas y plazas; jugadores, ciudades, puntuaciones observadas y clanes o alianzas.

1. Identificar comunidad, mundo y fuente antes de leer. Usar `icariam_status` y `search_atlas_map` para la copia de Atlas disponible; no extrapolarla a otro servidor.
2. Recorrer páginas con los filtros y cursores de la misma consulta. Conservar cobertura, campos ausentes, errores parciales y fechas de las fuentes.
3. Asociar cada ciudad a isla y jugador solo con evidencia. Mantener jugador y alianza como entidades distintas; nombres parecidos no demuestran identidad.
4. Guardar puntuación y afiliación con tipo y fecha. Una ocupación agregada no revela habitantes y una lista parcial no representa todo el servidor.
5. Distinguir cuentas propias, amigos, aliados y otros jugadores sin completar datos desconocidos. Recoger datos del juego; no deducir datos personales ajenos.
6. Emitir lotes `observation_batch` para la etapa común de estado. Ofrecerlos a SPY, DIPLOMAT y GENERAL a través de ORQUESTRADOR.

WORLDLORD es recolector: no selecciona ataques, envía mensajes ni asigna presupuestos. Una nueva integración del mapamundi debe declarar cobertura y acceso reales antes de habilitarse.

## Integración

Recibir únicamente el estado y objetivo pertinentes. Publicar las observaciones como `observation_batch` y, si corresponde al rol gestor, alternativas como `proposal`; añadir `module_id` a las acciones. Pasar las decisiones que comprometan recursos por el arbitraje común y usar ejecución y seguimiento para sus recibos. Mantener el rol recolector cuando esta área solo extraiga datos.

No presentar una herramienta de registro como una acción en Gameforge. Usar el adaptador manual actual y comprobar las capacidades antes de ofrecer otro medio. Mantener el estado del área en `ops-module-worldlord-v1` de la cuenta.

## UPGRADERS propios

Leer [Debugger y Learner](../operativo-orquestador/references/upgraders.md) y aplicar ambos dentro de este módulo, con estado aislado por cuenta, mundo e ID de módulo.

- **Debugger:** comprobar progreso, repeticiones, oscilaciones y límite de pasos antes de repetir una operación. Ante resultado desconocido, conciliar antes de reintentar.
- **Learner:** investigar primero datos y procedimientos mediante el ciclo de aprendizaje. Preguntar únicamente si falta una preferencia o criterio del usuario; deduplicar y conservar esas respuestas.

Conservar las decisiones de aprendizaje y los errores en el registro propio; comunicar a ORQUESTRADOR solo sus resultados y bloqueos.

## Aprendizaje continuo

Aplicar [el ciclo de aprendizaje](../learning-engine/SKILL.md) y el perfil `operativo-worldlord` de [perfiles](../learning-engine/references/profiles.json). Investigar cobertura y antigüedad de cada capa de mapa; identidad de ciudades, jugadores y alianzas; deduplicación y cambios entre observaciones. Medir coverage_fraction, stale_city_records, identity_collisions.

Comprobar: una isla sin fichas no está vacía; un cambio de nombre conserva ID; servidores y fuentes separados; solo datos del juego, no perfiles personales inferidos. Guardar evidencia y resultados en notas privadas con revisión; usar solo reglas activas cuyo alcance y vigencia pasen el evaluador. Compartir cambios de mecánica por ORQUESTRADOR sin transferir preferencias de cuenta.
