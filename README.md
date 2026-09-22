# Uzko · Finanzas personales

App de finanzas personales de **Valeria Escategui**, marca **The Uzko**
(amarillo `#ffc20e`, negro y blanco, estilo sticker — el logo vive en
`public/logo-uzko.jpg` y de él salen los íconos de la PWA).

Hermana de **Sosa Baserva** (Casa Guisos) y **Finanzas Familiar**: comparte el
motor —React + Vite, funciones de Vercel, Redis, Blob, PasswordGate— pero el
dominio es otro: gastos personales en tres monedas, presupuesto y registro
automático desde los SMS del banco.

## Qué hace

- **Movimientos**: gastos e ingresos con foto del ticket. Cada uno se teclea
  en la moneda en que se pagó —**euros, dólares o bolívares**— y se convierte
  al entrar con la tasa BCV del día, que queda guardada dentro del movimiento.
  **La contabilidad se lleva en euros**: todos los totales y el presupuesto.
- **Por pagar**: cuentas que vencen (alquiler, facturas) que se marcan pagadas
  cuando toca, con su comprobante.
- **Presupuesto por mes y categoría**: se define en euros, cada gasto va
  descontando, y el resumen avisa cuando una categoría se pasa.
- **Cuentas y tarjetas**: cada gasto puede decir de dónde salió; la vista
  enseña cuánto se movió por cada una en el mes.
- **Bandeja de entrada (registro automático)**: los SMS del banco llegan solos
  por `/api/inbox` (webhook con token, reenviado por MacroDroid desde el
  teléfono) o por el **"Compartir a Uzko"** de Android (share target de la
  PWA). Un parser lee monto, moneda, comercio y fecha, propone la categoría, y
  ella confirma con un toque. **Nada se registra sin confirmar.**
- **PWA instalable**: desde Chrome en Android, "Añadir a pantalla de inicio" y
  queda como una app más, con su ícono.

## Stack

React 18 + Vite · Recharts · CSS propio · Funciones serverless en Vercel ·
Upstash Redis (datos) · Vercel Blob privado (recibos).

## Cómo correrlo

```bash
npm install
npm run dev      # http://localhost:5175 · acceso abierto, datos en .data/
npm run build
```

En local no hace falta configurar nada: sin Redis los datos van a
`.data/store.json`, sin Blob los recibos a `.data/adjuntos/`, y el login está
abierto (entras como administrador).

## Desplegar (Vercel)

1. Importar el repo en Vercel (framework: Vite; el `vercel.json` ya lo dice).
2. **Storage → Upstash Redis** y **Storage → Blob**: conectarlos al proyecto.
3. Variables de entorno (ver `.env.example`):
   - `SITE_PASSWORD` — la contraseña de la app (una sola; sin usuarios por ahora)
   - `INBOX_TOKEN` — el secreto del webhook de SMS (sin él, apagado)
   - `SESSION_SECRET` — opcional, firma la cookie
4. Volver a desplegar para que tome las variables.

## Conectar el teléfono (auto-registro de gastos)

**iPhone (el de Valeria) — Apple Pay vía Atajos.** La automatización
**"Transacción"** de la app Atajos se dispara sola con cada pago de Apple Pay
y entrega el comercio y el monto como variables de Wallet — datos exactos,
sin parsear texto:

- Atajos → Automatización → **Transacción** → elegir tarjeta(s) → "Ejecutar
  inmediatamente".
- Acción **"Obtener contenido de URL"** → `POST`
  `https://<app>.vercel.app/api/inbox?token=<INBOX_TOKEN>` con cuerpo JSON:
  `{"origen":"applepay","comercio":<Comercio>,"monto":<Importe>,"moneda":"EUR"}`.

**Android — SMS vía MacroDroid** (gratis en Google Play):

- **Disparador**: SMS recibido → del número/remitente del banco.
- **Acción**: Petición HTTP → `POST` a la misma URL con cuerpo
  `{"texto":"[sms_message]","origen":"sms"}`.

Cada pago aparece al instante en la **Bandeja** de la app, leído y con
categoría propuesta; nada se registra sin confirmar. La misma guía está
dentro de la app, en la vista Bandeja.

## Decisiones que conviene conocer

- **Base EUR, tasas BCV.** El BCV publica euro y dólar cada uno contra el
  bolívar; el cambio $→€ sale de cruzar esas dos cifras del mismo día y la
  misma fuente (`api/_lib/numeros.js`), no de una cotización de mercado. Cada
  movimiento guarda la cifra tecleada, su moneda y la tasa usada.
- **Nada se borra.** Anular es un estado; cada cambio deja línea en el
  historial con quién y cuándo. Los totales se derivan siempre de los
  movimientos: no hay ningún número guardado que pueda discrepar del detalle.
- **El parser propone, la persona dispone.** Lo que llega del banco espera en
  la bandeja hasta que se confirma; un parse malo se corrige en el formulario.
- **Blob privado.** Los recibos no tienen URL estable: se firman al servir y
  caducan. Ver `api/_lib/adjuntos.js`.

## Estructura

```
api/
  movimientos.js  cuentas.js  presupuesto.js  bandeja.js  inbox.js
  login.js  logout.js  session.js  subir.js  tasa.js
  _lib/           auth · store (Redis/archivo) · tasa BCV · numeros ·
                  movimientos · cuentas · presupuesto · bandeja · parser ·
                  adjuntos · body
src/
  config.js       moneda (EUR), tipos de cuenta, re-export de categorías
  lib/            categorias (+reglas de auto-clasificación) · calculos ·
                  format · tasa · subir · usePresupuesto
  context/        AppContext (movimientos, cuentas, tasas, mes, acciones)
  auth/           Sesion · PasswordGate
  components/
    dashboard/    Resumen (KPIs, dona, tendencia, presupuesto, últimos)
    movimientos/  lista · nuevo · detalle · tasa · adjuntos · piezas
    presupuesto/  editor y progreso del mes
    cuentas/      tarjetas y cuentas
    bandeja/      entradas del banco + guía de MacroDroid
    layout/       Sidebar · Header
```
