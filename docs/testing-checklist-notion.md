# Testing Checklist — Hospital Capilar Quiz

Documento de validación de todos los flujos, nichos, puertas, pagos, integraciones y CTAs.

---

## 1. Quiz Largo (Ruta: `/`)

### 1.1 Carga inicial

- [ ] **[CRÍTICO]** La página carga sin errores en consola
- [ ] **[CRÍTICO]** La URL base funciona: `https://diagnostico.hospitalcapilar.com/`
- [ ] PostHog dispara evento `quiz_viewed`
- [ ] Se muestra la pantalla de bienvenida genérica (sin nicho)

### 1.2 Flujo de preguntas

- [ ] **[CRÍTICO]** Pregunta de sexo (hombre/mujer) se muestra correctamente
    - Esperado: opciones "Hombre" y "Mujer" visibles
- [ ] **[CRÍTICO]** Seleccionar "Hombre" → flujo de preguntas masculinas (entradas, coronilla, patrón masculino)
- [ ] **[CRÍTICO]** Seleccionar "Mujer" → flujo de preguntas femeninas (difuso, línea central, hormonal)
- [ ] Pregunta de edad muestra rangos: 18-25, 26-35, 36-45, 46-55, 56-65, 65+
- [ ] Pregunta de ubicación: Madrid, Murcia, Pontevedra, Otro
- [ ] Pregunta de timeline: <3 meses, 3-12 meses, 1-3 años, 3+ años
- [ ] Pregunta de tratamientos previos (multi-select): minoxidil, finasteride, clínica, trasplante, nada
- [ ] Pregunta visual de patrón de caída muestra imágenes (grid 2 columnas)
- [ ] Botón "Atrás" navega a la pregunta anterior (PostHog: `back_button_clicked`)
- [ ] Barra de progreso avanza correctamente
- [ ] PostHog dispara `question_answered` en cada pregunta

### 1.3 Puerta DERIVACIÓN — Cuero cabelludo

- [ ] **[CRÍTICO]** Si problema = `cuero-cabelludo` → Frame DERIVACION
    - Esperado: pantalla de derivación a dermatología, SIN botón de agendar cita
- [ ] **[CRÍTICO]** Si diagnóstico = `frontal-fibrosante` → Frame DERIVACION
- [ ] **[CRÍTICO]** Si diagnóstico = `areata` → Frame DERIVACION
- [ ] En DERIVACION: NO se envía lead a GHL como oportunidad comercial

### 1.4 Puerta WAITLIST — Fuera de zona

- [ ] **[CRÍTICO]** Si ubicación = `otro` → Frame WAITLIST
    - Esperado: pantalla "Te avisamos cuando abramos en tu zona", campo email, SIN calendario
- [ ] WAITLIST NO muestra calendario de cita
- [ ] Lead de WAITLIST se guarda en GHL con tag `waitlist`

### 1.5 Frame A — HOT (Score ≥60)

- [ ] **[CRÍTICO]** Hombre, Madrid, 3+ años, minoxidil, alto impacto → Score ≥60 → FRAME_A
    - Esperado: CTA verde "Agendar cita ahora", mensajes de urgencia
    - GHL: `lead_priority` = HOT
- [ ] **[CRÍTICO]** CTA de FRAME_A lleva al calendario de Koibox (`/agendar`)

### 1.6 Frame C — WARM (Score 40-60)

- [ ] **[CRÍTICO]** Score entre 40-60 o formato=llamada → FRAME_C
    - Esperado: CTA "Llamarme en 24h", formulario de teléfono
    - GHL: `lead_priority` = WARM

### 1.7 Frame D — COLD (Score <40)

- [ ] **[CRÍTICO]** Score <40 o formato=info → FRAME_D
    - Esperado: CTA "Descargar guía", campo de email, baja presión
    - GHL: `lead_priority` = COLD

### 1.8 Formulario de lead

