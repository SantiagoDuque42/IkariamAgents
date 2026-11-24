---
name: operativo-estado
description: "Valida y concilia los datos operativos de Ikariam y construye un estado común fechado; usar antes de deliberar o resolver observaciones contradictorias."
---

# Estado común del imperio

Leer los contratos `observation_batch` y `snapshot` en [contratos comunes](../operativo-orquestador/references/contratos.schema.json) y el protocolo de [persistencia](../operativo-orquestador/references/persistencia.md).

1. Verificar cuenta, mundo, ciudad, fuente, unidades y fecha por campo. Rechazar lotes de otra cuenta o mundo. Conservar jugadores aliados como entidades externas, fuera de los presupuestos propios.
2. Normalizar números y nombres sin perder el valor original. Distinguir bruto/neto, recursos observados/proyectados/en tránsito y disponibles/reservados. Conservar desconocidos como ausencias; cero exige evidencia.
3. Conciliar por entidad y campo: una observación anterior no sustituye una reciente. Ante contradicción a la misma hora, mantener ambas fuentes y bloquear las decisiones dependientes hasta resolverla. Priorizar observación directa inequívoca sobre inferencias; la confianza no sustituye la fecha.
4. Incorporar observaciones confirmadas con `save_account`, `save_city` y `save_entry`, siguiendo `account-ledger`. Leer revisión antes de actualizar y enviar solo campos observados. No modificar la antigüedad de otros campos.
5. Construir un snapshot inmutable con revisiones base, datos y fechas por campo, presupuestos observados, reservas activas y mínimos operativos. Para barcos, ciudadanos y colas, usar capacidad confirmada. Omitir un presupuesto cuyo saldo o reserva no pueda determinarse. No sumar recursos en tránsito hasta confirmar su llegada.
6. Registrar qué campos están desactualizados y qué decisiones impiden. La frescura por defecto sirve para planificar; antes de cursar una acción usar la ventana de ejecución del registro y cualquier evidencia más reciente.

Entregar el mismo `snapshot_id` a todos los asesores. Mantener proyecciones y escenarios derivados en propuestas, nunca como nuevos inventarios. Si cambia una revisión material para el plan, invalidar el snapshot dependiente y pedir una nueva deliberación.

## UPGRADERS propios

Aplicar [Debugger y Learner](../operativo-orquestador/references/upgraders.md) dentro de `operativo-estado`, con estado por cuenta y mundo. Comprobar repetición y progreso antes de reintentar; conciliar resultados inciertos. Ante un error relevante, formular la pregunta correctora al usuario una sola vez y conservar el caso pendiente hasta su respuesta. No modificar los controles ni aprendizajes de otra área.

## Aprendizaje continuo

Aplicar [el ciclo de aprendizaje](../learning-engine/SKILL.md) y el perfil `operativo-estado` de [perfiles](../learning-engine/references/profiles.json). Investigar conciliación de datos parciales; unidades y normalización; antigüedad por campo. Medir stale_overwrites, normalization_conflicts.

Comprobar: no sustituir un dato por otro más antiguo; conservar cero frente a ausente; aislar cuenta y mundo. Guardar evidencia y resultados en notas privadas con revisión; usar solo reglas activas cuyo alcance y vigencia pasen el evaluador. Compartir cambios de mecánica por ORQUESTRADOR sin transferir preferencias de cuenta.
