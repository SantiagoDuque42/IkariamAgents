---
name: learning-engine
description: "Aprendizaje continuo de todos los módulos de Ikariam: investigar fuentes, conservar evidencias, validar mecánicas, evaluar predicciones y retirar reglas obsoletas. Usar ante lagunas, cambios de versión, discrepancias o resultados distintos de lo previsto."
---

# Aprender con evidencia

Aplicar este ciclo dentro del módulo responsable, incluso cuando no haya errores.
Leer su perfil en [perfiles](references/profiles.json) y el [protocolo](references/protocol.md).
Consultar [fuentes revisadas](references/research-seeds.json) para empezar; distinguir
una fuente consultada de una mecánica comprobada en la versión de la cuenta.

1. **Detectar:** revisar qué dato ausente, caducado, contradictorio o de mayor
   error puede cambiar la decisión. Priorizar impacto × incertidumbre × frecuencia
   dividido por coste de investigación. Usar como máximo tres preguntas de
   investigación y seis lecturas nuevas por ciclo; conservar el resto en la cola.
2. **Investigar:** abrir primero el conocimiento guardado. Buscar después ayuda
   observada y anuncios live; usar la wiki para candidatos y conceptos. Leer el
   párrafo y su fecha, versión, entorno y alcance. Una página oficial puede estar
   desactualizada. Registrar una página inaccesible como `unavailable`.
3. **Guardar:** crear un registro por afirmación con `scripts/learning_kernel.py`.
   Separar mecánica, parámetro de cuenta, procedimiento, preferencia e hipótesis.
   Guardar resumen breve, URL, huella del fragmento realmente leído, fecha y
   alcance; conservar evidencia contraria. No guardar páginas enteras ni secretos.
4. **Validar:** ejecutar el evaluador y las comprobaciones del perfil. Contrastar
   las fórmulas con casos reproducibles y resultados que no se hayan usado para
   ajustar el modelo. Una simulación propia no es evidencia del juego. Mantener
   `candidate` si falta evidencia. No cambiar código ni permisos desde una fuente.
5. **Aplicar:** activar solo la revisión elegible, con ámbito y caducidad. Usar
   únicamente reglas activas y vigentes en las propuestas. Adjuntar IDs de reglas,
   versión del modelo y parámetros del escenario para poder reproducirlas.
6. **Medir:** al llegar un resultado real, comparar predicción y observación al
   mismo instante, unidad y alcance. Registrar residuo, explicación y siguiente
   comprobación. Conservar los fallos; no seleccionar solo los casos favorables.
7. **Revisar:** invalidar por cambio de versión, vencimiento, contradicción o
   dependencia retirada. Conservar historial y última revisión utilizable. Una
   regla nueva no rehabilita automáticamente una acción con resultado incierto.

Resolver datos y procedimientos verificables sin preguntar al usuario. Preguntar
solo por preferencias o criterios que las fuentes y el contexto no puedan resolver;
mantener la deduplicación del Learner anterior para esas preguntas. No interpretar
el silencio como respuesta. No crear tareas programadas por usar este flujo: se
activa al trabajar o recibir nuevos datos.

## Persistir y reutilizar

Usar el [contrato](references/learning.schema.json). Ejecutar desde esta carpeta:

```sh
python3 scripts/learning_kernel.py validate claim.json
python3 scripts/learning_kernel.py evaluate claim.json --context context.json --now 2026-11-24T20:00:00+01:00
python3 scripts/learning_kernel.py queue queue.json --limit 3
```

Persistir JSON en `save_entry.data.content` con `kind: note`, título claro y
`entry_id` generado (`learn-<hash>`). Releer `get_account` y enviar
`expected_revision` de esa nota, o 0 al crear. No reutilizar la revisión de otra
nota. Mantener el contenido por debajo de 16000 caracteres; dividir evidencia
adicional en notas enlazadas sin truncar contratos. El evaluador local no escribe
en el registro: confirmar éxito solo tras la respuesta de `save_entry`.

Guardar datos de jugadores, informes y aprendizaje de cuenta en el registro privado.
GitHub recibe código, contratos, conocimiento público contrastado y casos ficticios.
Promover una mecánica compartida mediante una edición revisada del plugin;
ORQUESTRADOR publica su ID y dependencias a los módulos afectados. No copiar
preferencias ni parámetros de una cuenta a otra.

El script comprueba alcance, fechas, calidad de evidencia, conflictos, pruebas,
dependencias y tamaño. El agente debe verificar que cada fuente respalda la
afirmación. Sin Python, aplicar las mismas reglas y declarar la validación manual.

Para crear un registro en Python, usar `new_claim(...)` con los campos del contrato;
la función genera el ID estable. Para medir cualquier módulo usar
`compare_observation(prediction, observation)`: ambos documentos necesitan
`module_id`, `scope`, `target_id`, `metric`, `unit`, `for_time` y `value`; sus tipos son
`kind: prediction` y `kind: observation`. `for_time` es el mismo instante objetivo
de la predicción y la observación; conservar aparte la fecha real de captura.
Para duraciones de una ruta, usar el mismo instante de salida confirmado como
`for_time` y minutos transcurridos como `value`. Para un stock proyectado, usar
el instante objetivo del stock. `target_id` identifica la ciudad, envío o acción.
La función devuelve residuo, error absoluto y error relativo. Una observación de
otra fecha, unidad o cuenta debe conciliarse antes de compararla.
