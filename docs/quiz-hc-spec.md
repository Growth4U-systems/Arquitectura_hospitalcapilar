# Quiz Hospital Capilar — Documentación de Producción

**Stack:** Astro SSR + React 19 + Firestore + GHL + Stripe + Koibox + PostHog
**Lanzamiento:** 2026-05-11

## Ownership

| Área | Owner | Responsabilidad |
|---|---|---|
| **Funnel + código quiz + integraciones** | **Ramiro + Martin (Growth4U)** | Arquitectura, deploy, mantenimiento código |
| **Workflows GHL & automations** | **Ramiro (Growth4U)** | Triggers, pipelines, sequences, custom fields |
| **Validación técnica + Dashboard** | **Martin (Growth4U)** | QA E2E, métricas, BI, monitoring |
| **Consultoría estratégica** | **Philippe (Growth4U)** | Dirección estratégica, decisiones de funnel, escalado |
| Meta Ads operativa | Miguel (HC) | Campañas, lead forms, Pixel |
| Asesoría comercial | Noemí + hermano de Óscar (HC) | Videollamadas, WhatsApp, cierre |
| Dirección médica | Dr. responsable HC | Validación clínica protocolos |
| Dirección general HC | Óscar + María (HC) | Visión negocio, presupuesto, recursos |

---

## 1. Arquitectura del Flujo

```
Anuncio Meta (mujer / nicho específico)
     │
     ▼
Meta Lead Form (6 campos)
   • Sexo (mujer/hombre)
   • ¿Preocupado/a por caída? (si/no)
   • Ciudad (madrid/murcia/pontevedra/otra)
   • Nombre (autofill)
   • Email (autofill)
   • Teléfono (autofill)
     │
     ├──► GHL nativo (lead creado con custom fields)
     │
     └──► Thank-you redirect →
              /quiz-hospitalcapilar/?v=...&caida=...&ciudad=...&nombre=...&email=...&telefono=...&leadId=...&utm_*=...
                   │
                   ├──► Si v=mujer (5 preguntas)
                   │     ▼
                   │   P1 Tiempo · P2 Patrón · P3 Origen · P4 Tratamientos · P5 Objetivo
                   │     ▼ Scoring CRT vs HRT
                   │     ▼ Resultado: Protocolo CRT o HRT + bloque Hair Pro + disclaimer Tricometabólico
                   │     │
                   │     ├── CTA primario → Calendario HC Videollamadas (GHL prefilled)
                   │     │                    → cita en Gmail de Noemí
                   │     │                    → videollamada con asesora
                   │     │                    → cobro 125€ Stripe / 195€ clínica
                   │     │
                   │     └── CTA secundario → WhatsApp (+34 623 457 218)
                   │
                   └──► Si v=hombre (3 preguntas)
                         P1 Tiempo · P2 Patrón Norwood · P3 Tratamientos
                         ▼ Resultado: Asesoría presencial gratuita
                         └── CTA → WhatsApp (Koibox embed pendiente)
```

---

## 2. Meta Lead Form

### Campos del form

| # | Campo | Tipo | Nombre interno (slug) | Opciones / Valor |
|---|---|---|---|---|
| 1 | Sexo | Single select | `sexo` | `mujer` / `hombre` |
| 2 | ¿Estás preocupado/a por tu caída? | Single select | `caida` | `si` / `no` |
| 3 | ¿En qué ciudad vives? | Single select | `ciudad` | `madrid` / `murcia` / `pontevedra` / `otra` |
| 4 | Nombre | Autofill | `full_name` | — |
| 5 | Email | Autofill | `email` | — |
| 6 | Teléfono | Autofill | `phone_number` | — |

### Intro screen

```
Deja de adivinar qué le pasa a tu pelo

Test online en 5 preguntas. Te decimos qué tratamiento necesita tu caso
y agendas asesoría gratuita con nuestro equipo médico.

⏰ 1 minuto · 100% gratis · Sin compromiso
👩🏻‍⚕️ Validado por médicos especialistas
```

### Thank-you screen

- **Botón CTA:** `Empezar mi diagnóstico`
- **Redirect URL:**

```
https://diagnostico.hospitalcapilar.com/quiz-hospitalcapilar/?v={{form.sexo}}&caida={{form.caida}}&ciudad={{form.ciudad}}&nombre={{form.full_name}}&email={{form.email}}&telefono={{form.phone_number}}&leadId={{lead_id}}&utm_source=meta&utm_medium=lead_form&utm_campaign={{ad.campaign.name}}&utm_content={{ad.id}}&utm_term={{adset.id}}
```