- [ ] **[CRÍTICO]** Formulario muestra campos: nombre, email, teléfono
- [ ] **[CRÍTICO]** Validación: email formato válido, teléfono con formato correcto
- [ ] **[CRÍTICO]** Submit crea contacto en GHL con datos correctos (nuevo o actualizado)
- [ ] **[CRÍTICO]** Submit crea oportunidad en GHL con score, ECP, door, priority
    - Esperado: oportunidad en pipeline con `monetaryValue=195`, `stageId=New Lead`
- [ ] PostHog: `lead_form_submitted` con `lead_score`
- [ ] Lead guardado en Firebase `quiz_leads`
- [ ] Lead enviado a Salesforce (Web-to-Lead)

### 1.9 Scoring — verificar cálculo

- [ ] **[CRÍTICO]** Timeline 3+ años = +30 puntos
- [ ] Timeline 1-3 años = +20, <3 meses = -15
- [ ] Tratamiento previo: minoxidil/finasteride = +15, clínica = +20, trasplante = +25
- [ ] Ubicación: madrid/murcia/pontevedra = +15, otra España = +5, fuera = -20
- [ ] Impacto alto/crítico = +15
- [ ] Inversión "abierto" = +20, "50-150€"/"150-300€" = +10
- [ ] Score final está en rango 0-100 (normalizado de 0-150)

---

## 2. Quiz Corto / Rápido (Ruta: `/rapido/{nicho}`)

### 2.1 /rapido/jovenes — "El Espejo"

- [ ] **[CRÍTICO]** Carga con bienvenida de nicho → badge "Alopecia Temprana: Actúa Antes"
    - URL: `https://diagnostico.hospitalcapilar.com/rapido/jovenes`
- [ ] **[CRÍTICO]** Tiene 3-5 preguntas (NO el quiz completo)
- [ ] **[CRÍTICO]** ECP asignado = "Joven con alopecia temprana" (verificar en GHL)
- [ ] CTA = `agendar_consulta` (hombre → no bono)

### 2.2 /rapido/mujeres — "Es Normal"

- [ ] **[CRÍTICO]** Carga con bienvenida → badge "Especialistas en Alopecia Femenina"
    - URL: `https://diagnostico.hospitalcapilar.com/rapido/mujeres`
- [ ] **[CRÍTICO]** ECP asignado = "Mujer con caída hormonal"
- [ ] **[CRÍTICO]** CTA = `pagar_bono` → pantalla de pago 195€ antes del calendario

### 2.3 /rapido/postparto — "Lo Que Vino Con el Bebé"

- [ ] **[CRÍTICO]** Carga correctamente: `https://diagnostico.hospitalcapilar.com/rapido/postparto`
- [ ] **[CRÍTICO]** ECP = "Caída postparto"
- [ ] **[CRÍTICO]** CTA = `pagar_bono` (mujer → bono obligatorio)

### 2.4 /rapido/que-me-pasa — "¿Qué Me Pasa?"

- [ ] **[CRÍTICO]** Carga correctamente: `https://diagnostico.hospitalcapilar.com/rapido/que-me-pasa`
- [ ] **[CRÍTICO]** ECP = "Sin diagnóstico gateway"
- [ ] CTA = `solicitar_llamada`

### 2.5 /rapido/segunda-opinion — "Ya Me Engañaron"

- [ ] **[CRÍTICO]** Carga correctamente: `https://diagnostico.hospitalcapilar.com/rapido/segunda-opinion`
- [ ] **[CRÍTICO]** ECP = "Mala experiencia otra clínica"
- [ ] CTA = `solicitar_llamada`

### 2.6 /rapido/farmacia-sin-salida — "La Farmacia Sin Salida"

- [ ] **[CRÍTICO]** Carga correctamente: `https://diagnostico.hospitalcapilar.com/rapido/farmacia-sin-salida`
- [ ] **[CRÍTICO]** ECP = "OTC frustrado sin resultado"
- [ ] CTA = `solicitar_llamada`

