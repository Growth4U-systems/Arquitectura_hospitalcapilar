# GHL Architecture — Hospital Capilar
> Documento de referencia. No modificar sin revisar impacto en código y workflows.

---

## Pipeline: Leads HC

| Stage | Quién lo asigna | Cuándo |
|---|---|---|
| New Lead | Automático (ghl-proxy.js) | Lead entra por quiz o form |
| Contacted | Comercial manual | Primer contacto realizado |
| Booked | Automático (webhook Koibox) | Cita agendada en Koibox |
| Reminder Sent | Automático (W3) | Recordatorio 24h enviado |
| Attended | Comercial manual | Paciente asistió a la cita |
| Won | Comercial manual | Cliente cerrado |
| No-Show | Comercial manual | No apareció a la cita |
| Lost | Comercial manual | Descartado |

---

## Tags

Solo 6 tags. Cada uno tiene un propósito claro y no duplica stages ni custom fields.

| Tag | Lo asigna | Dispara | Para qué |
|---|---|---|---|
| `pago_195` | Automático (stripe-webhook.js) | W2 | Lead pagó bono diagnóstico 195€ |
| `pago_70` | Automático (stripe-webhook.js) | W2 | Lead pagó bono reducido 70€ (A/B test) |
| `mala-experiencia` | W1 automático | Rama especial W1 | Segunda opinión, nunca pago directo |
| `no-candidato` | W1 automático | — | Derivación dermatología, fuera del funnel comercial |
| `waitlist` | W1 automático | Campaña apertura nueva ciudad | Ciudad sin clínica operativa |
| `cold-lead` | W1/W4 automático | Campaña reactivación futura | Sin respuesta tras secuencia completa |

---

## Custom Fields

### Contacto

| Campo | ID | Tipo | Valores | Lo escribe |
|---|---|---|---|---|
| `door` | `2JYlfGk60lHbuyh9vcdV` | Text | `quiz_largo` / `quiz_corto` / `form` | ghl-proxy.js |
| `ecp` | `cFIcdJlT9sfnC3KMSwDD` | Text | Ver tabla ECP abajo | ghl-proxy.js |
| `contact_score` | `SGT17lKk7bZgkInBTtrT` | Number | 0–100 | ghl-proxy.js |
| `ubicacion_clinica` | `LygjPVQnLbqqdL4eqQwT` | Text | Ciudad del lead | ghl-proxy.js |
| `sexo` | `P7D2edjnOHwXLpglw9tB` | Text | — | ghl-proxy.js |
| `consent` | `x2QNuqJqst8Oy8H6pV0G` | Text | — | ghl-proxy.js |
| `agent_message_contact` | `5voFSSQP0yBFa8VdLuzY` | Text | Resumen del agente | ghl-proxy.js |
| `utm_source` | `MisB9YJJAH7cnh8JOtQn` | Text | — | ghl-proxy.js |
| `utm_medium` | `vykx7m6bcfbYMXRqToYP` | Text | — | ghl-proxy.js |
| `utm_campaign` | `3fUI7GO9o7oZ7ddMNnFf` | Text | — | ghl-proxy.js |
| `utm_content` | `dydSaUSYbb5R7nYOboLq` | Text | — | ghl-proxy.js |
| `utm_term` | `eLdhsOthmyD38al527tG` | Text | — | ghl-proxy.js |

### Oportunidad

| Campo | ID | Tipo | Valores | Lo escribe |
|---|---|---|---|---|
| `lead_priority` | `l99Opesqh9cJBLxSPs4z` | Dropdown | `HOT` / `WARM` / `COLD` | ghl-proxy.js |
| `agent_message` | `cVtN5KboKd2R1cf1s7QA` | Text | Resumen del agente | ghl-proxy.js |
| `tratamiento_status` | `Hk81fRW2HaTqlry4I1L0` | Dropdown | `not_paid` / `paid_195` / `paid_70` / `refunded` | ghl-proxy.js + stripe-webhook.js |
| `fecha_cita` | *Crear en GHL* | Date | Fecha de la cita | koibox-webhook.js (pendiente) |
| `hora_cita` | *Crear en GHL* | Text | Hora de la cita (ej: "10:30") | koibox-webhook.js (pendiente) |
| `koibox_booking_id` | *Crear en GHL* | Text | ID reserva en Koibox | koibox-webhook.js (pendiente) |
| `motivo_perdida` | *Crear en GHL* | Dropdown | `precio` / `sin_respuesta` / `no_candidato` / `otra_clinica` / `no_contesta` | Comercial manual |

---

## Valores ECP (Clasificación del Paciente)

| Valor ECP | Perfil | Flujo comercial |
|---|---|---|
| `¿Qué Me Pasa?` | Hombre adulto | Consulta gratuita → comercial agenda |
| `El Espejo` | Hombre joven | Consulta gratuita → comercial agenda |
| `La Inversión` | Post-trasplante | Consulta gratuita → comercial agenda |
| `Es Normal` | Mujer hormonal | Pago 195€ o 70€ → agenda en Koibox |
| `Lo Que Vino Con el Bebé` | Postparto | Pago 195€ o 70€ → agenda en Koibox |
| `Ya Me Engañaron` | Segunda opinión | Siempre llamada, nunca pago directo |
| `No Candidato` | Dermatológico | Artículo educativo, fuera del funnel |

