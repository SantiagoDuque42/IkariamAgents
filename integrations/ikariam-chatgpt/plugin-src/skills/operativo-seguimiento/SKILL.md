---
name: operativo-seguimiento
description: "Concilia acciones operativas de Ikariam con sus resultados y actualiza el diario; usar al confirmar construcciones, envíos, reclutamientos o cambios tras un plan."
---

# Seguimiento y conciliación

Leer los contratos `receipt` y `cycle` en [contratos comunes](../operativo-orquestador/references/contratos.schema.json) y el protocolo de [persistencia](../operativo-orquestador/references/persistencia.md).

1. Comparar recibos y nueva evidencia con la decisión y el snapshot de origen. Verificar cuenta, mundo, ciudad y acción. Usar `get_account` y `get_history` para distinguir cambios confirmados y estimaciones.
2. Registrar inicio y finalización por separado. `confirmed` exige evidencia de resultado: captura, observación inequívoca o confirmación explícita del usuario con fecha. El paso del tiempo no la sustituye.
3. Actualizar inventarios por `operativo-estado` y registros mediante `account-ledger`. No descontar dos veces los gastos: el inventario nuevo ya refleja la acción; la reserva solo cubre lo aún no reflejado en ese inventario.
4. Liberar cada compromiso únicamente cuando una observación lo sustituya o una cancelación confirmada demuestre que ya no está retenido. Una obra iniciada libera materiales reflejados en stock, pero conserva su cola ocupada; un envío conserva barcos hasta confirmar disponibilidad y carga en tránsito hasta confirmar llegada.
5. Medir resultado frente a efecto esperado cuando sean comparables, conservando supuestos y fuentes. Registrar discrepancias de costes o tiempos sin reescribir datos históricos ni convertirlas en reglas universales.
6. Reabrir deliberación por nuevo dato material, objetivo cambiado, caducidad o fallo relevante. Ante resultado incierto, conciliar antes de repetir. Un fallo en un módulo no invalida evidencia independiente de otros módulos.

Guardar un ciclo `reconciled`, `partial`, `blocked` o `failed` según la evidencia. Resumir qué quedó confirmado, qué sigue pendiente y qué dato dispara la siguiente revisión. Un intervalo de revisión es configuración del plan; los avisos periódicos necesitan una tarea programada expresamente y una fuente accesible.

## UPGRADERS propios

Aplicar [Debugger y Learner](../operativo-orquestador/references/upgraders.md) dentro de `operativo-seguimiento`, con estado por cuenta y mundo. Comprobar repetición y progreso antes de reintentar; conciliar resultados inciertos. Ante un error relevante, formular la pregunta correctora al usuario una sola vez y conservar el caso pendiente hasta su respuesta. No modificar los controles ni aprendizajes de otra área.

## Aprendizaje continuo

Aplicar [el ciclo de aprendizaje](../learning-engine/SKILL.md) y el perfil `operativo-seguimiento` de [perfiles](../learning-engine/references/profiles.json). Investigar residuos por horizonte; condiciones de replanteo; diferencia entre cambio previsto e inesperado. Medir prediction_error, unreconciled_actions.

Comprobar: comparar mismo instante y unidad; no generar observaciones desde proyecciones; alimentar el módulo causal. Guardar evidencia y resultados en notas privadas con revisión; usar solo reglas activas cuyo alcance y vigencia pasen el evaluador. Compartir cambios de mecánica por ORQUESTRADOR sin transferir preferencias de cuenta.
