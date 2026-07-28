// src/utils/contacto.ts
// Datos de contacto del evento, definidos una sola vez para que no queden
// versiones distintas dadas vueltas por el sitio.

/** Como se muestra en pantalla. */
export const WHATSAPP_VISIBLE = '+54 9 2615 36-5167';

/** Solo dígitos con código de país: es el formato que exige wa.me. */
const WHATSAPP_DIGITOS = '5492615365167';

export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_DIGITOS}`;

export const EMAIL = 'hackathonedutech@gmail.com';