### 2.7 /rapido/post-trasplante — "La Inversión"

- [ ] **[CRÍTICO]** Carga correctamente: `https://diagnostico.hospitalcapilar.com/rapido/post-trasplante`
- [ ] **[CRÍTICO]** ECP = "Post-trasplante mantenimiento"
- [ ] CTA = `agendar_consulta`

---

## 3. Form Directo (Ruta: `/form/{nicho}`)

### 3.1 Comportamiento general

- [ ] **[CRÍTICO]** Form directo NO muestra preguntas de quiz — solo formulario de datos (nombre, email, teléfono)
- [ ] **[CRÍTICO]** Form directo siempre resulta en FRAME_A (formato=directo → +25 puntos, lead_priority = HOT)

### 3.2 /form/jovenes

- [ ] **[CRÍTICO]** Carga correctamente con branding "El Espejo"
- [ ] **[CRÍTICO]** Submit → GHL contacto con ECP "Joven con alopecia temprana"

### 3.3 /form/mujeres

- [ ] **[CRÍTICO]** Carga correctamente: `https://diagnostico.hospitalcapilar.com/form/mujeres`
- [ ] **[CRÍTICO]** Submit → CTA `pagar_bono` (mujeres pagan bono) → pantalla de pago 195€

### 3.4 /form/postparto

- [ ] **[CRÍTICO]** Carga correctamente: `https://diagnostico.hospitalcapilar.com/form/postparto`
- [ ] **[CRÍTICO]** Submit → CTA `pagar_bono`

### 3.5 /form/que-me-pasa

- [ ] **[CRÍTICO]** Carga correctamente: `https://diagnostico.hospitalcapilar.com/form/que-me-pasa`
- [ ] Submit → CTA `solicitar_llamada`

### 3.6 /form/farmacia-sin-salida

- [ ] **[CRÍTICO]** Carga correctamente: `https://diagnostico.hospitalcapilar.com/form/farmacia-sin-salida`
- [ ] Submit → CTA `solicitar_llamada`

---

## 4. UTM Parameters

### 4.1 Captura de UTMs

- [ ] **[CRÍTICO]** UTMs se capturan al cargar la página
    - Test: `?utm_source=facebook&utm_medium=paid_social&utm_campaign=quiz-rapido-mujeres&utm_content=ad_test&utm_term=caida_pelo`
- [ ] **[CRÍTICO]** UTMs persisten durante todo el quiz (sessionStorage/localStorage) — navegar entre preguntas NO pierde UTMs

### 4.2 UTMs → GHL

- [ ] **[CRÍTICO]** `utm_source` → campo GHL `MisB9YJJAH7cnh8JOtQn`
- [ ] **[CRÍTICO]** `utm_medium` → campo GHL `vykx7m6bcfbYMXRqToYP`
- [ ] **[CRÍTICO]** `utm_campaign` → campo GHL `3fUI7GO9o7oZ7ddMNnFf`
- [ ] `utm_content` y `utm_term` llegan correctamente
- [ ] `fbclid` y `gclid` se capturan si presentes

### 4.3 UTMs → Firebase

- [ ] UTMs guardados en `quiz_leads.source` en Firebase

### 4.4 UTMs → Salesforce

- [ ] UTMs enviados via Web-to-Lead (`g4u_utm_source`, `g4u_utm_medium`, etc.)

### 4.5 UTMs → PostHog

- [ ] Evento `quiz_started` incluye UTMs como propiedades

### 4.6 Escenarios por canal

- [ ] **[CRÍTICO]** Meta Ads: `utm_source=facebook`, `utm_medium=paid_social`
    - `https://diagnostico.hospitalcapilar.com/rapido/mujeres?utm_source=facebook&utm_medium=paid_social&utm_campaign=quiz-rapido-mujeres&utm_content=ad_test`
