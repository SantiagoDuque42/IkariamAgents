# Ikariam: aprendizaje por módulo · 1.5.0

El plugin incorpora un ciclo común de investigación, evidencia, validación,
aplicación y medición. Cada área conserva su responsabilidad y sus propios datos.
La información contrastable se resuelve con fuentes; las preferencias pendientes
siguen requiriendo respuesta explícita. Las reglas se aíslan por cuenta, mundo,
versión y entorno, con caducidad, dependencias e historial de retirada.

| Área | Qué investiga y mide |
| --- | --- |
| ORQUESTRADOR | Conflictos de presupuesto, dependencias e impacto de lagunas |
| SPY | Riesgo anunciado, éxito, detección y utilidad de informes por misión |
| DIPLOMAT | Efectos de tratados, compromisos, aceptación, vigencia y tono confirmado |
| GENERAL | Estadísticas por arma, formaciones y error por unidad/ronda; tierra, mar y bárbaros |
| INVESTIGATOR | Prerrequisitos, tasas, desbloqueos, bendiciones y milagros |
| SHIPPER | Capacidad efectiva, carga, viaje, retorno y reservas compartidas |
| WORLDLORD | Cobertura, antigüedad e identidad de ciudades, jugadores y alianzas |
| MAYOR | Costes y tiempos por nivel, producción, capacidad, población y corrupción |

Los siete servicios operativos y los asesores de economía, expansión, investigación,
comercio, combate y registro también tienen perfiles y comprobaciones concretas.
El registro de perfiles cubre todas las habilidades existentes; el nuevo núcleo es
compartido y no constituye un agente independiente ni un proceso programado.

## Implementación

- `integrations/ikariam-chatgpt/plugin-src/skills/learning-engine/`: procedimiento,
  fuentes revisadas, perfiles, esquema JSON y validador ejecutable.
- `scripts/learning_kernel.py`: IDs deterministas, activación por evidencia,
  caducidad, aislamiento, contradicciones, pruebas reservadas, retirada y cola acotada.
  `compare_observation` calcula residuos por objetivo, instante y unidad.
- Persistencia mediante `save_entry`, en notas privadas, con revisión recién leída.
  Los casos antiguos de preguntas y los contratos operativos 1.x siguen compatibles.
- `lib/icariam/combat-validation.mjs`: comparación de informes completos con el
  escenario congelado; separa datos sintéticos, ajuste y validación reservada.
- `.github/workflows/validate.yml`: pruebas de extractores, contratos, servicio,
  combate y aprendizaje en las próximas subidas y solicitudes de cambio.

## Mejora de GENERAL

El motor 1.1.0 corrige los objetivos de bombarderos terrestres y las prioridades de
flancos y sustitutos del frente. Devuelve versión y supuestos explícitos. El catálogo
de 24 unidades terrestres y 21 navales tiene un manifiesto de procedencia y una huella
SHA-256; conserva las cifras heredadas como pendientes de contraste por versión.

La revisión detectó discrepancias entre la ayuda web de Gameforge y anuncios live:
por ejemplo, el límite antiguo de mercantes frente al cambio de 2025. La wiki de
Hoplite no fue accesible. Esos hallazgos se guardan con su acceso y alcance reales;
ninguno certifica por sí solo la versión actual del servidor.

Los tests sintéticos verifican el software. No se han incorporado informes privados
completos de combate para medir la fidelidad real del simulador. Moral, puntería,
curación, murallas y munición agrupada conservan sus limitaciones declaradas.
No hay ajuste automático de parámetros ni promoción de una regla por ganar un caso.

## Comprobar

Requisitos: Node 24, dependencias de la integración (`npm ci` desde su carpeta),
Python y `jsonschema` 4.26.0.

```sh
npm test
npm run test:chatgpt
```

Los comandos no necesitan conexión al juego. El registro público incluye únicamente
conocimiento público y fixtures ficticios; los datos vivos permanecen privados.
