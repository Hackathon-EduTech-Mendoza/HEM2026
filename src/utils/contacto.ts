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

export const EMAIL = 'hackathonedutech@gmail.com';