- [ ] **[CRÍTICO]** Google Ads: `utm_source=google`, `utm_medium=cpc`, `gclid` presente
    - `https://diagnostico.hospitalcapilar.com/form/jovenes?utm_source=google&utm_medium=cpc&utm_campaign=form-directo-jovenes&gclid=test123`
- [ ] Orgánico: sin UTMs → source queda vacío o "direct"

---

## 5. Pagos — Bono Diagnóstico (Stripe)

### 5.1 Flujo de pago — Mujeres

- [ ] **[CRÍTICO]** Mujeres (mujeres/postparto) ven pantalla de pago con precio 195€
    - Esperado: card con precio, testimonios, objeciones, FAQs, botón Stripe
- [ ] **[CRÍTICO]** Botón de pago abre Stripe Checkout con datos correctos (195€, datos pre-rellenados)
- [ ] **[CRÍTICO]** Metadata de Stripe incluye: `contactId`, `nombre`, `ecp`, `ubicacion`, `source`

### 5.2 Pago exitoso

- [ ] **[CRÍTICO]** Redirect a `https://diagnostico.hospitalcapilar.com/?pago=exito&session_id={ID}`
- [ ] **[CRÍTICO]** Webhook de Stripe actualiza GHL: `tratamiento_status = paid`
- [ ] **[CRÍTICO]** Tag GHL cambia de `bono_pendiente` a `bono_pagado`
- [ ] Después del pago → se muestra calendario para agendar cita

### 5.3 Pago cancelado

- [ ] **[CRÍTICO]** Si usuario cancela pago → redirect a `?pago=cancelado`
- [ ] Lead se mantiene en GHL con tag `bono_pendiente`
- [ ] GHL `tratamiento_status` permanece en `not_paid`

### 5.4 Hombres NO pagan bono

- [ ] **[CRÍTICO]** Nichos masculinos (jovenes, segunda-opinion, farmacia, post-trasplante) NO muestran paywall
    - Esperado: van directo a calendario o llamada, sin pantalla de pago

---

## 6. Koibox — Agendar Cita

### 6.1 Calendario de disponibilidad

- [ ] **[CRÍTICO]** Página `/agendar` carga el calendario correctamente
- [ ] **[CRÍTICO]** Selector de clínica muestra: Madrid, Murcia, Pontevedra
- [ ] **[CRÍTICO]** Al seleccionar clínica → se cargan slots disponibles (30 días, slots de 30 min, 09:00-20:00)
- [ ] Slots ocupados NO se muestran

### 6.2 Creación de cita

- [ ] **[CRÍTICO]** Seleccionar slot → cita creada en Koibox
    - Esperado: `appointmentId` devuelto, servicio = `primera_consulta_diagnostico` (103385)
- [ ] **[CRÍTICO]** Cita aparece en panel de Koibox con datos del paciente
- [ ] **[CRÍTICO]** Lead sincronizado/creado en Koibox (`sync_lead`)

### 6.3 Sync cita → GHL

- [ ] **[CRÍTICO]** Oportunidad GHL se mueve a stage "Booked" (`f9e5c1cf-7701-4883-ac96-f16b3d78c0d5`)
- [ ] **[CRÍTICO]** Campos GHL actualizados: `koibox_booking_id`, `appointment_date`, `appointment_hour`
- [ ] **[CRÍTICO]** Contacto GHL tiene: `fecha_cita`, `hora_cita`, `clinica_cita`
- [ ] Nota añadida a oportunidad GHL con detalles de cita
- [ ] **[CRÍTICO]** Mujeres con cita + pago: tag `bono_pagado`
- [ ] **[CRÍTICO]** Mujeres con cita SIN pago: tag `bono_pendiente`

### 6.4 Sync cita → Firebase

- [ ] Firebase `quiz_leads` actualizado con `appointmentStatus='booked'`

### 6.5 PostHog booking

- [ ] PostHog evento `appointment_booked` disparado

### 6.6 Link de agendar para comercial