---

## 3. GHL Setup

### Custom fields creados (2026-05-07)

| Field Name | ID | Type | Picklist |
|---|---|---|---|
| Sexo Lead Form | `ySOJCraPl26CR161KFxW` | SINGLE_OPTIONS | mujer, hombre |
| Preocupacion caida | `hLiD1jVS5UkzJUjLWo8g` | SINGLE_OPTIONS | si, no |

### Custom fields preexistentes relevantes

| Field Name | ID | Type |
|---|---|---|
| Door | `2JYlfGk60lHbuyh9vcdV` | SINGLE_OPTIONS |
| ECP | `cFIcdJlT9sfnC3KMSwDD` | TEXT |
| utm_source / medium / campaign / content / term | varios | TEXT |
| Funnel Type | `liIshAFJMngl2BV9MtVw` | TEXT |
| Traffic Source | `miu6E3oxZowYahYGjX1A` | TEXT |
| contact_score | `SGT17lKk7bZgkInBTtrT` | NUMERICAL |
| Qué ha hecho por la caída | `P2GSHqir1PRJKMihQx1h` | TEXT |

### Calendarios

| Calendar | ID | Type | Uso |
|---|---|---|---|
| **Calendario HC Videollamadas** | `kZbXjtt6kmjj1phXdoqP` | personal | CTA mujer post-quiz → Gmail de Noemí |
| Calendario HC | `sMbNt8SyzfjroMbZvB74` | class_booking | Citas presenciales clínica |

### Pipeline Leads HC

```
1. New Lead          fbed92b1-...   ← lead form submit
2. Contacted         f0b2e24c-...   ← asesora primer contacto WhatsApp
3. Videocall booked  <TBD>          ← videollamada agendada (Calendario HC Videollamadas)
4. Paid              2eac8c05-...   ← pagó 125€ Stripe online
5. Booked            f9e5c1cf-...   ← cita presencial agendada en Koibox
6. Reminder sent     24956338-...   ← recordatorio 24h antes
7. Attended          71a5cc36-...   ← vino a la cita en clínica
8. Won               1cd97c60-...   ← compró tratamiento
9. No-show           437d0663-...   ← no vino a la cita
10. Lost/Cancelled   c961b576-...   ← cancelado
11. Abandoned        28227d12-...   ← sin respuesta
```

**Nota:** la stage `Videocall booked` debe crearse manualmente en GHL UI (la API key no tiene permiso de escritura sobre pipelines). Una vez creada, actualizar este doc con su ID.

---

## 4. Quiz Corto — Rama MUJER (5 preguntas + resultado)

### Framework clínico (validado por dirección médica 2026-05-07)

- **CRT (PRP)** → efluvios telógenos, cuadros transitorios, postparto, estrés, dieta, enfermedad
- **HRT (dutasterida intradérmica)** → androgenética real (patrón Ludwig, antecedentes, evolución >1 año)
- **Hair Pro** → booster del cuero cabelludo, combinable con CRT o HRT

### P1 · ¿Hace cuánto pierdes pelo?

| Opción | Score |
|---|---|
| <3 meses | +2 CRT |
| 3-12 meses | +1 CRT |
| 1-3 años | +2 HRT |
| >3 años | +3 HRT |

### P2 · ¿Dónde notas más la pérdida?

| Opción | Score |
|---|---|
| Raya central / parte superior | +3 HRT |
| Sienes y línea frontal | +3 CRT |
| Difuso por toda la cabeza | +3 HRT + 🚩 flag médico |
| Zonas localizadas (parches) | +2 HRT + 🚩 flag médico |
| No lo tengo claro | 0 |

### P3 · ¿Identificas alguna causa?

| Opción | Score |
|---|---|
| Embarazo o postparto | +3 CRT |
| Menopausia o perimenopausia | +3 HRT + 🚩 flag médico |
| Problema hormonal diagnosticado | +3 HRT + 🚩 flag médico |
| Estrés / dieta / enfermedad reciente | +3 CRT |
| Antecedentes familiares de calvicie | +3 HRT |
| No identifico causa | 0 |

### P4 · ¿Has probado algo? *(sin scoring, contextual)*

- Minoxidil / finasterida sin resultado
- PRP / mesoterapia en otra clínica
- Champús / vitaminas / productos casa
- Tratamiento hormonal
- Nada todavía

### P5 · ¿Qué buscas conseguir? *(sin scoring)*

