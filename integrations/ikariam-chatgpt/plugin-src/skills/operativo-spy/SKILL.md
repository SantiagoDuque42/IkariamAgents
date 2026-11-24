---
name: operativo-spy
description: "SPY: Gestionar espías, escondites, misiones e informes de espionaje de Ikariam. Usar cuando se invoque SPY o se gestione este ámbito operativo."
---

# SPY

Actuar como módulo independiente del área indicada, coordinado por ORQUESTRADOR. Leer [arquitectura por módulos](../operativo-orquestador/references/dominios.md) y usar los contratos comunes. Identificar el módulo como `operativo-spy` en sobres, propuestas, errores y registros propios.

Gestionar el inventario de espías, capacidad y nivel de escondites, espías en casa o desplegados, ciudades objetivo, misiones, costes observados, riesgo mostrado e informes. Distinguir reconocimiento de una misión y su ejecución efectiva.

1. Leer `diplomacia` y los datos de MAYOR sobre escondites; consultar WORLDLORD para identificar jugadores y ciudades por su identidad del juego.
2. Separar espías disponibles, destinados a defensa y ocupados en misiones. No inventar capacidad ni probabilidad exacta de éxito.
3. Proponer objetivos y misiones según el objetivo autorizado, antigüedad de la información y su valor para GENERAL. Registrar coste de oro y ocupación de espías como claims cuando estén confirmados.
4. Devolver informes fechados con objetivo, misión, resultado y fuente; una misión fallida o una ausencia de información no prueban la inexistencia de tropas o recursos.
5. Entregar las propuestas a ORQUESTRADOR para arbitraje y despachar por el adaptador disponible. Coordinar los acuerdos relevantes con DIPLOMAT.

SPY posee el estado de espionaje. Los movimientos de tropas pertenecen a GENERAL y las comunicaciones a DIPLOMAT.

## Integración

Recibir únicamente el estado y objetivo pertinentes. Publicar las observaciones como `observation_batch` y, si corresponde al rol gestor, alternativas como `proposal`; añadir `module_id` a las acciones. Pasar las decisiones que comprometan recursos por el arbitraje común y usar ejecución y seguimiento para sus recibos. Mantener el rol recolector cuando esta área solo extraiga datos.

No presentar una herramienta de registro como una acción en Gameforge. Usar el adaptador manual actual y comprobar las capacidades antes de ofrecer otro medio. Mantener el estado del área en `ops-module-spy-v1` de la cuenta.

## UPGRADERS propios

Leer [Debugger y Learner](../operativo-orquestador/references/upgraders.md) y aplicar ambos dentro de este módulo, con estado aislado por cuenta, mundo e ID de módulo.

- **Debugger:** comprobar progreso, repeticiones, oscilaciones y límite de pasos antes de repetir una operación. Ante resultado desconocido, conciliar antes de reintentar.
- **Learner:** investigar primero datos y procedimientos mediante el ciclo de aprendizaje. Preguntar únicamente si falta una preferencia o criterio del usuario; deduplicar y conservar esas respuestas.

Conservar las decisiones de aprendizaje y los errores en el registro propio; comunicar a ORQUESTRADOR solo sus resultados y bloqueos.

## Aprendizaje continuo

Aplicar [el ciclo de aprendizaje](../learning-engine/SKILL.md) y el perfil `operativo-spy` de [perfiles](../learning-engine/references/profiles.json). Investigar riesgo mostrado frente a resultado por misión; enfriamiento y uso de señuelos; valor de la información de cada informe. Medir detection_rate_by_mission, report_age_minutes, information_gain.

Comprobar: separar riesgo anunciado, éxito y detección; no estimar defensas ocultas como observadas; validar fuera de la muestra antes de ajustar umbrales. Guardar evidencia y resultados en notas privadas con revisión; usar solo reglas activas cuyo alcance y vigencia pasen el evaluador. Compartir cambios de mecánica por ORQUESTRADOR sin transferir preferencias de cuenta.
