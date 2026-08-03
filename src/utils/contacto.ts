// src/utils/contacto.ts
// Datos de contacto del evento, definidos una sola vez para que no queden
// versiones distintas dadas vueltas por el sitio.
//
// ⚠️ El WhatsApp del evento se dio de baja el 2026-08-03 (decisión de Martín:
// finalmente no se usa). El canal público es el formulario de consultas
// (`Consultas.astro` → POST /api/consulta) más este mail. No reponer un número
// acá sin que la organización lo confirme: publicar un WhatsApp que nadie
// atiende es peor que no tenerlo.
//
// El campo `phone_whatsapp` del perfil es otra cosa: es el teléfono de cada
// participante, y sigue en uso.

// ⚠️ Hasta el 2026-08-03 acá decía `hackathonedutech@gmail.com`, que **no
// existe**: Gmail la rechazó con hard bounce y Brevo la puso en su lista de
// bloqueados. Estuvo publicada en el footer, el bloque de consultas y las Bases
// desde el commit 5db7ffd, así que todo el que escribió ahí recibió un rebote.
// La casilla real es la que es dueña de la cuenta de Brevo y el único remitente
// verificado. Si alguna vez cambia, verificar que la nueva reciba de verdad
// antes de publicarla.
export const EMAIL = 'hackathoneducacionmendoza@gmail.com';