- Frenar caída
- Recuperar densidad
- Entender qué me pasa

### Lógica de decisión

```
Sumar puntos CRT y HRT (solo P1, P2, P3)
SI diff(CRT, HRT) ≥ 2 → gana el mayor
SI diff < 2 → HRT por defecto
SI flag médico activo → marca al asesor + nota visible
```

### Pantalla resultado mujer

- Header: "Pre-recomendación: Protocolo {CRT|HRT}"
- 3 bullets: qué hace, indicado para ti porque, resultado esperado
- Si `flag === true` → banner ámbar "Tu caso necesita atención especializada"
- Bloque "Combinable con Hair Pro"
- Disclaimer Tricometabólico
- **CTA primario:** "Agenda una videollamada con nuestro equipo médico" → `kZbXjtt6kmjj1phXdoqP` con prefill
- **CTA secundario:** "Hablar por WhatsApp con una asesora" → wa.me/34623457218

---

## 5. Quiz Corto — Rama HOMBRE (3 preguntas + resultado)

**Sin scoring** — solo data clínica para el médico.

- **P1** · ¿Hace cuánto pierdes pelo? (Menos de 3m / 3-12m / 1-3a / Más de 3a)
- **P2** · ¿Cómo describes tu pérdida? Escala Norwood (Entradas leves / Entradas marcadas / Coronilla afectada / Avanzado)
- **P3** · ¿Has probado algo antes? (Minoxidil / Finasterida / PRP otra clínica / Trasplante / Productos casa / Nada)

### Pantalla resultado hombre

"Asesoría presencial gratuita con nuestro equipo médico":
- **CTA primario:** "Agenda tu asesoría presencial gratuita" → redirige a `/agendar` (Koibox-backed) con `tipo=asesoria` (bypass del bono gate), `clinica` desde el Meta form, y nombre/email/phone/contactId prerellenados.
- **CTA secundario:** "Hablar por WhatsApp con una asesora" → wa.me/34623457218.

⚠ Actualmente solo Madrid está habilitada en `AgendarPage.jsx`. Murcia y Pontevedra están comentadas para piloto — descomentar cuando estén operativas.

---

## 6. URLs de referencia

| URL | Uso |
|---|---|
| `https://diagnostico.hospitalcapilar.com/quiz-hospitalcapilar/` | Landing + quiz (orgánico) |
| `?v=mujer` / `?v=hombre` | Preselecciona rama desde Meta |
| `https://api.leadconnectorhq.com/widget/booking/kZbXjtt6kmjj1phXdoqP` | Calendario videollamadas |
| `https://wa.me/34623457218` | WhatsApp asesora |

---

## 7. Plan de medición

### 7.1 Funnel y sources of truth

| # | Etapa | Source of truth | Métrica clave |
|---|---|---|---|
| 1 | Impresión anuncio | Meta Ads / Google Ads | Impressions, frequency |
| 2 | Clic anuncio | Meta / Google + UTMs | CTR, CPC |
| 3 | Lead form abierto | Meta Ads | Form opens |
| 4 | Lead form submit | Meta Ads + GHL Contact | CPL, lead volume |
| 5 | Redirect a quiz | PostHog `$pageview` `/quiz-hospitalcapilar/` | Drop-off Meta→quiz (~30-40%) |
| 6 | Quiz iniciado | PostHog `diagnostic_quiz_started` | Start rate |
| 7 | Quiz completado | PostHog `diagnostic_quiz_completed` + Firestore | Completion rate |
| 8 | CTA cita pulsado | PostHog `diagnostic_quiz_cta_clicked` | Click rate calendar vs WhatsApp |
| 9 | Videollamada agendada | GHL Calendar (kZbXjtt6kmjj1phXdoqP) + Pipeline `Videocall booked` | Booking rate |
| 10 | Videollamada atendida | GHL (asesora actualiza manualmente o automation) | Show-up rate |
| 11 | Pago 125€ Stripe | Stripe webhook → GHL Pipeline `Paid` | Conversion rate |
| 12 | Cita Koibox presencial | Koibox API → Firestore `bookings` + Pipeline `Booked` | Booking físico |
| 13 | Cita atendida | GHL Pipeline `Attended` | Show-up clínica |
| 14 | Tratamiento vendido | GHL Pipeline `Won` + Salesforce | Revenue / venta |

### 7.2 Eventos PostHog actuales (implementados)

