---
name: operativo-ejecucion
description: "Prepara la ejecución y registra el despacho de acciones operativas de Ikariam; usar al aplicar un plan seleccionado y comprobar qué conectores existen."
---

# Ejecución operativa

Consultar [adaptadores y capacidades](../operativo-orquestador/references/modulos.json) y [persistencia](../operativo-orquestador/references/persistencia.md). Recibir una `decision` vigente y comprobar cuenta, mundo, revisiones, reservas y dependencias.

El adaptador actual es manual: entregar instrucciones concretas al jugador y registrar sus confirmaciones. Las herramientas `save_*` guardan información; no construyen, transportan ni reclutan en Gameforge. La interfaz de un adaptador de juego futuro queda definida en la arquitectura y su estado inicial es `planned`.

1. Mantener el alcance ya autorizado por el usuario. Diferenciar propuesta estratégica y orden de ejecutar. Si la gestión solicitada ya autoriza el paso concreto, continuar sin una nueva confirmación de trámite.
2. Revalidar frescura y precondiciones justo antes de emitir una acción. Registrar primero sus compromisos con revisión en el estado central. Antes de un despacho externo, guardar además la intención de envío y su clave como `dispatch_pending`; un cierre entre envío y respuesta obliga a conciliar esa intención. Entregar solo acciones listas; una dependencia exige evidencia de cumplimiento.
3. Usar la clave de idempotencia estable de la acción. Ante reintento, consultar diario y recibos: una petición ya emitida con resultado incierto requiere conciliación, no repetición automática.
4. En modo manual, presentar ciudad, acción, parámetros, coste, condición de inicio y criterio de finalización. Mantenerla como propuesta o pendiente hasta que el jugador confirme su inicio.
5. Emitir `receipt` de tipo `issued` solo con evidencia de inicio. Usar `unknown` si se desconoce el resultado y `failed` para un fallo comprobado. Un tiempo estimado vencido no permite marcar `confirmed`.
6. Entregar los recibos al seguimiento. No liberar compromisos por silencio ni por un error de red. Los fallos parciales se concilian por acción.

Para conectar un ejecutor futuro, implementar preflight, dispatch y reconcile con capacidades declaradas, autenticación por usuario y deduplicación. Habilitarlo solo cuando exista una integración disponible, autorizada y probada. Un descriptor no concede acceso al juego.

## UPGRADERS propios

Aplicar [Debugger y Learner](../operativo-orquestador/references/upgraders.md) dentro de `operativo-ejecucion`, con estado por cuenta y mundo. Comprobar repetición y progreso antes de reintentar; conciliar resultados inciertos. Ante un error relevante, formular la pregunta correctora al usuario una sola vez y conservar el caso pendiente hasta su respuesta. No modificar los controles ni aprendizajes de otra área.

## Aprendizaje continuo

Aplicar [el ciclo de aprendizaje](../learning-engine/SKILL.md) y el perfil `operativo-ejecucion` de [perfiles](../learning-engine/references/profiles.json). Investigar idempotencia y recibos; clasificación de fallo recuperable e incierto. Medir duplicate_dispatches, unknown_outcomes.

Comprobar: conciliar antes de reintentar un resultado incierto; aprendizaje no amplía permisos; solo adaptadores disponibles. Guardar evidencia y resultados en notas privadas con revisión; usar solo reglas activas cuyo alcance y vigencia pasen el evaluador. Compartir cambios de mecánica por ORQUESTRADOR sin transferir preferencias de cuenta.
