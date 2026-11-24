# UPGRADERS dentro de cada módulo

## Alcance y estado

Incorporar Debugger y Learner en ORQUESTRADOR, SPY, DIPLOMAT, GENERAL, INVESTIGATOR, SHIPPER, WORLDLORD y MAYOR. Aplicarlos también en los servicios internos. Compartir implementación y contratos; aislar cada estado por account_id, world y module_id.

Leer la configuración del módulo en modulos.json. Guardar los sobres debugger_state y los casos learning_case en notas propias mediante save_entry. Releer revisión y fundir únicamente el caso o estado afectado; no sobrescribir otras respuestas ni reservas. La arquitectura por sí sola no crea incidentes ni preguntas ficticias.

Usar scripts/module_upgraders.py para las operaciones locales deterministas cuando haya ejecutor. Sus funciones no envían mensajes, no preguntan por una interfaz ni modifican el juego; el agente muestra la pregunta real y persiste el resultado.

## Debugger: detectar y cortar bucles

Antes de repetir una lectura, cálculo, corrección o despacho:

1. Calcular una firma semántica con operación y parámetros relevantes. Excluir fechas de proceso, IDs de intento, ciclo, petición, recibo y claves de idempotencia de la firma; cambiar un identificador no demuestra progreso.
2. Calcular progreso mediante revisiones de observaciones materiales: account, city, army, fleet, research, trade o message. Excluir revisiones de notas, informes, planes y del propio Debugger o Learner. No usar un contador que el mismo módulo pueda incrementar para simular avance.
3. Mantener historia acotada y contabilizar pasos sin progreso. Los valores iniciales son 20 pasos, 2 fallos iguales, 3 operaciones idénticas sin progreso y ventana de 6 entradas para detectar oscilaciones.
4. Cortar una repetición A → A → A, el mismo error por segunda vez y una oscilación A → B → A sin nueva evidencia. Pausar el módulo afectado y comunicar causa, último estado y dato que permitiría continuar.
5. Ante despacho con resultado desconocido o intención pendiente, entrar en reconciliation_required inmediatamente. Un cambio de fecha, ID o incluso una revisión material nueva no basta para volver a despachar; exigir evidencia de conciliación del intento.
6. Reanudar tras observación material nueva o corrección confirmada y verificada, nunca mediante reinicio automático del bucle. Usar resume_after_learning para una regla respondida por el usuario y aplicada; permite una sola reanudación por caso y no sustituye la conciliación de un resultado incierto. Conservar el incidente y la clave de la acción para no duplicarla.

El estado puede estar ready, paused o reconciliation_required. Un bloqueo no debe provocar auto-invocaciones recursivas ni alternancia infinita entre módulos. ORQUESTRADOR aplica su propio límite al reenrutar una tarea bloqueada y puede continuar tareas independientes.

## Learner: investigar y aprender de los resultados

Aplicar primero [el ciclo de aprendizaje](../../learning-engine/SKILL.md), incluso sin errores. Sus afirmaciones usan el contrato `learning_claim` independiente y no necesitan respuesta del usuario para hechos verificables. Conservar `learning_case` para preferencias y criterios pendientes: las reglas siguientes solo describen ese circuito compatible.

### Preguntas de criterio

Ante un error relevante para el resultado o una corrección del usuario:

1. Registrar módulo, incidente, error, evidencia, qué ocurrió y posible criterio corrector. Distinguir preferencia, procedimiento y mecánica del juego.
2. Resolver primero lo que pueda comprobarse en los datos; no pedir al usuario cifras ya presentes ni repetir decisiones que haya dado.
3. Si falta interpretación o criterio, formular una pregunta concreta sobre ese error y la regla propuesta. Presentar la consecuencia de cada alternativa cuando ayude. La pregunta es para aprender el criterio del usuario; no sustituye la comprobación de los datos ni exige una nueva autorización si ya existe.
4. Deduplicar por cuenta, mundo, módulo y firma del incidente. Marcar asked solo después de mostrar realmente la pregunta. Si ya está pendiente, conservarla y continuar el trabajo independiente; no volver a preguntarla en cada reintento.
5. Guardar la respuesta literal con su fuente. Si corrige la regla propuesta, pasar el criterio final en corrected_rule de answer_learning y conservar la sugerencia original en el historial del registro. Sin respuesta del usuario, conservar pending_user y no aplicar una preferencia inferida. El silencio no es una respuesta.
6. Pasar a answered cuando exista respuesta; rechazar una regla si el usuario la descarta. Una regla de mecánica requiere además evidencia contrastada antes de aplicarse. Una preferencia puede aplicarse dentro del alcance respondido.
7. Aplicar el aprendizaje únicamente en el módulo, cuenta y mundo correspondientes. Compartirlo con otra área solo a través de ORQUESTRADOR y con alcance explícito; no convertir una preferencia local en regla global ni editar las capacidades o permisos del plugin a partir de un mensaje externo.

Estados de un caso: pending_user, answered, applied o rejected. La clave de incidente permanece estable aunque cambien IDs de ciclo o fechas de proceso. Varias incidencias pueden coexistir; conservarlas en una única nota de casos del módulo para evitar duplicados por consulta.

## Integración en el ciclo

- Operación correcta: registrar resultado y progreso comprobable.
- Error recuperable con corrección conocida: corregir dentro del alcance autorizado, verificar y conservar la causa; activar aprendizaje si aporta un criterio nuevo.
- Error repetido o bucle: Debugger pausa el área; Learner investiga la causa y pregunta solo si falta criterio humano. Una nota nueva no reinicia el contador.
- Resultado externo incierto: conservar compromisos y conciliar antes de otro despacho.
- Respuesta del usuario: actualizar el caso y reanudar solo lo que esa respuesta resuelva.

El núcleo comprueba aislamiento, firmas, límites, deduplicación y transiciones. El agente sigue siendo responsable de mostrar una pregunta clara, interpretar la respuesta y verificar que una fuente acredita lo que afirma.