```javascript
diagnostic_quiz_prefilled_sex    { sexo }
diagnostic_quiz_started          { nicho, sexo }
diagnostic_quiz_sex_selected     { sexo }
diagnostic_quiz_completed        { nicho, sexo, result: {protocol, flag, scores} }
diagnostic_quiz_cta_clicked      { sexo, protocol, channel: 'ghl_calendar'|'whatsapp' }
```

### 7.3 Eventos a añadir (gap)

```javascript
diagnostic_quiz_question_answered    { sexo, questionId, answer, step, totalSteps }
diagnostic_quiz_landing_viewed       { nicho, source: 'meta'|'organic' }
ghl_appointment_booked               // vía webhook GHL → backend → PostHog
stripe_payment_completed             { amount, contactId }
koibox_appointment_created           { city, calendarId, ghlContactId }
treatment_purchased                  { protocol, amount, contactId }
```

### 7.4 Atribución cross-system

```
Meta Ad URL (utm_source=meta&...)
  │
  ├──► Meta Lead Form thank-you URL preserva UTMs como params
  │     │
  │     └──► /quiz-hospitalcapilar/ → URL params persisten en Firestore quiz_leads.source
  │           │
  │           └──► PostHog $set y trackQuizStarted con UTMs
  │
  └──► Meta → GHL native integration → GHL custom fields utm_source/medium/etc
        │
        └──► GHL Calendar event hereda contact.customFields
              │
              └──► Stripe metadata.utm_source (si se setea al crear checkout)
                    │
                    └──► Koibox sync (vía GHL relay) preserva atribución original
```

### 7.5 KPIs por etapa (target fase 1)

| Etapa | Tasa target | Tiempo validar |
|---|---|---|
| CTR anuncio | ≥2% | Diaria, 200 imp |
| Submit form | ≥30% del clic | Diaria, 100 clics |
| Quiz iniciado / lead | ≥60% | 3 días |
| Quiz completado | ≥60% del iniciado | 3-5 días, 100 starts |
| Click CTA cita | ≥40% del completado | Semanal |
| Cita agendada | ≥60% del click | Semanal |
| Cita atendida | ≥60% de la agendada | Semanal |
| Pago 125€ | ≥40% de la atendida | Quincenal |
| Venta tratamiento | ≥40% del 125€ | Quincenal |

**CAC target:** ≤270€ (con ticket medio 900€).

### 7.6 Dashboard a construir

Sección `/quiz-hc` en el package `dashboard`:

1. **Funnel chart** (PostHog Funnels): pageview → quiz_started → completed → cta_clicked → ghl_booked
2. **Por canal (UTM):** mismo funnel agrupado por `utm_source`, `utm_campaign`
3. **Por sexo:** mujer vs hombre, conversión por rama
4. **Distribución CRT vs HRT:** % de mujeres que terminan en cada protocolo
5. **Flagged leads:** leads con flag médico para revisión manual
6. **CAC por canal:** spend Meta + Google / ventas atribuidas
7. **Tiempo lead → venta:** distribución del lag entre cada etapa

### 7.7 Stripe — tracking de pagos

Webhook Stripe → Netlify function → Firestore `stripe_payments` + PostHog event `stripe_payment_completed`. Asociar al `ghl_lead_id` via `customer_email` o `metadata.ghl_contact_id`.

Ya existe parcialmente en `netlify/functions/` — verificar y completar.

### 7.8 Koibox — tracking de citas presenciales

Sync existente Koibox → Firestore guarda en `bookings`. Cross-reference contra `quiz_leads` por teléfono o email para atribuir al canal original.

---

## 8. Workflows GHL — Avisos, recordatorios y nurturing

**Owner:** Ramiro · **Estado:** Por implementar antes de campaña real

Cada workflow se monta en GHL → Automations. Convención de naming: `[QHC] · {nombre_workflow}` para que sean filtrables ("Quiz HC").

### 8.1 Mapa de workflows

