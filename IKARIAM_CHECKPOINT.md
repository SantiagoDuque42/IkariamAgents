# Checkpoint Ikariam · hayanman · 24/11/2026

Copia del progreso del plugin Ikariam v1.4.0 y del cuartel de mando. Esta rama conserva el checkpoint como archivos ZIP y Git bundle. La escritura por la integración de GitHub devolvió `403 Resource not accessible by integration`; la rama y esta subida se hicieron con la interfaz web de la cuenta `hayanman`.

## Contenido recuperado

- Interfaz del cuartel de mando: mapa, ciudades, otros jugadores, inventario y planificador.
- Simulador terrestre y naval, catálogo de unidades y ejemplos documentados.
- Registro de cuentas, revisiones, historial y cálculos deterministas.
- Plugin y 23 habilidades: ORQUESTRADOR, SPY, DIPLOMAT, GENERAL, INVESTIGATOR, SHIPPER, WORLDLORD y MAYOR; etapas de recolección, estado, deliberación, arbitraje, ejecución y seguimiento.
- Contratos versionados, núcleo Python de validación de presupuestos, Debugger y Learner por módulo.
- Base de conocimiento con 20 módulos y 51 referencias.
- Pruebas y configuración de la aplicación.

Los archivos nuevos del código se encuentran en `integrations/ikariam-chatgpt/` dentro del ZIP y del bundle. Conservan su configuración propia; todavía no existe un adaptador entre estos contratos y los del Strategist/Basileus del proyecto principal.

## Archivos

- `IkariamAgents_Source_2026-11-24.zip`: árbol completo del código, incluida la base de Santi y el checkpoint del plugin.
- `IkariamAgents_hayanman_2026-11-24.bundle`: historial Git autocontenido, con la rama de código y el commit `58df1d38b8c5478393a8e40008ed4004808df280`.

El repositorio es público. Los tres archivos de datos Atlas contienen ejemplos ficticios o vacíos. Los inventarios reales, jugadores del servidor, memoria personal y enlaces privados permanecen en el sistema original; no se incluyen aquí.

## Recuperar el código como archivos normales

Descargar el bundle y, desde un clon de este repositorio situado en esta rama, ejecutar:

```sh
git bundle verify /ruta/IkariamAgents_hayanman_2026-11-24.bundle
git fetch /ruta/IkariamAgents_hayanman_2026-11-24.bundle refs/heads/hayanman/ikariam-plugin-progress-2026-11-24:refs/remotes/checkpoint/ikariam-plugin
git merge --no-ff refs/remotes/checkpoint/ikariam-plugin
```

El merge incorpora el código extraído y conserva estos archivos de respaldo. Publicarlo con un push normal a esta rama cuando la conexión Git permita escribir. No se necesita sobrescribir historial ni modificar `main`.

## Validación

62 pruebas superadas: 11 del repositorio de Santi, 20 del motor/servicio/combate/planificador del cuartel y 31 de contratos y módulos Python. También se validaron los cuatro fixtures JSON del repositorio base y el bundle Git. No se ejecutó una compilación completa de la interfaz ni una prueba en el juego; este checkpoint no despliega la aplicación.

Origen de la aplicación: `f3d4e7879475052382e48fa3f412ced45b481d46`.
Versión del plugin: `1.4.0`, release `pluginrel_6b05d243263081918546c091db456855`.
Base de Santi: `9ab1727218547ca2e906bc7f2ca010badcdeeb6e`.

## Integridad SHA-256

| Archivo | SHA-256 |
|---|---|
| `IkariamAgents_Source_2026-11-24.zip` | `88eecc92abf0471791819eeb78c2967d6b0b344c193e1606e03a120f5a049a59` |
| `IkariamAgents_hayanman_2026-11-24.bundle` | `0623c1d3d9ec96b040cfe576dffe758ca7c0576df9bc1f96575cd7f823a7985f` |
