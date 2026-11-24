# Persistencia operativa con las herramientas existentes

Usar la cuenta autenticada y registrada. Esta arquitectura no requiere crear otra cuenta, base paralela o tabla. No registrar un ciclo ficticio de ejemplo en una cuenta real.

## Mapeo de registros

| Registro | kind | entry_id | Contenido |
| --- | --- | --- | --- |
| Configuración y registro activo | note | ops-config-v1 | Copia de configuración y módulos habilitados |
| Estado coordinador | note | ops-state-v1 | Snapshot de referencia, reservas y acciones emitidas |
| Corte de trabajo | report | ops-snapshot-<id> | Sobre snapshot |
| Propuesta | plan | ops-proposal-<id> | Sobre proposal |
| Decisión | plan | ops-decision-<id> | Sobre decision |
| Resultado de acción | report | ops-receipt-<action-id> | Último receipt e historial de revisiones |
| Diario de ciclo | report | ops-cycle-<id> | Sobre cycle |

Usar IDs ASCII estables y únicos dentro de cada kind y cuenta. Los prefijos de esta tabla son convenciones del registro, no herramientas nuevas.

Guardar JSON serializado en data.content con título legible y source. El estado exterior de save_entry solo acepta proposed, pending, in_progress, done o cancelled. No enviar estados nuevos al argumento status. Los estados del sobre se conservan dentro de content.

## Estados exteriores

| Sobre o situación | save_entry.data.status |
| --- | --- |
| Propuesta o decisión aún no aceptada para ejecución | proposed |
| Orden aceptada y reservada, sin inicio confirmado | pending |
| Inicio confirmado o ciclo esperando resultado | in_progress |
| Resultado final confirmado o ciclo conciliado | done |
| Cancelación confirmada o decisión sustituida | cancelled |
| Bloqueo, fallo o resultado desconocido | Conservar pending o in_progress y detallar causa en content |

Un recibo issued acredita inicio y permite in_progress. confirmed exige evidencia de finalización y permite done. failed o unknown no equivalen a cancelled ni done.

## Lectura y escritura

1. Resolver cuenta con list_accounts y get_account.
2. Leer la revisión del registro exacto; cero solo si no existe.
3. Crear o modificar con save_entry.expected_revision.
4. Si hay revision_conflict, releer y conciliar antes de repetir. No cambiar únicamente expected_revision en un objeto obsoleto.
5. Comprobar la respuesta saved y la revisión devuelta. Un error de herramienta no confirma persistencia.

Las revisiones base del snapshot incluyen ficha, ciudades y entradas relevantes: por ejemplo account:<account_id>, city:<city_id> y note:ops-state-v1. En una ejecución, conservar la revisión recién devuelta al actualizar el estado; no invalidar por la propia actualización administrativa. Cualquier cambio de inventario, reservas ajenas o dependencia requiere recalcular.

## Reserva central e idempotencia

Mantener en ops-state-v1:

- schema_version y cuenta/mundo.
- snapshot_id y última referencia de ciclo.
- reservations por decision_id y action_id, claims, fecha y estado.
- dispatch_intents por clave de idempotencia, con estado dispatch_pending antes de llamar a un adaptador externo.
- issued_actions por clave de idempotencia, recibo y resultado conocido.
- conciliaciones pendientes y motivos de bloqueo.

Al pasar de propuesta a ejecución:

1. Releer estado, decisiones activas e inventarios pertinentes.
2. Calcular un presupuesto que descuente todas las reservas vigentes.
3. Validar la decisión y sus dependencias.
4. Añadir reservas y marcar las acciones como pendientes en un solo cambio del estado central con expected_revision.
5. Solo después de una escritura confirmada, emitir la siguiente instrucción lista. Para un adaptador externo, registrar además una intención dispatch_pending mediante comparación de revisión antes de llamarlo; conservarla si se pierde la respuesta.
6. Guardar los recibos y conciliar el estado.

Una acción que ya figura reservada no se vuelve a reservar. Una intención dispatch_pending o una emisión registrada exige conciliación antes de volver a despachar; no asumir que el envío no ocurrió porque falte recibo. Incluir esas claves en issued_idempotency_keys del snapshot para que el comprobador las bloquee. Si el contenido cambió para la misma clave de idempotencia, bloquear y crear una nueva identidad después de conciliar.

Las herramientas no ofrecen transacción entre inventarios, planes y estado. Por ello no declarar esta arquitectura como un despachador distribuido con garantía de exactamente una ejecución. La revisión impide perder reservas concurrentes; las acciones externas requieren además revalidación e idempotencia en el adaptador.

La persistencia del estado coordinador puede quedar confirmada y el guardado de una copia de decisión fallar: conservar el estado central como autoridad del compromiso y reparar la copia en el siguiente ciclo. Si ocurre lo inverso, la propuesta guardada no demuestra una reserva.

## Conciliación de presupuesto

Un gasto reflejado en la nueva observación sustituye la reserva de ese material; no restar ambos. Conservar los compromisos aún ocupados, como colas y barcos. Mantener cantidad en tránsito aparte hasta confirmar llegada y capacidad receptora.

Ante fallo de lectura, no liberar ni duplicar reservas. Ante resultado desconocido, guardar la incertidumbre y consultar evidencia. La caducidad del plan impide nuevas emisiones; no demuestra que una acción ya emitida se haya cancelado.

No cambiar inventarios basándose en propuesta, proyección, ETA vencida o recibo issued sin cifras observadas. Una confirmación del usuario puede acreditar la acción, pero no autoriza inventar los nuevos saldos.

## Retención y continuidad

Mantener el último estado coordinador y los vínculos a decisiones activas. Evitar duplicar una nota por cada consulta. Reutilizar el mismo registro de recibo con historial para cambios de la misma acción.

El registro actual limita las lecturas de cuenta; consolidar periódicamente los ciclos antiguos en informes resumidos cuando se solicite mantenimiento y comprobar que las decisiones activas siguen recuperables. No borrar ni cancelar historia como parte de una nueva planificación.

Un error parcial deja pendiente la etapa afectada y permite reutilizar salidas independientes verificadas. Una revisión futura comienza por get_account y el estado central, no por recuerdos de la conversación.

## Áreas y UPGRADERS

Mantener estado independiente en `ops-module-<slug>-v1`, Debugger en `ops-debugger-<module_id>-v1` y casos Learner en `ops-learner-<module_id>-v1`, todos como note y con comparación de revisión. En una consulta de arquitectura no crear fichas ni incidentes ficticios.

Guardar `debugger_state` como sobre único en su nota y los sobres `learning_case` como colección de casos por ID estable en la nota Learner. Releer y conciliar antes de añadir una respuesta. Marcar asked únicamente después de mostrar la pregunta al usuario. Un caso pending_user no aplica reglas ni se cierra por tiempo transcurrido.

No utilizar las revisiones de estas notas como prueba de progreso; conservar las revisiones materiales de las observaciones. Los presupuestos y las intenciones de despacho siguen bajo la autoridad de ops-state-v1, para evitar que un módulo reserve al margen del resto.

## Afirmaciones de aprendizaje

Guardar una nota por afirmación con ID `learn-<hash>`, JSON del contrato de `learning-engine` en `data.content` y revisión recién leída. No sustituir la nota de preguntas `ops-learner-*`. Guardar resultados por módulo en `learn-review-<module_id>` con revisión. Respetar 16000 caracteres y no actualizar fechas de observación al releer. Evaluar versión, entorno, caducidad y dependencias antes de reutilizar una regla activa.