| # | Workflow | Trigger | Audience | Canal |
|---|---|---|---|---|
| W1 | Quiz incompleto — recuperación | Contact created tag `intent:high` AND no `quiz_completed` evento a +30min | Leads que no terminaron quiz | WhatsApp |
| W2 | Quiz completado sin booking — mujer | Evento `quiz_completed` AND no appointment en `kZbXjtt6kmjj1phXdoqP` a +1h | Mujeres con CRT/HRT que no agendaron | WhatsApp + Email |
| W3 | Quiz completado sin booking — hombre | Evento `quiz_completed` AND no Koibox appointment a +1h | Hombres sin agendar presencial | WhatsApp |
| W4 | **Pre-videollamada — nurturing** | Appointment created en `kZbXjtt6kmjj1phXdoqP` | Mujeres con cita confirmada | WhatsApp + Email |
| W5 | Notificación interna asesora | Appointment created | Noemí + hermano de Óscar | GHL internal + Email |
| W6 | No-show videollamada | Appointment time + 30min AND status != attended | Mujeres que no asistieron | WhatsApp |
| W7 | Post-videollamada sin pago | Status `attended` AND no Stripe payment a +24h | Asistentes sin pago 125€ | WhatsApp |
| W8 | Post-pago — pre-clínica | Stripe `payment_completed` | Pagadoras esperando cita clínica | WhatsApp + Email |
| W9 | Low intent — nurturing largo | Tag `intent:low` aplicado | Leads que respondieron "no" a la pregunta de caída | Email (no WhatsApp) |
| W10 | Reactivación lost/cancelled | Stage `Lost/Cancelled` | Pacientes perdidas, 30d después | Email |

---

### 8.2 Workflows detallados

#### W1 · Quiz incompleto — recuperación

**Trigger:** GHL Contact created · tag `intent:high` · sin evento `diagnostic_quiz_completed` después de 30 minutos

**Pasos:**
| Tiempo | Canal | Mensaje |
|---|---|---|
| T+30min | WhatsApp | "Hola {firstName}, vi que empezaste tu diagnóstico capilar pero no lo terminaste. ¿Tuviste algún problema? Aquí lo retomas: {link_quiz_with_prefill}" |
| T+1d | WhatsApp | "Solo te tomaba 1 minuto 😊 ¿Lo retomamos? Tu pelo te lo agradece. {link_quiz}" |
| T+3d | WhatsApp | Contenido educativo: "El 40% de mujeres sufre caída capilar y el 80% está mal diagnosticada. Hacer tu test online es el primer paso para entender qué te pasa. {link_quiz}" |
| T+7d | WhatsApp | Último intento: "Hacemos tu pre-diagnóstico gratis. {link_quiz}" |

**Exit condition:** quiz_completed event disparado, contact unsubscribe, o cita agendada manualmente.

---

#### W2 · Quiz completado sin booking — Mujer

**Trigger:** Evento `diagnostic_quiz_completed` con `sexo=mujer` · sin appointment en `Calendario HC Videollamadas` después de 1h

**Pasos:**
| Tiempo | Canal | Mensaje |
|---|---|---|
| T+1h | WhatsApp | "Hola {firstName}, vi que tu pre-recomendación fue Protocolo {protocol}. Agenda tu videollamada gratuita con nuestro equipo médico para que te lo expliquen al detalle: {link_calendar}" |
| T+1d | WhatsApp | Testimonio: "{Laura M., 52 años — caso similar} consiguió frenar su caída con nuestro Protocolo {protocol}. Mira su historia. Agenda tu videollamada: {link_calendar}" |
| T+3d | Email | Artículo más profundo del protocolo (qué es, cómo funciona, resultados) + CTA agenda |
| T+7d | Email | "¿Sigues considerando hacer algo por tu pelo? Estamos aquí cuando estés lista. {link_calendar}" |

**Exit condition:** appointment booked, paid, o tag `not_interested`.

---

#### W3 · Quiz completado sin booking — Hombre

**Trigger:** Evento `diagnostic_quiz_completed` con `sexo=hombre` · sin appointment Koibox después de 1h

**Pasos:**
| Tiempo | Canal | Mensaje |
|---|---|---|
| T+1h | WhatsApp | "Hola {firstName}, vi que terminaste tu diagnóstico. El siguiente paso es una asesoría presencial gratuita con nuestro equipo médico. Reserva aquí: {link_agendar}" |
| T+1d | WhatsApp | Trust signals: "Hospital Capilar - 12.000+ pacientes tratados. Dr. {nombre}, colegiado nº {X}. {link_agendar}" |
| T+3d | WhatsApp | "Te enviamos algo de info útil: {link_articulo_norwood}. Cuando quieras, agendas aquí: {link_agendar}" |
| T+7d | WhatsApp | Último contacto: "¿Cómo va? Si tienes dudas o quieres agendar: {link_agendar}" |

---

#### W4 · Pre-videollamada — NURTURING (clave) 🎯

**Trigger:** Appointment created en `Calendario HC Videollamadas` (`kZbXjtt6kmjj1phXdoqP`)

