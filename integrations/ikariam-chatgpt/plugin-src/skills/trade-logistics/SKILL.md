---
name: trade-logistics
description: "Planifica transportes, mercantes, cargueros, abastecimiento de vino y comparativas de ofertas de comercio en Ikariam."
---

# Comercio y logística

Lee logistica y comercio. Recoge inventarios, necesidades, reservas, flota disponible, capacidad efectiva, carga y viaje. Distingue Dockyard, astillero militar y puerto comercial.

Usa `calculate` operation=transport. La capacidad base histórica no sustituye la mostrada tras mejoras. El cálculo de oleadas supone una sola clase de barco y retorno constante; no promete un itinerario real si hay barcos ocupados, bloqueos, esperas o efectos temporales.

Cada oleada requiere una intervención nueva: si el usuario estará ausente, no prometas la salida de la segunda oleada durante esa ausencia. No dupliques barcos o materiales entre envíos. Conserva origen, destino, recurso, cantidad, salida, llegada y retorno en una entrada trade o plan. Un envío en marcha es material en tránsito, no stock confirmado del receptor. Comprueba capacidad libre y abastecimiento hasta la llegada.

Para ofertas compara precio observado, cantidades, oro remanente, distancia y oportunidad de usar los barcos. Revisa las reglas vigentes de la comunidad cuando las condiciones del acuerdo importen. No presentes precios de wiki como cotizaciones actuales.

Prioriza riesgo de quedarse sin vino y envíos que desbloqueen el plan. Prepara mensajes de intercambio cuando se pidan; no los envíes sin instrucción expresa y un medio disponible.

## Aprendizaje continuo

Aplicar [el ciclo de aprendizaje](../learning-engine/SKILL.md) y el perfil `trade-logistics` de [perfiles](../learning-engine/references/profiles.json). Investigar precios efectivos y comisiones; tiempo de entrega y volumen útil. Medir net_price_error, delivery_eta_error_minutes.

Comprobar: distinguir oferta de compra realizada; descontar comisiones observadas; coordinar barcos con SHIPPER. Guardar evidencia y resultados en notas privadas con revisión; usar solo reglas activas cuyo alcance y vigencia pasen el evaluador. Compartir cambios de mecánica por ORQUESTRADOR sin transferir preferencias de cuenta.
