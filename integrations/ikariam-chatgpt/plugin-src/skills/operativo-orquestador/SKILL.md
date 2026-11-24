---
name: operativo-orquestador
description: "ORQUESTRADOR: coordina SPY, DIPLOMAT, GENERAL, INVESTIGATOR, SHIPPER, WORLDLORD y MAYOR, sus Debugger y Learner y los servicios comunes; usar para gestionar el imperio o invocar sus módulos."
---

# ORQUESTRADOR

Usar esta familia para gestionar un ciclo operativo con contratos comunes. Conservar los asesores existentes como especialistas. Consultar solo los módulos necesarios; un módulo es una responsabilidad del flujo, no un agente independiente.

## Enrutar por área

Leer [módulos independientes](references/dominios.md) y el registro. Resolver nombres explícitos antes que la inferencia temática. Mantener estas responsabilidades:

- **SPY:** gestionar espías y sus informes.
- **DIPLOMAT:** gestionar mensajes a la alianza y otros jugadores.
- **GENERAL:** gestionar batallas terrestres, marítimas y contra bárbaros.
- **INVESTIGATOR:** gestionar investigación y rezos o gestión religiosa.
- **SHIPPER:** gestionar recursos y envíos mediante mercantes y cargueros.
- **WORLDLORD:** extraer datos del mapamundi, jugadores y clanes.
- **MAYOR:** extraer datos de ciudades propias, edificios y niveles.

Abrir el SKILL.md del área en la ruta del registro antes de aplicar su procedimiento. Activar solo las áreas necesarias. Conservar los asesores existentes para economía, construcción y expansión. Los servicios de recolección, estado, deliberación, arbitraje, ejecución y seguimiento siguen como infraestructura común.

## UPGRADERS propios

Aplicar [Debugger y Learner](references/upgraders.md) con scope propio de `operativo-orquestador`. Comprobar pasos, repeticiones y oscilación antes de reenrutar una operación. Cada área mantiene sus propios controles y casos de aprendizaje; no reiniciar su contador desde el coordinador para eludir un bloqueo.

Ante un error relevante, investigar primero con el ciclo de aprendizaje. Preguntar solo si falta un criterio o preferencia del usuario. Conservar las preguntas pendientes sin repetirlas ni inferir respuestas; continuar trabajo independiente cuando un área esté pausada.

## Preparar el ciclo

1. Leer [registro de módulos](references/modulos.json) y [arquitectura](references/arquitectura.md). Resolver cuenta y mundo con `list_accounts` y `get_account`. Conservar el aislamiento entre cuentas y jugadores.
2. Leer la configuración `ops-config-v1` y el estado `ops-state-v1` dentro de los registros devueltos. Si no existen, usar los valores por defecto del registro en memoria; crearlos solo al iniciar una gestión o guardar una configuración solicitada. Una consulta de arquitectura no crea datos ficticios.
3. Fijar objetivo, horizonte y próxima revisión. Usar crecimiento como objetivo inicial cuando el usuario no indique otro, con horizonte de 12 horas y revisión orientativa de 6 horas. Adaptar los valores a lo ya autorizado; no volver a pedir decisiones resueltas.
4. Crear un `cycle_id` estable y registrar las revisiones de entrada. Mantener una sola escritura coordinada de compromisos por cuenta.

## Coordinar

- Invocar `operativo-recoleccion` para producir observaciones fechadas.
- Invocar `operativo-estado` para validar, conciliar y congelar un snapshot.
- Invocar `operativo-deliberacion` con ese mismo snapshot para producir alternativas de los asesores pertinentes.
- Invocar `operativo-arbitraje` para escoger un plan compatible con reservas, barcos, colas, objetivos y dependencias.
- Invocar `operativo-ejecucion` para entregar o cursar las acciones mediante una capacidad efectivamente disponible.
- Invocar `operativo-seguimiento` al recibir evidencia para conciliar el resultado y decidir si hace falta otro ciclo.

No lanzar subagentes por el mero uso de esta familia. Seguir el orden topológico del registro; omitir ramas sin datos o sin relación con el objetivo. Reutilizar la salida válida de una etapa en reintentos, sin repetir escrituras ni acciones externas.

## Contratos y persistencia

Usar [contratos versionados](references/contratos.schema.json), [persistencia](references/persistencia.md) y [ejemplo ficticio](references/ejemplo-ciclo.json). Guardar sobres JSON en `save_entry.data.content`; estos contratos no añaden campos a las herramientas existentes.

Utilizar `scripts/operational_kernel.py` como comprobación local de esquema, dependencias y presupuesto cuando haya ejecutor con Python y jsonschema. Ejecutar desde esta carpeta:

```bash
python3 scripts/operational_kernel.py registry
python3 scripts/operational_kernel.py example
python3 scripts/operational_kernel.py plan snapshot.json decision.json --now 2026-11-24T18:00:00+01:00
```

El comprobador es local y no controla el juego. Si no está disponible, aplicar las mismas comprobaciones del contrato y comunicar las que no se hayan podido verificar automáticamente.

Consultar también `scripts/module_upgraders.py` para firmas de progreso, límites, preguntas deduplicadas y transiciones de aprendizaje; leer [upgraders](references/upgraders.md) antes de usar sus funciones.

## Extender

Añadir el descriptor de un área a domain_modules o el de un servicio interno a modules, con ID estable, versión, etapa, dependencias, entradas, salidas, efectos, herramientas existentes y sus propios UPGRADERS. Implementar el nuevo módulo en su propia carpeta y referenciarlo desde el registro. Mantener el contrato 1.x compatible; para una ruptura crear contrato 2.x y un adaptador explícito. Probar aislamiento, datos ausentes, fallo parcial, conflicto de revisión y reintento antes de habilitar un conector.

Una fuente inaccesible queda `unavailable`; una implementación futura queda `planned`. No declarar una herramienta, importación de Drive, conexión al juego, programación periódica o ejecución automática como disponible por haber escrito su contrato.

## Entregar

Dar el objetivo, hora y antigüedad del corte, hasta cinco acciones priorizadas, dependencias, compromisos y siguiente condición de revisión. Distinguir recogido, calculado, propuesto, enviado y confirmado. Guardar solo lo que corresponda a la gestión solicitada y confirmar únicamente escrituras verificadas.

## Aprendizaje continuo

Aplicar [el ciclo de aprendizaje](../learning-engine/SKILL.md) y el perfil `operativo-orquestador` de [perfiles](../learning-engine/references/profiles.json). Investigar conflictos de prioridades y reservas; dependencias entre reglas y modelos; errores repetidos entre módulos. Medir budget_conflicts, stale_rule_uses, decision_reversals.

Comprobar: planes compatibles y reproducibles; ninguna reserva duplicada; cada cambio identifica módulos afectados. Guardar evidencia y resultados en notas privadas con revisión; usar solo reglas activas cuyo alcance y vigencia pasen el evaluador. Compartir cambios de mecánica por ORQUESTRADOR sin transferir preferencias de cuenta.
