---
name: operativo-arbitraje
description: "Resuelve conflictos entre propuestas operativas de Ikariam y selecciona un plan compatible con recursos, barcos y colas; usar antes de comprometer acciones de varios módulos."
---

# Arbitraje del imperio

Leer `snapshot`, `proposal` y `decision` en [contratos](../operativo-orquestador/references/contratos.schema.json), y [persistencia](../operativo-orquestador/references/persistencia.md). Reunir propuestas referidas al mismo corte.

1. Excluir acciones con datos críticos ausentes, presupuesto incierto, dependencias imposibles o costes no confirmados. Mantenerlas como rechazadas o bloqueadas con motivo concreto.
2. Ordenar por urgencia de continuidad, objetivo elegido, beneficio esperado en el horizonte, coste de oportunidad y riesgo. Conservar una alternativa de esperar cuando falten datos. No sumar puntuaciones de dominios sin una escala común explicada.
3. Aplicar los presupuestos comunes de materiales, oro, barcos, ciudadanos y colas. Restar reservas activas y mínimos de seguridad una sola vez. No usar una llegada futura como stock actual.
4. Seleccionar acciones conjuntamente y comprobar la suma de todos sus compromisos. Usar `check_plan` del [núcleo local](../operativo-orquestador/scripts/operational_kernel.py) cuando sea posible; un plan que excede presupuesto queda bloqueado.
5. Ordenar las dependencias antes que sus acciones dependientes. Reservar colas y barcos de forma conservadora durante todo el ciclo; para reutilizarlos después de un retorno o una obra, exigir un nuevo corte confirmado o una futura extensión de reservas por intervalos.
6. Releer `get_account` y las revisiones que sustentan el plan. Si cambiaron, regenerar snapshot y arbitraje. Guardar la decisión propuesta sin compromiso; al iniciar su ejecución autorizada, registrar los compromisos en `ops-state-v1` mediante comparación de revisión.

Producir `decision` con acciones seleccionadas, alternativas descartadas y motivo, caducidad y revisiones base. La selección estratégica no implica envío al juego. Una propuesta guardada no reserva recursos; una reserva aceptada queda en el registro central. Un conflicto al reservar obliga a recalcular antes de emitir instrucciones de ejecución.

## UPGRADERS propios

Aplicar [Debugger y Learner](../operativo-orquestador/references/upgraders.md) dentro de `operativo-arbitraje`, con estado por cuenta y mundo. Comprobar repetición y progreso antes de reintentar; conciliar resultados inciertos. Ante un error relevante, formular la pregunta correctora al usuario una sola vez y conservar el caso pendiente hasta su respuesta. No modificar los controles ni aprendizajes de otra área.

## Aprendizaje continuo

Aplicar [el ciclo de aprendizaje](../learning-engine/SKILL.md) y el perfil `operativo-arbitraje` de [perfiles](../learning-engine/references/profiles.json). Investigar conflictos de presupuesto; dependencias y restricciones. Medir rejected_budget_conflicts, invalid_dependencies.

Comprobar: no consumir dos veces un recurso; validar revisión y vigencia; todas las acciones conservan trazabilidad. Guardar evidencia y resultados en notas privadas con revisión; usar solo reglas activas cuyo alcance y vigencia pasen el evaluador. Compartir cambios de mecánica por ORQUESTRADOR sin transferir preferencias de cuenta.