**Pasos:**
| Tiempo | Canal | Mensaje |
|---|---|---|
| T+0 inmediato | WhatsApp | "¡Genial {firstName}! Tu videollamada está confirmada para el {fecha} a las {hora}. Aquí te dejamos qué vamos a hacer y qué esperar: {link_microsite_personalizado}" |
| T+0 inmediato | Email | Confirmación con calendario .ics adjunto + link videollamada + microsite personalizado |
| T+1h | WhatsApp | Microsite con: tu protocolo {CRT/HRT}, qué evaluamos en la asesoría, preguntas que puedes traer, fotos del equipo, FAQs |
| T-24h | WhatsApp | "Mañana a las {hora} es tu videollamada. Prepara estas 3 preguntas: 1) ¿Qué incluye el Examen Tricometabólico? 2) ¿Es compatible con tratamientos previos? 3) {pregunta_personalizada_segun_protocolo}. Link: {link_videollamada}" |
| T-2h | WhatsApp | "En 2 horas tu cita. Recuerda tener buena conexión y un sitio tranquilo. Link directo: {link_videollamada}" |
| T-30min | WhatsApp | "Tu asesora te espera en 30 min: {link_videollamada}" |

**Exit condition:** appointment attended, no-show, o canceled.

**🎯 Bloqueante crítico:** el microsite personalizado (`/diagnostico/{leadId}`) no está construido. Es parte del compromiso con Óscar de la reunión 2026-05-06. **Owner:** Ramiro + Martin.

---

#### W5 · Notificación interna asesora

**Trigger:** Appointment created en `Calendario HC Videollamadas`

**Pasos:**
| Tiempo | Canal | Destinatario | Mensaje |
|---|---|---|---|
| T+0 | GHL internal notification | Asesora asignada (Noemí o hermano de Óscar) | "Nueva videollamada agendada: {firstName} {lastName} · {hora} · Protocolo recomendado: {CRT/HRT} · Ciudad: {ciudad} · Score: {contact_score}" |
| T+0 | Email | Asesora | Resumen completo del lead: respuestas del quiz, UTMs, qué ha probado antes (P4), objetivo (P5), flag médico si aplica |
| T-1h | WhatsApp interno | Asesora | "Tu próxima cita en 1h: {firstName}. Resumen: {link_dashboard_lead}" |
| T+15min post-cita | GHL task | Asesora | "Actualiza el pipeline de {firstName}: ¿pagó 125€? ¿quiere presencial? ¿no-show?" |

---

#### W6 · No-show videollamada

**Trigger:** Appointment time + 30min · status != attended

**Pasos:**
| Tiempo | Canal | Mensaje |
|---|---|---|
| T+30min | WhatsApp | "{firstName}, te esperamos para tu videollamada y no apareciste. ¿Pasó algo? Reagenda aquí sin problema: {link_calendar}" |
| T+1d | WhatsApp | "No queremos que pierdas la oportunidad de saber qué necesita tu pelo. Re-agenda cuando quieras: {link_calendar}" |
| T+3d | WhatsApp | Oferta alternativa: "Si la videollamada no te encaja, también podemos hacer la asesoría presencial en clínica. {link_agendar}" |
| T+7d | Email | Último intento con testimonio + link |

**Mover pipeline:** stage `No-show` automáticamente al disparar el trigger.

---

#### W7 · Post-videollamada sin pago

**Trigger:** Status `attended` (videollamada terminada) · sin Stripe `payment_completed` después de 24h

**Pasos:**
| Tiempo | Canal | Mensaje |
|---|---|---|
| T+24h | WhatsApp | "Hola {firstName}, ¿qué te pareció la asesoría con {asesora}? Si quieres seguir adelante con el Examen Tricometabólico, aquí tienes el link de pago seguro: {link_stripe_125}" |
| T+3d | WhatsApp | Testimonio: "{Patricia G., 48} hizo el Tricometabolic hace 3 meses y los resultados son brutales. {link_stripe}" |
| T+7d | WhatsApp | "Si prefieres pagar en clínica son 195€. Reserva aquí: {link_agendar_clinica}" |

---

#### W8 · Post-pago — pre-clínica

**Trigger:** Stripe `payment_completed` con `metadata.ghl_contact_id`