- [ ] **[CRÍTICO]** Campo GHL `link_agendar` contiene URL correcta:
    - `https://diagnostico.hospitalcapilar.com/agendar?contactId={id}&nombre={name}&email={email}&phone={phone}`
    - Noemí puede abrir el link y ver calendario pre-rellenado
- [ ] **[CRÍTICO]** Abrir `link_agendar` → `/agendar` lee query params y pre-rellena datos

---

## 7. CRM — GoHighLevel (GHL)

### 7.1 Creación de contacto

- [ ] **[CRÍTICO]** Contacto nuevo creado con: `firstName`, `lastName`, `email`, `phone`
- [ ] **[CRÍTICO]** Si contacto ya existe (mismo email/phone) → se actualiza, no duplica
- [ ] Tag `new_lead` añadido al contacto

### 7.2 Custom fields del contacto

- [ ] **[CRÍTICO]** Campo `ecp` tiene el ECP correcto del nicho (Field ID: `cFIcdJlT9sfnC3KMSwDD`)
- [ ] **[CRÍTICO]** Campo `door` tiene el frame correcto: FRAME_A, FRAME_C, FRAME_D, WAITLIST, DERIVACION (Field ID: `8xnKCjpUh0dWR9EZEKdL`)

### 7.3 Oportunidad

- [ ] **[CRÍTICO]** Oportunidad creada en pipeline `xXCgpUIEizlqdrmGrJkg`, stage New Lead
- [ ] **[CRÍTICO]** `monetaryValue` = 195
- [ ] **[CRÍTICO]** Custom field `lead_priority` = HOT/WARM/COLD según score
- [ ] Campo `agent_message` contiene script completo para comercial
- [ ] Campo `tratamiento_status` = `not_paid` inicialmente

---

## 8. Confirmación 48h y Recordatorios

> **Nota:** Este flujo depende de GHL Workflows (automaciones). Verificar que los workflows estén activos.

### 8.1 Recordatorios

- [ ] **[CRÍTICO]** SMS/email de recordatorio enviado 24h antes de la cita
    - "Tu cita es mañana a las {hora} en HC {clínica}. Confirma aquí: [link]"
- [ ] **[CRÍTICO]** Segundo recordatorio a las 48h si no confirma

### 8.2 Cancelación automática

- [ ] **[CRÍTICO]** Si NO confirma en 48h → cita cancelada en Koibox (slot liberado)
- [ ] Contacto GHL recibe tag `sin_confirmar_48h`
- [ ] Equipo comercial notificado (tarea en GHL)

---

## 9. Pantalla de Resultados — Contenido por ECP

### 9.1 ECP: "Joven con alopecia temprana"

- [ ] Objeciones: "Ya probé minoxidil", "Es muy caro", "No sé si es el momento"
- [ ] 2 testimonios relevantes curados para jóvenes

### 9.2 ECP: "Mujer con caída hormonal"

- [ ] Objeciones: "Mi médico dice estrés", "¿Y si es temporal?", "Ya me hicieron análisis"
- [ ] Contenido incluido: tricoscopía, analítica hormonal, valoración 30 min, plan tratamiento

### 9.3 ECP: "Caída postparto"

- [ ] Objeciones: "Me dicen es normal", "¿Puedo tratarme amamantando?", "Ya se pasará sola"

### 9.4 ECP: "Mala experiencia otra clínica"

- [ ] Objeciones: "Me engañaron una vez", "Todas prometen lo mismo", "No quiero presión"

### 9.5 ECP: "OTC frustrado sin resultado"

- [ ] Objeciones: "Gasté €500+ sin resultado", "Minoxidil no funciona", "Ya no creo en nada"

### 9.6 ECP: "Post-trasplante mantenimiento"

- [ ] Contenido relevante para mantenimiento post-cirugía

### 9.7 ECP: "Sin diagnóstico gateway"

- [ ] Contenido gateway — orientación sin diagnóstico previo

