---
name: economy-planner
description: "Audita economía de Ikariam y prioriza mejoras, vino, oro, población, capacidad, productores y reductores con cálculos de retorno."
---

# Economía del imperio

Lee el módulo economia y los módulos poblacion, recursos y edificios cuando sean relevantes. Obtén la ficha con `get_account`; ejecuta `audit_account` con horizonte relacionado con la siguiente conexión del usuario.

Revisa vino, saldo de oro, capacidad y protección, satisfacción, corrupción y empleo. Distingue total de producción de tasa neta después de consumo. Si la tasa de vino ya es neta, no vuelvas a restar la taberna. No uses observaciones de horas distintas como si fueran simultáneas.

Usa `calculate` operation=projection para cobertura o desbordamiento, shortfall para costes pendientes y payback para inversión. Declara el valor relativo de materiales distintos. Una tasa ausente impide una fecha exacta; el plugin devuelve null, no un plazo infinito inventado.

Compara alternativas que desbloqueen el cuello de botella real. Antes de ampliar un ayuntamiento revisa vino, vivienda, empleo y satisfacción. Antes de un reductor, estima ahorro sobre obras concretas. Antes de un productor, comprueba trabajadores, yacimiento y corrupción. Incluye costes de oportunidad si cambian la conclusión.

Da primero las urgencias, después una secuencia ejecutable de mejoras. Guarda el plan con `save_entry` si el usuario pide planificar o registrar. No actualices inventarios como si la propuesta ya se hubiera ejecutado.

## Aprendizaje continuo

Aplicar [el ciclo de aprendizaje](../learning-engine/SKILL.md) y el perfil `economy-planner` de [perfiles](../learning-engine/references/profiles.json). Investigar rendimiento marginal y coste de oportunidad; retorno de reductores y productores; suelo de oro y vino. Medir net_gold_error, wine_depletions, payback_error.

Comprobar: no confundir puntuación con crecimiento; proteger continuidad y capacidad; usar ahorro marginal por gasto futuro elegible. Guardar evidencia y resultados en notas privadas con revisión; usar solo reglas activas cuyo alcance y vigencia pasen el evaluador. Compartir cambios de mecánica por ORQUESTRADOR sin transferir preferencias de cuenta.
