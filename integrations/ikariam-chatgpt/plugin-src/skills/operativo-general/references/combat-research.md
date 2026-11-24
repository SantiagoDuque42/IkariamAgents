# Investigación y validación de GENERAL

Separar tres artefactos: catálogo numérico, reglas del motor e informes observados.
Los enlaces y hallazgos están en [fuentes revisadas](../../learning-engine/references/research-seeds.json).

## Catálogo

Consultar `combat_catalog`; conservar ID, arma primaria/secundaria, daño, armadura,
vida, espacio, munición, curación, moral, coste, mantenimiento y requisitos cuando
haya evidencia. Registrar procedencia por campo al cambiar un valor. Marcar
estimaciones bárbaras y datos heredados; no convertirlos en cifras comprobadas.
El manifiesto público `data/combat-catalog-review.json` identifica la revisión por
SHA-256. No mezclar cifras clásicas con mejoras posteriores a Horizontes Infinitos.

## Motor

La revisión 1.1.0 corrige la prioridad de los bombarderos terrestres y el despliegue
de flancos y sustitutos del frente. Mantiene explícitas las aproximaciones de daño,
munición agrupada, moral, curación y murallas. La fuente oficial de ayuda conserva
cifras clásicas: se emplea para estructura, no como catálogo del balance actual.

## Aprender de informes

Congelar semilla, catálogo, mejoras, forja, campo, muralla y composición inicial.
Guardar versión del servidor, entorno, mundo, fecha y origen del informe. Separar
bárbaros, tierra y mar. Incluir un conteo completo de supervivientes al final de la
misma ronda; si falta un tipo, el comparador debe rechazar el informe parcial.
Rechazar escenarios con llegadas, retiradas o cambios de milagro no modelados.

Usar `lib/icariam/combat-validation.mjs` en la aplicación y el comando local:

```sh
node scripts/review-combat.mjs /ruta/privada/informes.json
```

El archivo contiene una lista de casos `id, scenario, observed, provenance`.
`scenario` usa la entrada del simulador, sin catálogo; `observed` incluye `round`,
`remaining` para los dos bandos y, si terminó, `terminal` y `winner`.
`provenance` incluye `datasetType: real_game|synthetic`,
`partition: development|holdout`, `gameVersion`, `environment: live|pts`, `world`,
`observedAt`, `source` y `catalogSha256`.

El comparador calcula residuo por unidad, MAE y concordancia del resultado cuando
puede compararse. Un modelo que termine antes de la ronda observada genera un
caso no comparable. Guardar ese fallo. No reutilizar informes de ajuste para
validación reservada. Los tests ficticios no prueban fidelidad ante el juego.
Conservar resultados y regresiones antes de promover una modificación; no ajustar
parámetros automáticamente para forzar una victoria conocida.