---

## 10. Edge Cases y Errores

### 10.1 Returning lead

- [ ] Si localStorage tiene `hc_quiz_lead` → mostrar "¡Bienvenido de vuelta!"
- [ ] Form pre-rellena nombre/email del lead anterior

### 10.2 Errores de red / API

- [ ] **[CRÍTICO]** Si GHL falla → el quiz NO se rompe, usuario ve mensaje de error amigable
- [ ] **[CRÍTICO]** Si Koibox falla → mensaje de error, opción de reintentar
- [ ] **[CRÍTICO]** Si Stripe falla → usuario puede reintentar pago

### 10.3 Mobile / Responsive

- [ ] **[CRÍTICO]** Quiz funciona correctamente en iPhone (Safari)
- [ ] **[CRÍTICO]** Quiz funciona correctamente en Android (Chrome)
- [ ] Calendario de Koibox es usable en pantalla pequeña
- [ ] Stripe Checkout funciona en móvil

### 10.4 Abandono de quiz

- [ ] PostHog evento `quiz_abandoned` se dispara al salir

### 10.5 Validaciones de formulario

- [ ] **[CRÍTICO]** Email inválido → error visible, NO envía a GHL
- [ ] **[CRÍTICO]** Teléfono inválido → error visible
- [ ] Campos vacíos → botón deshabilitado o error

---

## 11. Escenarios End-to-End (E2E)

> Cada escenario debe ejecutarse de principio a fin, verificando CADA paso en GHL, Koibox, Firebase y PostHog.

### E2E 1: Hombre HOT — Quiz Largo → Agendar → Cita confirmada

- [ ] **[CRÍTICO]** Entrar a `/?utm_source=facebook&utm_medium=paid_social&utm_campaign=quiz-largo-generico`
- [ ] **[CRÍTICO]** Completar: Hombre, 30 años, Madrid, 3+ años, minoxidil, entradas, alto impacto, presencial
    - Esperado: Score ≥60, FRAME_A, ECP genérico
- [ ] **[CRÍTICO]** Rellenar form → Ver CTA "Agendar cita"
- [ ] **[CRÍTICO]** GHL: contacto creado, oportunidad con priority=HOT, UTMs correctos
- [ ] **[CRÍTICO]** Clic en CTA → `/agendar` → seleccionar Madrid → seleccionar slot
- [ ] **[CRÍTICO]** Koibox: cita creada correctamente
- [ ] **[CRÍTICO]** GHL: oportunidad movida a "Booked", campos de cita rellenados

### E2E 2: Mujer — Quiz Rápido "mujeres" → Pagar bono → Agendar

- [ ] **[CRÍTICO]** Entrar a `/rapido/mujeres?utm_source=google&utm_medium=cpc&utm_campaign=quiz-rapido-mujeres`
- [ ] **[CRÍTICO]** Completar quiz corto (3-5 preguntas)
- [ ] **[CRÍTICO]** Form → Ver pantalla de pago 195€ (CTA `pagar_bono`)
- [ ] **[CRÍTICO]** Pagar con Stripe (tarjeta de test: `4242 4242 4242 4242`)
- [ ] **[CRÍTICO]** GHL: `tratamiento_status=paid`, tag `bono_pagado`
- [ ] **[CRÍTICO]** Ver calendario → agendar cita → Koibox nota "BONO PAGADO"

### E2E 3: Mujer postparto — Form Directo → Pago cancelado

- [ ] **[CRÍTICO]** Entrar a `/form/postparto?utm_source=instagram&utm_medium=paid_social`
- [ ] **[CRÍTICO]** Submit form → pantalla de pago
- [ ] **[CRÍTICO]** Cancelar pago en Stripe → redirect a `?pago=cancelado`
- [ ] **[CRÍTICO]** GHL: contacto existe con tag `bono_pendiente`, `tratamiento_status=not_paid`

### E2E 4: Usuario fuera de zona → WAITLIST

