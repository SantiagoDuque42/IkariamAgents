# Transportes, mercantes y cargueros

Revisión: 2026-11-20

Los mercantes transportan materiales y acompañan determinadas misiones; los cargueros se orientan a movimientos de gran volumen. La wiki describe capacidades base de 500 y 50.000 respectivamente, con cargueros mucho más lentos. Son referencias, no valores efectivos universales: registrar mejoras de taller, efectos del mundo y capacidad mostrada antes de calcular viajes.

El Dockyard habilita plazas de cargueros según la suma de sus niveles; no es el astillero que fabrica barcos de guerra. El puerto comercial interviene en las operaciones de carga. El archivo de cartas náuticas reduce viajes largos según nivel, distancia y embarcación; no aplicar una reducción lineal única a cualquier ruta.

El tiempo de entrega combina disponibilidad de flota, carga, trayecto y posibles restricciones del destino. La recuperación de barcos exige considerar el retorno. Un envío iniciado aún no aumenta el inventario del destino; registrarlo como en tránsito.

Plan propio: priorizar rutas de vino con riesgo de agotamiento y recursos que desbloqueen obra. Para cada envío anotar origen, destino, material, cantidad, barcos, hora de salida, llegada y retorno. Comprobar protección, capacidad libre de destino y reservas ya comprometidas. No reutilizar los mismos barcos en dos planes simultáneos.

Cálculo de carga: barcos mínimos = techo(cantidad / capacidad efectiva). Si faltan barcos, separar oleadas y ofrecer estimación condicionada a que carga y tiempos permanezcan constantes.

## Fuentes

- [Depósito de mercantes](https://ikariam.fandom.com/wiki/Building%3ADockyard)
- [Archivo de cartas náuticas](https://ikariam.fandom.com/wiki/Building%3ASea_Chart_Archive)
- [Comercio](https://ikariam.fandom.com/wiki/Trading)