**Pasos:**
| Tiempo | Canal | Mensaje |
|---|---|---|
| T+0 inmediato | WhatsApp | "¡Pago confirmado {firstName}! Ahora elige el día y hora de tu Examen Tricometabólico en clínica: {link_koibox_filtered_by_city}" |
| T+0 inmediato | Email | Recibo + qué esperar en la clínica + dirección + horarios |
| T-3d cita clínica | WhatsApp | "En 3 días tu Examen Tricometabólico. Te recordamos lo que vamos a hacer: {link_microsite_personalizado}" |
| T-1d | WhatsApp | "Mañana a las {hora} tu cita en {clinica}. Dirección: {direccion} · Cómo llegar: {link_maps}" |
| T-2h | WhatsApp | "En 2 horas tu cita. Te esperamos en {clinica}. Por favor llega 10 min antes." |

---

#### W9 · Low intent — nurturing largo

**Trigger:** Tag `intent:low` aplicado (la persona respondió "no" a "¿Estás preocupada por tu caída?")

**Canal:** Solo Email (no WhatsApp para no quemar el número con audiencia fría)

**Pasos:**
| Tiempo | Canal | Mensaje |
|---|---|---|
| T+3d | Email | Contenido educativo: "5 señales tempranas de caída capilar que mucha gente ignora" |
| T+14d | Email | Testimonio: "Cómo Laura detectó su caída a tiempo y la frenó" |
| T+30d | Email | Mini-encuesta: "¿Cómo está tu pelo este mes?" + CTA suave al quiz |
| T+60d | Email | Última: "Si en algún momento quieres saber qué le pasa a tu pelo, aquí estamos. {link_quiz}" |

**Exit condition:** intent change a `intent:high`, unsubscribe, o T+90d sin engagement → archivar.

---

#### W10 · Reactivación Lost/Cancelled

**Trigger:** Stage `Lost/Cancelled` aplicado + 30 días sin movimiento

**Pasos:**
| Tiempo | Canal | Mensaje |
|---|---|---|
| T+30d | Email | "Hola {firstName}, ha pasado un tiempo. ¿Cómo va tu pelo? Si quieres retomar tu diagnóstico, aquí estamos. {link_quiz}" |
| T+60d | Email | Caso de éxito con perfil similar |
| T+90d | Email | Último intento con oferta especial (si aplica según política comercial) |

---

### 8.3 Mensajes base — tono y guidelines

**Tono general:**
- Cercano, empático, NO comercial agresivo (per feedback Albert sobre tono asesora)
- Primera persona, segundo nombre cuando se conoce
- Sin alarmismo ("se te cae el pelo!!")
- Pone al paciente en control ("cuando estés lista", "si quieres")

**Variables disponibles en todas las plantillas:**
- `{firstName}`, `{lastName}`, `{fullName}`
- `{protocol}` — CRT o HRT (solo en mujeres post-quiz)
- `{ciudad}`
- `{fecha}`, `{hora}` — para citas
- `{link_quiz}`, `{link_calendar}`, `{link_agendar}`, `{link_stripe}`, `{link_microsite_personalizado}`

**Compliance:**
- Todos los emails deben incluir footer LOPD + unsubscribe link
- WhatsApp: opt-out fácil ("Responde STOP para no recibir más mensajes")
- No usar lenguaje médico ("diagnóstico", "te recetamos", etc.) en pre-clínica — solo "pre-recomendación" hasta confirmación médica

---

### 8.4 Pendientes para activar workflows

| Tarea | Owner | Status |
|---|---|---|
| Microsite personalizado `/diagnostico/{leadId}` | Ramiro + Martin | 🔴 No empezado (bloqueante para W4) |
| Webhook GHL appointment → backend para disparar W4 | Ramiro | 🟡 Diseño |
| Webhook Stripe `payment_completed` → GHL `payment_completed` event | Ramiro + Martin | 🟡 Diseño |
| Plantillas de mensaje (WhatsApp + Email) en GHL Templates | Ramiro | 🟡 Por escribir |
| Numbers/identidades WhatsApp para no quemar el principal | Ramiro | 🟢 Decidir si 1 o 2 números |
| Tag automation `intent:low` cuando llega `caida=no` del Meta form | Ramiro | 🟡 GHL workflow simple |
| Stage automations: `Videocall booked`, `No-show`, `Paid`, etc. | Ramiro | 🟡 GHL workflow |

---

## 9. Estado del proyecto

### ✅ DONE (en producción)