- [ ] **[CRÍTICO]** Completar quiz largo, ubicación = "otro" (Barcelona)
- [ ] **[CRÍTICO]** Resultado: WAITLIST, SIN calendario, mensaje "te avisamos"
- [ ] GHL: contacto con tag `waitlist`, `door=WAITLIST`

### E2E 5: Cuero cabelludo → DERIVACIÓN

- [ ] **[CRÍTICO]** Quiz largo, problema = `cuero-cabelludo`
- [ ] **[CRÍTICO]** Resultado: DERIVACION, recomendación dermatología, SIN CTA comercial

### E2E 6: Quiz rápido "farmacia-sin-salida" → Llamada

- [ ] Entrar a `/rapido/farmacia-sin-salida` con UTMs
- [ ] Completar quiz → CTA `solicitar_llamada`
- [ ] GHL: ECP = "OTC frustrado sin resultado", priority correcta

### E2E 7: Comercial usa link_agendar

- [ ] **[CRÍTICO]** Copiar `link_agendar` de GHL → abrir en navegador
    - Esperado: página `/agendar` con datos pre-rellenados del contacto
- [ ] **[CRÍTICO]** Agendar cita desde link → cita vinculada al contacto existente en GHL

---

## 12. PostHog — Analytics Events

### 12.1 Eventos del ciclo de vida

- [ ] `quiz_viewed` al cargar página
- [ ] `quiz_started` al responder primera pregunta
- [ ] `quiz_completed` al terminar todas las preguntas
- [ ] `quiz_abandoned` al salir a mitad de quiz

### 12.2 Eventos de conversión

- [ ] `lead_form_submitted` con `lead_score`
- [ ] `appointment_booked` al confirmar cita
- [ ] `quiz_result` con `ecp`, `score`, `frame`, `device`

---

## Tabla resumen: Nicho × Flujo × CTA

| Nicho | Quiz Largo | Quiz Rápido | Form Directo | ECP | CTA | Bono |
|-------|-----------|-------------|-------------|-----|-----|------|
| jovenes | ✅ `/` | ✅ `/rapido/jovenes` | ✅ `/form/jovenes` | Joven con alopecia temprana | agendar_consulta | NO |
| mujeres | ✅ `/` | ✅ `/rapido/mujeres` | ✅ `/form/mujeres` | Mujer con caída hormonal | pagar_bono | 195€ |
| postparto | ✅ `/` | ✅ `/rapido/postparto` | ✅ `/form/postparto` | Caída postparto | pagar_bono | 195€ |
| que-me-pasa | ✅ `/` | ✅ `/rapido/que-me-pasa` | ✅ `/form/que-me-pasa` | Sin diagnóstico gateway | solicitar_llamada | NO |
| segunda-opinion | ✅ `/` | ✅ `/rapido/segunda-opinion` | — | Mala experiencia otra clínica | solicitar_llamada | NO |
| farmacia-sin-salida | ✅ `/` | ✅ `/rapido/farmacia-sin-salida` | ✅ `/form/farmacia-sin-salida` | OTC frustrado sin resultado | solicitar_llamada | NO |
| post-trasplante | ✅ `/` | ✅ `/rapido/post-trasplante` | — | Post-trasplante mantenimiento | agendar_consulta | NO |

---

## Tabla resumen: Frame × Score × CTA

| Frame | Score | Priority GHL | CTA | Descripción |
|-------|-------|-------------|-----|-------------|
| FRAME_A | ≥60 | HOT | Agendar cita / Pagar bono | Lead caliente, acción inmediata |
| FRAME_C | 40-60 | WARM | Solicitar llamada | Lead tibio, nurturing |
| FRAME_D | <40 | COLD | Descargar guía | Lead frío, contenido educativo |
| WAITLIST | — | — | Te avisamos | Fuera de zona de servicio |
| DERIVACION | — | — | Recomendación dermatología | No es alopecia tratable |
