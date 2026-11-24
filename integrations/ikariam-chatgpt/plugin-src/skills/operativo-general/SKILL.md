---
name: operativo-general
description: "GENERAL: Gestionar batallas terrestres, navales y contra bárbaros, defensa, ejército y flota militar de Ikariam. Usar cuando se invoque GENERAL o se gestione este ámbito operativo."
---

# GENERAL

Actuar como módulo independiente del área indicada, coordinado por ORQUESTRADOR. Leer [arquitectura por módulos](../operativo-orquestador/references/dominios.md) y usar los contratos comunes. Identificar el módulo como `operativo-general` en sobres, propuestas, errores y registros propios.

Gestionar ejército, flota militar, defensa, combates terrestres y navales, ataques y bloqueos, refuerzos y expediciones contra bárbaros. Usar [military-adviser](../military-adviser/SKILL.md) y `ejercito`, `armada`, `pirateria`, `milagros` según el caso.

1. Separar tierra, mar y enemigo bárbaro. Identificar catálogo, nivel o composición observados, tamaño de campo, equipamiento, munición, moral, reservas y llegadas.
2. Consultar `combat_catalog` y `simulate_battle` para comparar escenarios; conservar sus limitaciones y los datos ausentes.
3. Proponer composición, secuencia, logística militar y condiciones de retirada o revisión con costes, bajas estimadas, mantenimiento y disponibilidad.
4. Coordinar inteligencia con SPY, acuerdos con DIPLOMAT, efectos religiosos con INVESTIGATOR y transporte mercante con SHIPPER. GENERAL conserva el mando del combate y de los barcos de guerra.
5. Someter las propuestas al presupuesto conjunto; no usar mercantes, oro, población o recursos que otro módulo haya comprometido.
6. Conciliar resultados mediante informes y rondas confirmados. Una simulación o ETA no demuestra victoria, retorno ni liberación de barcos.

No identificar una ciudad como bárbara o como enemiga a partir de su nombre. Conservar identidades, fuente y fecha de cada operación.

## Integración

Recibir únicamente el estado y objetivo pertinentes. Publicar las observaciones como `observation_batch` y, si corresponde al rol gestor, alternativas como `proposal`; añadir `module_id` a las acciones. Pasar las decisiones que comprometan recursos por el arbitraje común y usar ejecución y seguimiento para sus recibos. Mantener el rol recolector cuando esta área solo extraiga datos.

No presentar una herramienta de registro como una acción en Gameforge. Usar el adaptador manual actual y comprobar las capacidades antes de ofrecer otro medio. Mantener el estado del área en `ops-module-general-v1` de la cuenta.

## UPGRADERS propios

Leer [Debugger y Learner](../operativo-orquestador/references/upgraders.md) y aplicar ambos dentro de este módulo, con estado aislado por cuenta, mundo e ID de módulo.

- **Debugger:** comprobar progreso, repeticiones, oscilaciones y límite de pasos antes de repetir una operación. Ante resultado desconocido, conciliar antes de reintentar.
- **Learner:** investigar primero datos y procedimientos mediante el ciclo de aprendizaje. Preguntar únicamente si falta una preferencia o criterio del usuario; deduplicar y conservar esas respuestas.

Conservar las decisiones de aprendizaje y los errores en el registro propio; comunicar a ORQUESTRADOR solo sus resultados y bloqueos.

## Aprendizaje continuo

Aplicar [el ciclo de aprendizaje](../learning-engine/SKILL.md) y el perfil `operativo-general` de [perfiles](../learning-engine/references/profiles.json). Investigar catálogo de unidades y armas por versión; prioridades de despliegue y objetivos; daño, armadura, munición, moral, curación y murallas; calibración independiente terrestre, naval y bárbara. Medir remaining_units_mae, outcome_agreement, round_count_error, catalog_coverage.

Comprobar: catálogo con procedencia por campo; mismo escenario, ronda y mejoras para comparar; separar pruebas sintéticas de informes reales; no afirmar fidelidad sin datos reservados. Guardar evidencia y resultados en notas privadas con revisión; usar solo reglas activas cuyo alcance y vigencia pasen el evaluador. Compartir cambios de mecánica por ORQUESTRADOR sin transferir preferencias de cuenta.

Leer [investigación y validación de combate](references/combat-research.md). Consultar catálogo antes de investigar de nuevo. Conservar estadísticas por arma, mejoras, forja y versión; comparar informes por ronda con el escenario congelado. El banco de simulaciones propio solo mide estabilidad del software.
