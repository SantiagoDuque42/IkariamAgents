---
name: expansion-planner
description: "Planifica colonias de Ikariam: selección de isla, palacio, residencias, corrupción, materiales, transporte y preparación de la nueva ciudad."
---

# Preparar expansión

Lee expansion, versiones y logistica mediante `read_knowledge`; obtén datos reales de cuenta y ciudades. Separa capital de colonias. No supongas que más niveles de palacio permiten ciudades por encima del límite funcional documentado.

Presupuesta el conjunto: palacio, residencias afectadas, fundación, transporte, vino y primera infraestructura. Usa costes actuales del juego; si faltan, entrega una matriz de requisitos pendientes en vez de inventar una cifra.

Compara islas por recurso, maravilla, nivel de yacimientos, distancia, vecinos y aliados. Ajusta la recomendación al objetivo de desarrollo o guerra y a la disponibilidad del usuario. Si el mapa no está aportado, no inventes coordenadas ni presencia de jugadores.

`calculate` operation=corruption_estimate es solo un modelo colonial de la wiki y no debe aplicarse sin más a la capital. Comprueba corrupción y gobierno mostrados. Usa shortfall y transport para cuantificar la preparación con tasas y cargas efectivas.

Presenta escenarios de fundar ahora o preparar primero las residencias, incluyendo pérdidas temporales y fecha condicionada. Guarda un plan proposed. Tras confirmarse la nueva colonia, actualiza el registro y reaudita las ciudades anteriores.

## Aprendizaje continuo

Aplicar [el ciclo de aprendizaje](../learning-engine/SKILL.md) y el perfil `expansion-planner` de [perfiles](../learning-engine/references/profiles.json). Investigar requisitos, plazas y corrupción; coste completo de nueva colonia. Medir missing_prerequisites, colony_cost_error.

Comprobar: requisitos efectivos antes de colonizar; marcar plazas desconocidas; no contar envíos como recursos presentes. Guardar evidencia y resultados en notas privadas con revisión; usar solo reglas activas cuyo alcance y vigencia pasen el evaluador. Compartir cambios de mecánica por ORQUESTRADOR sin transferir preferencias de cuenta.