> Ciudad sin clínica: se detecta por `ubicacion_clinica`, no por ECP.

---

## Lead Priority — Lógica de cálculo

| Score | Priority | Significado |
|---|---|---|
| ≥ 70 | `HOT` | Ciudad operativa (Madrid, Murcia, Pontevedra) |
| 30–69 | `WARM` | Ciudad con apertura prevista 2026 |
| < 30 | `COLD` | Ciudad fuera de zona operativa |

---

## Workflows

### W1 — Nurturing por ECP
**Trigger:** Opportunity Stage Changed → New Lead

```
[New Lead]
│
├─ [ECP = No candidato]
│       → Email artículo dermatología
│       → Tag: no-candidato
│       → FIN
│
├─ [ubicacion_clinica = ciudad sin clínica]
│       → WhatsApp: waitlist apertura 2026
│       → Tag: waitlist-2026
│       → FIN
│
├─ [ECP = Mala experiencia]
│       → Tag: mala-experiencia
│       → Tarea comercial INMEDIATA: llamada prioritaria
│       → +48h sin gestión → WhatsApp: Guía PDF segunda opinión
│       → Nurturing semanal suave
│       → FIN
│
├─ [ECP = Mujer hormonal / Postparto] + [HOT o WARM]
│       → 0min    WhatsApp: bono diagnóstico + link pago
│       → +1h     Email: testimonio + CTA pagar
│       → +24h    WhatsApp: qué incluye la consulta
│       → +3d     Tarea comercial: llamar
│       → +7d     WhatsApp: último intento
│       → +7d     Tag: cold-lead → FIN
│
├─ [ECP = Mujer hormonal / Postparto] + [COLD]
│       → Tarea comercial: llamar (ciudad fuera de zona)
│       → FIN
│
├─ [ECP = Hombre / Joven / Post-trasplante] + [HOT o WARM]
│       → 0min    Tarea comercial: agendar consulta gratuita
│       → 0min    WhatsApp: consulta gratuita disponible + CTA contactar
│       → +24h    WhatsApp: seguimiento + beneficio concreto
│       → +3d     Tarea comercial: segundo intento
│       → +7d     Tag: cold-lead → FIN
│
└─ [ECP = Hombre / Joven / Post-trasplante] + [COLD]
        → Tarea comercial: llamar
        → FIN
```

**Nota:** W1 se detiene automáticamente si el stage cambia (el comercial interviene o el lead paga).

---

### W2 — Post-pago sin agendar
**Trigger:** Tag añadido = `pago_195` OR `pago_70`

```
[Tag pago_195 o pago_70]
│
→ 0min    WhatsApp: confirmación pago + link Koibox para agendar
→ +24h    [koibox_booking_id vacío] WhatsApp: recordatorio agendar
→ +48h    [koibox_booking_id vacío] Tarea comercial: ayudar a reservar
→ FIN

Cuando llega booking de Koibox → Stage → Booked → W3 arranca
```

---

### W3 — Recordatorio de cita
**Trigger:** Opportunity Stage Changed → Booked

```
[Stage = Booked]
│
→ 0min         WhatsApp: confirmación fecha + hora + clínica + qué llevar
→ [fecha_cita - 24h]  WhatsApp: recordatorio completo
→ Stage → Reminder Sent
→ [fecha_cita - 2h]   WhatsApp: recordatorio breve
```

---

### W4 — Recuperación No-Show
**Trigger:** Opportunity Stage Changed → No-Show

```
[Stage = No-Show]
│
→ +1h     WhatsApp: empático, ofrecer reagendar
→ +24h    [sin respuesta] Tarea comercial: llamar, intentar reagendar
→ +3d     [sin respuesta] WhatsApp: nueva oportunidad + urgencia suave
→ +7d     [sin respuesta] Tag: cold-lead → FIN

Si reagenda → Stage → Booked → W3 arranca de nuevo
```

---

## Pendiente de implementar en código

| Tarea | Archivo | Estado |
|---|---|---|
| Diferenciar `paid_195` vs `paid_70` en stripe-webhook.js | `netlify/functions/stripe-webhook.js` | Pendiente |
| Webhook Koibox → GHL (actualizar Stage + fecha_cita + koibox_booking_id) | `netlify/functions/koibox-webhook.js` | Pendiente crear |
| Crear IDs de campos nuevos en GHL y añadir al código | `netlify/functions/ghl-proxy.js` | Pendiente (esperando IDs de GHL) |

---

## Campos pendientes de crear en GHL

Ir a **Settings → Custom Fields → Opportunities** y crear:

| Campo | Tipo | Opciones |
|---|---|---|
| `fecha_cita` | Date | — |
| `hora_cita` | Single Line Text | — |
| `koibox_booking_id` | Single Line Text | — |
| `motivo_perdida` | Dropdown | precio / sin_respuesta / no_candidato / otra_clinica / no_contesta |

Una vez creados, añadir los IDs generados por GHL en este documento y en `ghl-proxy.js`.
