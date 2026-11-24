---
name: operativo-mayor
description: "MAYOR: Extraer datos de las ciudades propias de Ikariam y de sus edificios con niveles, copias, colas y observaciones fechadas. Usar cuando se invoque MAYOR o se gestione este ámbito operativo."
---

# MAYOR

Actuar como módulo independiente del área indicada, coordinado por ORQUESTRADOR. Leer [arquitectura por módulos](../operativo-orquestador/references/dominios.md) y usar los contratos comunes. Identificar el módulo como `operativo-mayor` en sobres, propuestas, errores y registros propios.

Extraer el estado de las ciudades propias y sus edificios con sus niveles. Usar [account-ledger](../account-ledger/SKILL.md) para identidades, copias y fechas; obtener la cuenta con `list_accounts` y `get_account`.

1. Identificar ciudad por ID, mundo e isla; registrar nombre y condición de capital cuando estén observados.
2. Extraer edificios, copia estable, nivel, posición si ayuda a conciliarla, colas y cronómetros visibles. No confundir nivel rotulado, nivel objetivo y una obra en marcha.
3. Recoger los campos económicos visibles pertinentes: recursos, tasas, almacenamiento, población, satisfacción y corrupción. No inferir capacidades ni fórmulas exactas solo por conocer un nivel.
4. Conservar fecha y fuente por campo, cifra original y ambigüedades. Un edificio no visible no equivale a nivel cero ni a edificio demolido.
5. Incorporar registros, capturas o archivos accesibles sin simular conexión directa al juego. Para cambios entre cortes, usar `get_history`.
6. Emitir `observation_batch` y dejar que la etapa de estado concilie y persista mediante `save_city` o `save_account`. Un cronómetro vencido no confirma una mejora.

MAYOR posee la extracción de datos propios. La planificación de edificios y producción sigue en los asesores económicos coordinados por ORQUESTRADOR. Este módulo no construye ni reasigna trabajadores por su cuenta.

## Integración

Recibir únicamente el estado y objetivo pertinentes. Publicar las observaciones como `observation_batch` y, si corresponde al rol gestor, alternativas como `proposal`; añadir `module_id` a las acciones. Pasar las decisiones que comprometan recursos por el arbitraje común y usar ejecución y seguimiento para sus recibos. Mantener el rol recolector cuando esta área solo extraiga datos.

No presentar una herramienta de registro como una acción en Gameforge. Usar el adaptador manual actual y comprobar las capacidades antes de ofrecer otro medio. Mantener el estado del área en `ops-module-mayor-v1` de la cuenta.

## UPGRADERS propios

Leer [Debugger y Learner](../operativo-orquestador/references/upgraders.md) y aplicar ambos dentro de este módulo, con estado aislado por cuenta, mundo e ID de módulo.

- **Debugger:** comprobar progreso, repeticiones, oscilaciones y límite de pasos antes de repetir una operación. Ante resultado desconocido, conciliar antes de reintentar.
- **Learner:** investigar primero datos y procedimientos mediante el ciclo de aprendizaje. Preguntar únicamente si falta una preferencia o criterio del usuario; deduplicar y conservar esas respuestas.

Conservar las decisiones de aprendizaje y los errores en el registro propio; comunicar a ORQUESTRADOR solo sus resultados y bloqueos.

## Aprendizaje continuo

Aplicar [el ciclo de aprendizaje](../learning-engine/SKILL.md) y el perfil `operativo-mayor` de [perfiles](../learning-engine/references/profiles.json). Investigar costes y tiempos efectivos por edificio y nivel; población, felicidad, corrupción y producción; retorno de reductores y edificios productores; efectos locales de Chronos. Medir stock_projection_error, build_eta_error_minutes, unknown_fields.

Comprobar: no renovar una captura al releerla; nivel cero difiere de desconocido; las tasas proyectadas no son observaciones; validar costes contra ayuda de esa versión. Guardar evidencia y resultados en notas privadas con revisión; usar solo reglas activas cuyo alcance y vigencia pasen el evaluador. Compartir cambios de mecánica por ORQUESTRADOR sin transferir preferencias de cuenta.
