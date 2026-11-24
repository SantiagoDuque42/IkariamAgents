---
name: operativo-deliberacion
description: "Genera alternativas operativas de Ikariam con los asesores económicos, logísticos, militares, de investigación y expansión; usar para decidir qué hacer a partir de un estado común."
---

# Deliberación operativa

Recibir propuestas de SPY, DIPLOMAT, GENERAL, INVESTIGATOR y SHIPPER según la responsabilidad declarada en el registro. Coordinar los especialistas existentes sin sustituir la identidad del módulo dueño.

Recibir un `snapshot` validado y leer el contrato `proposal` de [contratos comunes](../operativo-orquestador/references/contratos.schema.json). Resolver solo los dominios relevantes.

| Dominio | Especialista existente |
| --- | --- |
| Producción, ciudadanos, edificios y reductores | `economy-planner` |
| Barcos, vino, comercio y rutas | `trade-logistics` |
| Tecnologías, científicos y taller | `research-planner` |
| Colonias, palacio y residencias | `expansion-planner` |
| Defensa, ejército, flota y combate | `military-adviser` |
| Conocimiento o mecánica incierta | `knowledge-review` |

Consultar el archivo del especialista dentro del plugin antes de usar su procedimiento. Usar `audit_account`, `calculate`, `combat_catalog` y `simulate_battle` cuando correspondan a las alternativas. No convertir la simulación de combate en certeza.

Producir una propuesta por dominio con objetivo, alternativas, efectos esperados, costes efectivos, mantenimiento, supuestos, datos faltantes, dependencias y evidencia necesaria para confirmar cada acción. Referenciar exactamente el snapshot común. Una acción con coste desconocido sigue siendo una alternativa condicionada; no presentarla como ejecutable.

Comparar crecimiento a corto, medio y largo plazo según el horizonte y la disponibilidad del jugador. Priorizar continuidad del imperio antes de puntuación. Mostrar el coste de oportunidad si cambia el orden de acciones. No afirmar un óptimo global a partir de una heurística o información parcial.

Entregar `proposal` al arbitraje. Las alternativas no reservan materiales, barcos ni colas y no modifican el juego ni la ficha.

## UPGRADERS propios

Aplicar [Debugger y Learner](../operativo-orquestador/references/upgraders.md) dentro de `operativo-deliberacion`, con estado por cuenta y mundo. Comprobar repetición y progreso antes de reintentar; conciliar resultados inciertos. Ante un error relevante, formular la pregunta correctora al usuario una sola vez y conservar el caso pendiente hasta su respuesta. No modificar los controles ni aprendizajes de otra área.

## Aprendizaje continuo

Aplicar [el ciclo de aprendizaje](../learning-engine/SKILL.md) y el perfil `operativo-deliberacion` de [perfiles](../learning-engine/references/profiles.json). Investigar sensibilidad de prioridades a supuestos; alternativas y coste de oportunidad. Medir plan_regret, sensitivity_to_unknowns.

Comprobar: mismo snapshot para las alternativas; rango de escenarios si falta evidencia. Guardar evidencia y resultados en notas privadas con revisión; usar solo reglas activas cuyo alcance y vigencia pasen el evaluador. Compartir cambios de mecánica por ORQUESTRADOR sin transferir preferencias de cuenta.
