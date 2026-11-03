# ADR-0009 — Cero telemetría y cero servicios de terceros

- **Estado**: Aceptada (límite de servicios de terceros ampliado por [ADR-0017](0017-el-tag-produce-los-instalables-del-release.md))
- **Fecha**: 2026-08-01
- **Ámbito**: arquitectura general, `package.json`

## Contexto

Casi todas las apps de una framework añaden por defecto un conjunto de servicios de
terceros: analítica de eventos, reporte de errores, mapas de calor, anuncios, attributación
de campañas, sincronización de cuenta. Cada uno es un bundle, una política de privacidad
que redactar, un proveedor que puede cambiar de dueño y un canal por el que sale un dato
del usuario.

En este producto, ninguno de esos servicios aporta valor al usuario: la app no tiene
modelo de negocio, no monetiza y no necesita conocer el comportamiento del usuario para
funcionar.

## Decisión

**La app no incluye ningún SDK de terceros que reporte datos del usuario.**

Reglas que acompañan la decisión:

- **Sin analítica de eventos.** Ningún evento se envía a ningún servidor.
- **Sin reporte de errores remoto.** Un error se registra en el log del dispositivo
  (`console.error` con prefijo del módulo, como en `PdfImporter`) y no sale.
- **Sin publicidad, sin attribution, sin A/B testing, sin push notifications.**
- **Sin account system ni SDK social.** No hay inicio de sesión en ningún sentido.
- **Las dependencias de producción son las de la app, no las de un stack de medición.**
  `package.json` no declara ningún SDK de telemetría, y eso es una decisión que se puede
  verificar con una búsqueda de dependencias.

Consecuencia directa de [ADR-0002](0002-cero-backend-todo-en-el-dispositivo.md): la app
no tiene servidor, y sin servidor no hay a quién reportar.

## Consecuencias

### Positivas

- **La app no tiene política de privacidad que redactar**: no recoge datos personales.
  Eso simplifica la publicación en tiendas y la respuesta a cualquier pregunta de un
  usuario sobre sus datos.
- Bundle más pequeño: cada SDK de terceros son cientos de kilobytes.
- Sin dependencia de la disponibilidad de un tercero: la app funciona igual sin internet.
- **Ninguna cadena de suministro de terceros con acceso a los datos del usuario.** Los
  riesgos de un SDK comprometido no existen porque el SDK no está.

### Costes

- **No hay forma de saber cómo se usa la app.** No hay métricas de conversión, ni de
  abandonment, ni de errores más frecuentes en campo. El único canal de reporte es el
  usuario.
- **Los errores en producción no se pueden diagnosticar de forma agregada.** Se compensa
  con logs locales y con un manual de diagnóstico
  ([`../runbooks/04-diagnosticar-un-fallo-de-importacion-de-pdf.md`](../runbooks/04-diagnosticar-un-fallo-de-importacion-de-pdf.md)).
- **No hay telemetría para detectar regresiones de uso.** El sustituto es la suite de
  pruebas y el proceso de release con puerta de promoción.

## Alternativas descartadas

- **Sentry o similar para reporte de errores.** Se descartó por el coste de privacidad
  (el reporte de errores incluye contexto del dispositivo) y porque la app tiene pocos
  puntos de fallo susceptibles de romper.
- **PostHog / Amplitude para analítica.** Se descartó porque el producto no tiene un
  embudo que optimizar y porque introduciría una petición de red constante.
- **Analytics de Firebase junto con Crashlytics.** Se descartó por lo mismo: arrastra
  Google Cloud, una cuenta y un contrato de tratamiento de datos.
- **Push notifications para recordar la simulación.** Se descartó porque requiere
  servidor para registrar el token.