| Item | Construido por (histórico) | Owner mantenimiento |
|---|---|---|
| Quiz `/quiz-hospitalcapilar/` con rama mujer (5 preguntas) y hombre (3 preguntas) | Philippe | Ramiro + Martin |
| Scoring CRT/HRT con lógica clínica validada | Philippe + Dr. HC | Ramiro + Martin |
| Pantalla resultado mujer con bloque Hair Pro + disclaimer Tricometabólico | Philippe | Ramiro + Martin |
| CTA mujer → Calendario HC Videollamadas con prefill | Philippe | Ramiro + Martin |
| CTA secundario WhatsApp en mujer y hombre | Philippe | Ramiro + Martin |
| CTA hombre → `/agendar` Koibox existente con `tipo=asesoria` | Philippe | Ramiro + Martin |
| Custom fields GHL `Sexo Lead Form` + `Preocupacion caida` | Philippe | Ramiro |
| URL Meta thank-you con macros `{{form.sexo}}` etc. | Miguel | Miguel |
| Mapping Meta form → GHL contact via integración nativa | Miguel | Miguel + Ramiro |
| Tracking PostHog: `diagnostic_quiz_started/completed/cta_clicked` | Philippe | Martin |
| UTM propagation Meta → quiz → Firestore | Philippe | Ramiro + Martin |
| Deploy a producción (`diagnostico.hospitalcapilar.com/quiz-hospitalcapilar/`) | Philippe | Ramiro + Martin |

### 🟡 IN PROGRESS (esta semana)

| Item | Owner | Bloqueante? |
|---|---|---|
| **Crear stage `Videocall booked` en pipeline GHL UI** | **Ramiro** | 🔴 Sí — antes de campaña |
| **Workflow GHL: appointment booked → mover a `Videocall booked`** | **Ramiro** | 🟡 Recomendado |
| **Workflow GHL: appointment attended → mover a stage adecuada** | **Ramiro** | 🟡 Recomendado |
| **Test E2E con lead real Meta → quiz → calendar** | Miguel envía + **Martin valida** | 🔴 Sí — antes de campaña |
| Descomentar Murcia + Pontevedra en `AgendarPage.jsx` cuando clínicas estén operativas | **Ramiro + Martin** | 🟢 No bloquea Madrid |

### 🟢 PENDING (próximo sprint)

| Item | Owner |
|---|---|
| Conectar GHL custom field submit del quiz (protocolo CRT/HRT → campo nuevo) | **Ramiro + Martin** |
| Webhook backup Meta → backend (no perder leads que no clican thank-you, ~30-40%) | **Ramiro + Martin** |
| **Dashboard funnel completo en `/quiz-hc`** | **Martin** |
| **Validación métricas end-to-end (Meta → PostHog → GHL → Stripe → Koibox)** | **Martin** |
| Eventos PostHog granulares: `diagnostic_quiz_question_answered`, `diagnostic_quiz_landing_viewed` | **Ramiro + Martin** |
| Webhook GHL appointment → PostHog `ghl_appointment_booked` | **Ramiro** |
| Webhook Stripe → PostHog `stripe_payment_completed` con `ghl_contact_id` en metadata | **Ramiro + Martin** |
| Sync Koibox appointment → PostHog `koibox_appointment_created` | **Ramiro + Martin** |

### 🚦 Checklist pre-campaña (antes de gastar €1.800 en Meta)

- [ ] **Ramiro:** stage `Videocall booked` creada en pipeline + workflow asociado
- [ ] **Miguel:** lead form Meta apunta a URL correcta + macros `{{form.sexo/caida/ciudad}}` resueltos
- [ ] **Miguel envía lead de prueba real**
- [ ] **Martin valida E2E:**
  - [ ] GHL contact creado con `Sexo Lead Form`, `Preocupacion caida`, `City` mapeados
  - [ ] Lead llega a `/quiz-hospitalcapilar/?v=...` con todos los params
  - [ ] Firestore `quiz_leads` guarda el lead con UTMs intactos
  - [ ] Quiz completado dispara PostHog event correcto
  - [ ] CTA mujer abre calendar con `first_name/email/phone` prerellenados
  - [ ] Booking en calendar crea evento en Gmail de Noemí
  - [ ] CTA hombre redirige a `/agendar` con prefill correcto
- [ ] Si todos los checks pasan → green light para campaña real
- [ ] Si alguno falla → **Ramiro o Martin arregla + Martin re-valida**

### 🧭 Rol de Philippe — Consultoría estratégica

Philippe queda como **consultor estratégico del proyecto**, NO como owner de tareas operativas:
- Decisiones de funnel y arquitectura
- Validación de roadmap fase 2 (SEO, creadores, escalado)
- Sparring con Óscar, María y Miguel a nivel ejecutivo
- Soporte puntual a Ramiro/Martin si surge bloqueante crítico
- **No es responsable** de PRs, bugs operativos ni deploys del día a día
