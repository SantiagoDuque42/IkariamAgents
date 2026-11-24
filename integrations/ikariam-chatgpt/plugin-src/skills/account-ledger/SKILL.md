---
name: account-ledger
description: "Registra o actualiza una cuenta de Ikariam, interpreta capturas y conserva ciudades, recursos, ejércitos, flotas, notas y planes con fecha e historial."
---

# Registro de cuenta

Usa `list_accounts` para resolver comunidad y mundo, después `get_account`. No mezcles dos mundos aunque compartan alias. `save_account` crea o modifica la ficha; `save_city` conserva ciudades; `save_entry` sirve para task, note, plan, research, army, fleet, trade y report.

Para crear, usa expected_revision=0. Para modificar, usa la revisión de la última lectura y aporta solo los campos cambiados. No envíes un objeto completo reconstruido de memoria. Las estructuras de edificios y recursos se funden parcialmente. Un cambio no borra campos ausentes.

Una captura es observación con fecha. Extrae números, unidades y coordenadas de forma explícita; conserva ambigüedades. Para datos numéricos de cuenta aporta observed_at. Cada ciudad exige observed_at y guarda fechas por campo: actualizar el nombre no vuelve recientes sus inventarios. El plugin rechaza sustituir un campo por una observación anterior; conserva esa información como informe histórico.

Guarda ejército, investigación, flota e informes en entradas con título claro, cuerpo legible, observed_at y fuente. No expongas contraseñas, cookies ni tokens. Las capturas no necesitan contener información de acceso.

Estados: proposed para propuestas, pending para compromisos aceptados, in_progress para ejecución confirmada, done para finalización confirmada, cancelled si se cancela. No deduzcas done porque un temporizador ya tendría que haber terminado.

Usa `get_history` para cambios anteriores. Ante conflicto de revisión, lee de nuevo y reconcilia antes de guardar. Confirma solo lo que la herramienta haya persistido; diferencia el registro de una operación en el juego.

## Inventario y Excel de la cuenta

Identifica cada ciudad por su ID del juego si aparece en la captura, además de nombre, mundo e isla. Para Atlas (España) el inventario inicial usa el ID como cadena. Distingue copias de un mismo edificio con claves estables. En las capturas iniciales, `deposito_1` a `deposito_4` corresponden a norte, centro junto al canal, este y sureste. `puerto_comercial_1` y `puerto_comercial_2` corresponden a costa oeste y este. Si cambia la vista, concilia la posición y el historial antes de asignar una clave nueva. Una ausencia de etiqueta queda como dato no observado. Registra por separado los cronómetros visibles y el nivel rotulado. Un cronómetro vencido por sí solo no confirma una mejora terminada.

Cada fila del inventario identifica ciudad, edificio, copia, nivel, posición si procede, fecha, hora y archivo de origen. Usa el nombre que figura en la interfaz española. Transcribe los dos números del indicador de ciudadanos con sus paréntesis si falta una vista que explique esas cifras. Guarda como medidas las tasas, la capacidad y la población solo cuando estén identificadas.

La nota `inventario-excel` de `get_account` contiene el enlace al Excel interno, su identificador estable y la cobertura. Usa la ficha para el estado registrado y el Excel para comparar y exportar la observación fechada. Al actualizar el Excel por petición del usuario, usa esa misma identidad, conserva el historial de versiones y verifica que los niveles y totales coinciden con las observaciones recogidas. Leer una ficha nueva no modifica automáticamente un archivo ya guardado.

## Aprendizaje continuo

Aplicar [el ciclo de aprendizaje](../learning-engine/SKILL.md) y el perfil `account-ledger` de [perfiles](../learning-engine/references/profiles.json). Investigar revisiones, procedencia y consistencia; conflictos de escritura. Medir revision_conflicts, cross_account_leaks.

Comprobar: no escribir con revisión antigua; cuentas aisladas; no guardar secretos. Guardar evidencia y resultados en notas privadas con revisión; usar solo reglas activas cuyo alcance y vigencia pasen el evaluador. Compartir cambios de mecánica por ORQUESTRADOR sin transferir preferencias de cuenta.
