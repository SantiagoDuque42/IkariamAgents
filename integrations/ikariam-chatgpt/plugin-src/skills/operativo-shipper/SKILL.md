---
name: operativo-shipper
description: "SHIPPER: Gestionar recursos y envíos con barcos mercantes y cargueros de Ikariam. Usar cuando se invoque SHIPPER o se gestione este ámbito operativo."
---

# SHIPPER

Actuar como módulo independiente del área indicada, coordinado por ORQUESTRADOR. Leer [arquitectura por módulos](../operativo-orquestador/references/dominios.md) y usar los contratos comunes. Identificar el módulo como `operativo-shipper` en sobres, propuestas, errores y registros propios.

Gestionar abastecimiento, intercambios de recursos, cargas, barcos mercantes y cargueros, rutas y seguimiento de envíos. Usar [trade-logistics](../trade-logistics/SKILL.md), `logistica` y `comercio`.

1. Recoger origen y destino, reservas, consumo, capacidad libre, barcos disponibles, capacidades efectivas, carga, viaje, llegada y retorno.
2. Priorizar envíos que mantengan el abastecimiento o desbloqueen una decisión común. Calcular cantidades y oleadas con `calculate` usando cifras observadas.
3. Reservar materiales en origen y barcos en el presupuesto conjunto. Mantener carga en tránsito separada del inventario de destino y revisar capacidad receptora.
4. Coordinar bloqueos o escolta militar con GENERAL y solicitudes de intercambio con DIPLOMAT; SHIPPER no dirige batallas.
5. Mantener una identidad estable por envío. Una ruta propuesta no prueba que haya salidas automáticas; las intervenciones adicionales requieren un ejecutor disponible o actuación del jugador.
6. Conciliar salida, llegada y retorno por separado. Liberar barcos solo al confirmar disponibilidad; no recrear una carga por falta de respuesta.

SHIPPER posee el estado de logística mercante. Los inventarios observados se actualizan mediante MAYOR y la etapa común de estado, conservando la fuente por campo.

## Integración

Recibir únicamente el estado y objetivo pertinentes. Publicar las observaciones como `observation_batch` y, si corresponde al rol gestor, alternativas como `proposal`; añadir `module_id` a las acciones. Pasar las decisiones que comprometan recursos por el arbitraje común y usar ejecución y seguimiento para sus recibos. Mantener el rol recolector cuando esta área solo extraiga datos.

No presentar una herramienta de registro como una acción en Gameforge. Usar el adaptador manual actual y comprobar las capacidades antes de ofrecer otro medio. Mantener el estado del área en `ops-module-shipper-v1` de la cuenta.

## UPGRADERS propios

Leer [Debugger y Learner](../operativo-orquestador/references/upgraders.md) y aplicar ambos dentro de este módulo, con estado aislado por cuenta, mundo e ID de módulo.

- **Debugger:** comprobar progreso, repeticiones, oscilaciones y límite de pasos antes de repetir una operación. Ante resultado desconocido, conciliar antes de reintentar.
- **Learner:** investigar primero datos y procedimientos mediante el ciclo de aprendizaje. Preguntar únicamente si falta una preferencia o criterio del usuario; deduplicar y conservar esas respuestas.

Conservar las decisiones de aprendizaje y los errores en el registro propio; comunicar a ORQUESTRADOR solo sus resultados y bloqueos.

## Aprendizaje continuo

Aplicar [el ciclo de aprendizaje](../learning-engine/SKILL.md) y el perfil `operativo-shipper` de [perfiles](../learning-engine/references/profiles.json). Investigar capacidad efectiva por tipo de barco; carga, viaje y retorno por ruta; modificadores de velocidad y bloqueo; coste de oportunidad de flota ocupada. Medir arrival_eta_error_minutes, capacity_mismatches, double_booked_ships.

Comprobar: inventario en tránsito fuera del disponible; no liberar barcos por ETA sin confirmación; compartir reservas con GENERAL; no fijar límite antiguo de mercantes. Guardar evidencia y resultados en notas privadas con revisión; usar solo reglas activas cuyo alcance y vigencia pasen el evaluador. Compartir cambios de mecánica por ORQUESTRADOR sin transferir preferencias de cuenta.
