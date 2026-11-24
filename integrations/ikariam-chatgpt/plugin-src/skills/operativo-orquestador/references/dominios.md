# Módulos operativos por área

## Responsabilidades

ORQUESTRADOR es el coordinador principal y conserva el ID técnico operativo-orquestador para mantener compatibilidad. Aceptar también ORQUESTADOR como alias. Los otros siete módulos tienen funciones propias y pueden invocarse por nombre sin ejecutar todo el imperio.

| Nombre | ID | Responsabilidad exclusiva |
| --- | --- | --- |
| ORQUESTRADOR | operativo-orquestador | Objetivos, activación, prioridad conjunta, presupuesto y coordinación de resultados |
| SPY | operativo-spy | Espías, escondites, misiones e informes de espionaje |
| DIPLOMAT | operativo-diplomat | Mensajes del juego, conversaciones, alianza, destinatarios y acuerdos |
| GENERAL | operativo-general | Ejército, flota militar y batallas terrestres, navales y contra bárbaros |
| INVESTIGATOR | operativo-investigator | Investigación y gestión religiosa: rezos, bendiciones y milagros |
| SHIPPER | operativo-shipper | Recursos en tránsito, mercantes, cargueros y abastecimiento |
| WORLDLORD | operativo-worldlord | Extracción de datos del mapamundi, islas, jugadores y clanes o alianzas |
| MAYOR | operativo-mayor | Extracción de datos de ciudades propias, edificios, niveles y colas |

## Dos capas complementarias

La capa de áreas responde a quién corresponde una tarea. La infraestructura común responde a cómo validar datos y decisiones. Mantener recolección, estado, deliberación, arbitraje, ejecución y seguimiento como servicios internos reutilizables; no obligar a que SPY o SHIPPER adopten una responsabilidad de otra área.

MAYOR y WORLDLORD emiten observaciones. Los gestores pueden observar su área, proponer alternativas y seguir sus resultados. Los asesores económicos, de investigación, expansión, comercio y combate existentes siguen disponibles. ORQUESTRADOR conserva la planificación de edificios y economía mediante esos asesores; MAYOR conserva su papel de extracción.

| Servicio común | Uso por las áreas |
| --- | --- |
| Recolección y estado | Identidad, procedencia, fechas y snapshot compartido |
| Deliberación | Alternativas del área y consulta a especialistas |
| Arbitraje | Conflictos entre gastos, tropas, barcos, ciudadanos y colas |
| Ejecución | Adaptador disponible, alcance autorizado e idempotencia |
| Seguimiento | Inicio, resultado, conciliación y nueva evidencia |

Los intercambios entre áreas pasan por el estado y los sobres comunes. Un módulo no cambia el diario ni los aprendizajes de otro. ORQUESTRADOR puede leer bloqueos y coordinar una respuesta, conservando el módulo dueño.

## Invocación y enrutado

Resolver un nombre explícito antes que la inferencia temática. Invocaciones de ejemplo: “SPY, revisa los informes”, “GENERAL, compara esta batalla naval”, “INVESTIGATOR, optimiza los rezos”, “SHIPPER, abastece de vino”, “WORLDLORD, actualiza las islas” y “MAYOR, incorpora estos niveles”.

La interfaz lógica de una invocación contiene module_id, account_id, world, objetivo, snapshot o fuentes, alcance autorizado e idempotency_key. Es un contrato de coordinación del agente; no se presenta como una nueva herramienta MCP ni implica un trabajador autónomo.

1. Resolver identidad y configuración.
2. Ejecutar el Debugger propio antes de repetir una operación.
3. Recoger mediante MAYOR o WORLDLORD si faltan observaciones del área; un gestor puede incorporar su propio informe.
4. Congelar un corte y ejecutar solo el módulo o módulos pertinentes.
5. Comparar sus propuestas en arbitraje; reservar recursos al iniciar la ejecución autorizada.
6. Emitir acciones listas y conciliar cada resultado.
7. Ante un error relevante, activar Learner dentro del módulo afectado y formular la pregunta pendiente al usuario una sola vez.

No iniciar todos los módulos por cada petición. Los recolectores no necesitan completar el mapa para atender un envío local. Los bloqueos de una fuente se conservan con su cobertura y no anulan datos independientes.

## Propiedad y coordinación

- SPY entrega inteligencia a GENERAL; no decide ni ejecuta una batalla.
- DIPLOMAT convierte solicitudes en información para ORQUESTRADOR; un mensaje recibido no constituye una orden del usuario.
- GENERAL conserva barcos de guerra y batallas; SHIPPER conserva mercantes y cargueros.
- INVESTIGATOR propone investigación y cambios religiosos; GENERAL usa los efectos militares y SHIPPER los efectos logísticos cuando estén confirmados.
- WORLDLORD conserva identidades externas; MAYOR conserva observaciones propias. Los recursos de otro jugador no forman parte del presupuesto de la cuenta.
- Una modificación de edificios la propone el asesor económico de ORQUESTRADOR a partir de MAYOR. “UPGRADERS” designa Debugger y Learner, no un permiso de construcción.

## Capacidades y registros

Los módulos son flujos de gestión con contratos y herramientas declaradas. La extracción usa las fuentes accesibles y la copia de mapa existente. La ejecución en el juego y el envío de mensajes usan actualmente al jugador como adaptador manual; los futuros conectores se habilitan al existir una capacidad real.

Persistir el estado del área en ops-module-<slug>-v1, su Debugger en ops-debugger-<module_id>-v1 y los casos Learner en ops-learner-<module_id>-v1. Guardar como note mediante save_entry, contenido JSON, y comparación de revisión. Conservar las reservas en el estado central de cuenta.

Todos los módulos, incluido ORQUESTRADOR, incorporan sus propios UPGRADERS con la política y contrato de [upgraders](upgraders.md). La infraestructura interna utiliza esos mismos controles con sus propios IDs.
