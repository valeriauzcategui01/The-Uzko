// La cuenta de convertir, importada tal cual desde el servidor.
//
// No es un atajo para no escribirla dos veces: es la garantía de que el número
// que se ve mientras se teclea y el que se acaba guardando son la misma
// operación. Si el navegador leyera "1.250,00" distinto que la función de
// Vercel, la pantalla prometería un monto y el movimiento guardaría otro.
//
// `api/_lib/numeros.js` no importa nada —ni de Node ni del resto de la app—
// justamente para poder viajar también en el bundle.
export { monto, bsAEuros, eurosABs, usdAEuros, eurosAUsd } from '../../api/_lib/numeros.js'
