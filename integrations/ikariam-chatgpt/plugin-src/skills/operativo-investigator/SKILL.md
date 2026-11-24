---
name: operativo-investigator
description: "INVESTIGATOR: Gestionar investigación, científicos y rezos a los dioses, bendiciones y milagros de Ikariam. Usar cuando se invoque INVESTIGATOR o se gestione este ámbito operativo."
---

# INVESTIGATOR

Actuar como módulo independiente del área indicada, coordinado por ORQUESTRADOR. Leer [arquitectura por módulos](../operativo-orquestador/references/dominios.md) y usar los contratos comunes. Identificar el módulo como `operativo-investigator` en sobres, propuestas, errores y registros propios.

Gestionar dos ámbitos explícitos: **investigación** y **rezos o gestión religiosa**. Usar [research-planner](../research-planner/SKILL.md) y `investigacion`, `dioses`, `milagros`, `versiones`.

1. Para investigación, recoger ramas, tecnologías confirmadas, prerrequisitos, puntos, científicos, academias, experimentos y taller. Comparar desbloqueos y coste de oportunidad con datos efectivos.
2. Para religión, identificar el sistema observado: santuario y bendiciones económicas, o templo, maravilla y milagro. No mezclar sus reservas, asignaciones de población, requisitos ni tiempos.
3. Registrar dios o maravilla, nivel, rezos o asignación observados, duración, disponibilidad y efectos solo cuando estén documentados para ese sistema y mundo. Si el usuario dice rezos sin identificar sistema, resolverlo con el estado o pedir el dato que cambie la decisión.
4. Proponer investigación y gestión religiosa por separado, expresando coste de oro, cristal, población y otros compromisos conocidos en el presupuesto común.
5. Coordinar efectos de combate con GENERAL y efectos de producción o transporte con los especialistas de ORQUESTRADOR y SHIPPER. No atribuir a un sistema el beneficio de otro.
6. Registrar activación, investigación terminada o cambio de asignación solo tras evidencia. Mantener los efectos temporales y su caducidad fuera de las cifras permanentes.

INVESTIGATOR posee investigación y gestión religiosa. MAYOR observa niveles de edificios; este módulo decide las propuestas de asignación e investigación que le correspondan.

## Integración

Recibir únicamente el estado y objetivo pertinentes. Publicar las observaciones como `observation_batch` y, si corresponde al rol gestor, alternativas como `proposal`; añadir `module_id` a las acciones. Pasar las decisiones que comprometan recursos por el arbitraje común y usar ejecución y seguimiento para sus recibos. Mantener el rol recolector cuando esta área solo extraiga datos.

No presentar una herramienta de registro como una acción en Gameforge. Usar el adaptador manual actual y comprobar las capacidades antes de ofrecer otro medio. Mantener el estado del área en `ops-module-investigator-v1` de la cuenta.

## UPGRADERS propios

Leer [Debugger y Learner](../operativo-orquestador/references/upgraders.md) y aplicar ambos dentro de este módulo, con estado aislado por cuenta, mundo e ID de módulo.

- **Debugger:** comprobar progreso, repeticiones, oscilaciones y límite de pasos antes de repetir una operación. Ante resultado desconocido, conciliar antes de reintentar.
- **Learner:** investigar primero datos y procedimientos mediante el ciclo de aprendizaje. Preguntar únicamente si falta una preferencia o criterio del usuario; deduplicar y conservar esas respuestas.

Conservar las decisiones de aprendizaje y los errores en el registro propio; comunicar a ORQUESTRADOR solo sus resultados y bloqueos.

## Aprendizaje continuo

Aplicar [el ciclo de aprendizaje](../learning-engine/SKILL.md) y el perfil `operativo-investigator` de [perfiles](../learning-engine/references/profiles.json). Investigar árbol y requisitos de las cinco ramas; coste de oportunidad de científicos y experimentos; santuario y bendiciones frente a templos y milagros. Medir research_eta_error_minutes, unlock_failures, bonus_mismatches.

Comprobar: no confundir progreso estimado con investigación completada; evitar doble aplicación de bonificaciones; usar tasa efectiva y versión de la cuenta. Guardar evidencia y resultados en notas privadas con revisión; usar solo reglas activas cuyo alcance y vigencia pasen el evaluador. Compartir cambios de mecánica por ORQUESTRADOR sin transferir preferencias de cuenta.
