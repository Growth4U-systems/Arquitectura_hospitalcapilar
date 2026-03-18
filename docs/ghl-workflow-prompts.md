# GHL Workflow Prompts — Hospital Capilar
> Prompts listos para usar en el asistente IA de GoHighLevel Workflows.
> Usar uno por uno, en orden. Revisar resultado antes de activar.

---

## PROMPT 0 — Configuración previa (Pipeline + Tags + Custom Fields)

> Antes de crear los workflows necesito configurar la base en GoHighLevel para Hospital Capilar, una clínica médica capilar.
>
> **1. Pipeline a crear:**
> Nombre: `Leads HC`
> Stages en orden:
> - New Lead
> - Contacted
> - Booked
> - Reminder Sent
> - Attended
> - Won
> - No-Show
> - Lost
>
> **2. Tags a crear:**
> - `pago_195` — lead pagó bono diagnóstico 195€
> - `pago_70` — lead pagó bono reducido 70€ (test A/B)
> - `mala-experiencia` — segunda opinión, nunca ofrecer pago directo
> - `no-candidato` — derivación a dermatología, fuera del funnel comercial
> - `waitlist-2026` — ciudad sin clínica operativa, campaña futura
> - `cold-lead` — sin respuesta tras secuencia completa de nurturing
>
> **3. Custom Fields de Oportunidad a crear:**
>
> | Nombre | Tipo | Opciones |
> |---|---|---|
> | `tratamiento_status` | Dropdown | not_paid / paid_195 / paid_70 / refunded |
> | `lead_priority` | Dropdown | HOT / WARM / COLD |
> | `fecha_cita` | Date | — |
> | `hora_cita` | Single Line Text | — |
> | `koibox_booking_id` | Single Line Text | — |
> | `motivo_perdida` | Dropdown | precio / sin_respuesta / no_candidato / otra_clinica / no_contesta |
>
> **4. Custom Fields de Contacto ya existentes (no duplicar):**
> - `ecp` — clasificación del paciente
> - `contact_score` — puntuación numérica 0-100
> - `lead_priority` — HOT / WARM / COLD
> - `ubicacion_clinica` — ciudad del lead
> - `door` — canal de entrada (quiz_largo / quiz_corto / form)
>
> Dame confirmación de qué crear y en qué orden hacerlo.

---

## PROMPT 1 — Workflow de Nurturing por Perfil Clínico (W1)

> Necesito crear un workflow en GoHighLevel llamado **"W1 — Nurturing por ECP"** para Hospital Capilar, una clínica médica capilar.
>
> **TRIGGER:**
> - Tipo: Opportunity Stage Changed
> - Condición: Stage = `New Lead`
> - Pipeline: `Leads HC`
>
> **LÓGICA GENERAL:**
> El workflow debe ramificarse según el custom field de contacto `ecp` (clasificación del paciente). Cada rama tiene un comportamiento distinto. El workflow se detiene si el stage cambia a cualquier otro valor (el comercial interviene o el lead paga).
>
> ---
>
> **RAMA 1 — ECP = "No candidato - cuero cabelludo"**
>
> Acciones:
> 1. Actualizar custom field oportunidad `tratamiento_status` = `no_candidate`
> 2. Añadir tag: `no-candidato`
> 3. Enviar email:
>    - Asunto: `Tu caso, {{contact.firstName}} — te orientamos`
>    - Cuerpo: Mensaje empático explicando que su caso es dermatológico, no capilar. Incluir enlace a artículo educativo sobre dermatología del cuero cabelludo. Firmar como equipo de Hospital Capilar.
> 4. FIN del workflow
>
> ---
>
> **RAMA 2 — Campo contacto `ubicacion_clinica` = ciudad sin clínica operativa**
> (Ciudades operativas: Madrid, Murcia, Pontevedra. Cualquier otra ciudad entra en esta rama)
>
> Acciones:
> 1. Actualizar custom field oportunidad `tratamiento_status` = `waitlist`
> 2. Añadir tag: `waitlist-2026`
> 3. Enviar WhatsApp:
>    - Mensaje: "Hola {{contact.firstName}} 👋 Hemos recibido tu diagnóstico. Aunque aún no tenemos clínica en tu ciudad, estamos en expansión y abriremos nuevas ubicaciones en 2026. ¿Te apuntamos a la lista de espera para que seas el primero en saberlo? — Equipo Hospital Capilar"
> 4. FIN del workflow
>
> ---
>
> **RAMA 3 — ECP = "Mala experiencia otra clinica"**
>
> Acciones:
> 1. Añadir tag: `mala-experiencia`
> 2. Actualizar custom field oportunidad `tratamiento_status` = `not_paid`
> 3. Crear tarea al comercial (prioridad alta, vence en 2h):
>    - Título: "🔴 LLAMADA PRIORITARIA — Segunda opinión"
>    - Descripción: "{{contact.firstName}} tuvo una mala experiencia en otra clínica. NUNCA ofrecer pago directo. El objetivo de esta llamada es generar confianza, escuchar su caso y ofrecerle una consulta gratuita. Score: {{contact.contact_score}}. ECP: {{contact.ecp}}."
> 4. Esperar 48 horas
> 5. Condición: si la tarea sigue sin completarse →
>    - Enviar WhatsApp: "Hola {{contact.firstName}}, entendemos que no todas las experiencias en clínicas capilares son iguales. En Hospital Capilar queremos que conozcas nuestro enfoque médico antes de tomar cualquier decisión. Te hemos preparado una guía sobre qué preguntar antes de elegir clínica. ¿Te la enviamos? — Equipo Hospital Capilar"
> 6. Esperar 7 días
> 7. Enviar WhatsApp de seguimiento suave: "Hola {{contact.firstName}}, ¿pudimos resolver tus dudas? Seguimos aquí cuando quieras hablar con nuestro equipo médico."
> 8. FIN del workflow
>
> ---
>
> **RAMA 4 — ECP = "Mujer con caida hormonal" O ECP = "Caida postparto" + lead_priority = HOT o WARM**
>
> Acciones:
> 1. Actualizar custom field oportunidad `tratamiento_status` = `not_paid`
> 2. Esperar 10 minutos
> 3. Enviar WhatsApp 1:
>    - "Hola {{contact.firstName}} 👋 Acabamos de recibir tu diagnóstico capilar. Según tu perfil, el siguiente paso es reservar tu consulta diagnóstica con nuestros médicos especialistas. Por solo 195€ obtienes un diagnóstico completo personalizado — y si decides continuar con el tratamiento, ese importe se descuenta del precio final. ¿Damos el paso? 👉 [link pago]"
> 4. Esperar 1 hora — Condición: si no ha pagado (tratamiento_status sigue en not_paid) →
> 5. Enviar Email 1:
>    - Asunto: "{{contact.firstName}}, esto es lo que incluye tu consulta diagnóstica"
>    - Cuerpo: Detallar qué incluye la consulta (diagnóstico médico, análisis capilar, plan personalizado). Incluir testimonio real de paciente con perfil similar (mujer con caída hormonal o postparto). CTA claro para pagar el bono 195€. Firma médica de Hospital Capilar.
> 6. Esperar 24 horas — Condición: si no ha pagado →
> 7. Enviar WhatsApp 2:
>    - "Hola {{contact.firstName}}, ¿tienes alguna duda sobre la consulta diagnóstica? Muchas pacientes nos preguntan qué pasa exactamente en esa primera visita. En 45 minutos saldrás con un diagnóstico médico real, las causas de tu caída identificadas y un plan de tratamiento personalizado. Todo por 195€ que se descuentan si sigues adelante 💙"
> 8. Esperar 3 días — Condición: si no ha pagado →
> 9. Crear tarea al comercial:
>    - Título: "Llamar — lleva 3 días sin convertir"
>    - Descripción: "{{contact.firstName}} completó el quiz pero no ha pagado el bono diagnóstico. Perfil: {{contact.ecp}}. Score: {{contact.contact_score}}. Ciudad: {{contact.ubicacion_clinica}}. Objetivo: resolver objeciones y ayudar a dar el paso."
> 10. Esperar 7 días — Condición: si no ha pagado →
> 11. Enviar WhatsApp 3 (último intento):
>     - "Hola {{contact.firstName}}, no queremos ser pesados — este es nuestro último mensaje 🙏 Solo queremos que sepas que las plazas para consulta diagnóstica son limitadas y solemos tener lista de espera. Si en algún momento decides dar el paso, estaremos aquí. — Equipo Hospital Capilar"
> 12. Esperar 7 días — Sin respuesta →
> 13. Añadir tag: `cold-lead`
> 14. FIN del workflow
>
> ---
>
> **RAMA 5 — ECP = "Mujer con caida hormonal" O ECP = "Caida postparto" + lead_priority = COLD**
>
> Acciones:
> 1. Actualizar custom field oportunidad `tratamiento_status` = `not_paid`
> 2. Crear tarea al comercial (prioridad media):
>    - Título: "Llamar — ciudad fuera de zona operativa"
>    - Descripción: "{{contact.firstName}} completó el quiz pero está en una ciudad sin clínica operativa ({{contact.ubicacion_clinica}}). Valorar si existe opción de consulta online o videollamada médica."
> 3. FIN del workflow
>
> ---
>
> **RAMA 6 — ECP = "Hombre con caida sin diagnostico" O "Joven con alopecia temprana" O "Post-trasplante mantenimiento" + lead_priority = HOT o WARM**
>
> Acciones:
> 1. Actualizar custom field oportunidad `tratamiento_status` = `free_consult`
> 2. Crear tarea al comercial (prioridad alta, vence en 4h):
>    - Título: "Agendar consulta gratuita"
>    - Descripción: "{{contact.firstName}} tiene perfil {{contact.ecp}}. Score: {{contact.contact_score}}. Clínica más cercana: {{contact.ubicacion_clinica}}. Llamar para agendar su consulta gratuita en Koibox."
> 3. Esperar 10 minutos
> 4. Enviar WhatsApp 1:
>    - "Hola {{contact.firstName}} 👋 Hemos analizado tu caso y según tu diagnóstico capilar tienes acceso a una consulta médica gratuita con nuestros especialistas. Sin compromiso, sin coste. Solo necesitas reservar tu hueco. ¿Cuándo te viene bien? Nuestro equipo te está esperando — Equipo Hospital Capilar"
> 5. Esperar 24 horas — Condición: si la tarea no está completada →
> 6. Enviar WhatsApp 2:
>    - "Hola {{contact.firstName}}, ¿pudiste hablar con nuestro equipo? Queremos asegurarnos de que tienes toda la información sobre tu caso antes de que tomes ninguna decisión. La consulta es completamente gratuita y sin ningún tipo de compromiso 🙌"
> 7. Esperar 3 días — Condición: si la tarea no está completada →
> 8. Crear segunda tarea al comercial:
>    - Título: "Segundo intento — sin gestionar"
>    - Descripción: "{{contact.firstName}} lleva 3 días sin ser contactado. Perfil: {{contact.ecp}}. Intentar de nuevo."
> 9. Esperar 7 días — Sin gestión →
> 10. Añadir tag: `cold-lead`
> 11. FIN del workflow
>
> ---
>
> **RAMA 7 — ECP = "Hombre con caida sin diagnostico" O "Joven con alopecia temprana" O "Post-trasplante mantenimiento" + lead_priority = COLD**
>
> Acciones:
> 1. Actualizar custom field oportunidad `tratamiento_status` = `free_consult`
> 2. Crear tarea al comercial (prioridad baja):
>    - Título: "Llamar — ciudad fuera de zona operativa"
>    - Descripción: "{{contact.firstName}} tiene perfil {{contact.ecp}} pero está en {{contact.ubicacion_clinica}}, fuera de zona operativa. Evaluar si puede desplazarse o si tiene sentido ofrecer consulta online."
> 3. FIN del workflow
>
> ---
>
> **CONDICIÓN DE PARADA GLOBAL:**
> Si en cualquier punto el stage de la oportunidad cambia (el comercial actualiza manualmente o llega un webhook de pago o booking), el workflow debe detenerse para ese contacto.

---

## PROMPT 2 — Workflow Post-Pago Sin Agendar (W2)

> Necesito crear un workflow en GoHighLevel llamado **"W2 — Post-pago sin agendar"** para Hospital Capilar.
>
> **TRIGGER:**
> - Tipo: Tag Added
> - Condición: Tag = `pago_195` OR Tag = `pago_70`
>
> **OBJETIVO:**
> El lead acaba de pagar el bono diagnóstico (195€ o 70€). Hay que asegurarse de que agenda su cita en Koibox. Si no agenda en 48h, el comercial interviene.
>
> **ACCIONES:**
>
> 1. Condición: si tag añadido = `pago_195` →
>    - Actualizar custom field oportunidad `tratamiento_status` = `paid_195`
>    Condición: si tag añadido = `pago_70` →
>    - Actualizar custom field oportunidad `tratamiento_status` = `paid_70`
>
> 2. Enviar WhatsApp inmediato (confirmación de pago):
>    - "¡Hola {{contact.firstName}}! 🎉 Hemos recibido tu pago correctamente. Ya tienes reservado tu bono de consulta diagnóstica con Hospital Capilar. El siguiente paso es elegir la fecha y clínica que más te convenga. Aquí tienes tu enlace personal para agendar: [link Koibox] Tienes disponibilidad en Madrid, Murcia y Pontevedra. Si necesitas ayuda para elegir, responde a este mensaje y te ayudamos 💙"
>
> 3. Esperar 24 horas
>
> 4. Condición: si custom field `koibox_booking_id` está vacío →
>    - Enviar WhatsApp recordatorio:
>    - "Hola {{contact.firstName}}, vemos que aún no has agendado tu cita. No te preocupes, tienes tiempo. Cuando estés lista, aquí tienes el enlace: [link Koibox] Si tienes alguna duda sobre las clínicas o los horarios, escríbenos aquí mismo 🙌"
>
> 5. Esperar 24 horas adicionales
>
> 6. Condición: si custom field `koibox_booking_id` sigue vacío →
>    - Crear tarea al comercial (prioridad alta):
>      - Título: "🔴 Pagó pero no agendó — contactar hoy"
>      - Descripción: "{{contact.firstName}} pagó el bono diagnóstico hace 48h pero no ha agendado su cita en Koibox. Llamar o escribir por WhatsApp para ayudarle a elegir fecha y clínica. No dejar pasar más tiempo."
>
> 7. FIN del workflow
>    (Cuando Koibox confirme la cita, el stage cambiará a Booked y W3 arrancará automáticamente)

---

## PROMPT 3 — Workflow Recordatorio de Cita (W3)

> Necesito crear un workflow en GoHighLevel llamado **"W3 — Recordatorio de cita"** para Hospital Capilar.
>
> **TRIGGER:**
> - Tipo: Opportunity Stage Changed
> - Condición: Stage = `Booked`
> - Pipeline: `Leads HC`
>
> **OBJETIVO:**
> Confirmar la cita al paciente en el momento en que se agenda y enviar recordatorios antes de la visita para reducir el no-show al máximo.
>
> **VARIABLES USADAS:**
> - `{{opportunity.fecha_cita}}` — fecha de la cita
> - `{{opportunity.hora_cita}}` — hora de la cita
> - `{{opportunity.clinica_asignada}}` — clínica donde se atiende
> - `{{contact.firstName}}` — nombre del paciente
>
> **ACCIONES:**
>
> 1. Enviar WhatsApp inmediato (confirmación de cita):
>    - "¡Hola {{contact.firstName}}! ✅ Tu cita en Hospital Capilar está confirmada.
>      📅 Fecha: {{opportunity.fecha_cita}}
>      🕐 Hora: {{opportunity.hora_cita}}
>      📍 Clínica: {{opportunity.clinica_asignada}}
>      En tu consulta diagnóstica nuestro médico analizará tu caso en detalle, identificará las causas de tu caída y te presentará un plan personalizado. Puedes venir tranquilo/a, dura aproximadamente 45 minutos. ¿Tienes alguna duda antes de la cita? Escríbenos aquí 💙"
>
> 2. Esperar hasta [fecha_cita - 24 horas]
>
> 3. Enviar WhatsApp recordatorio completo:
>    - "Hola {{contact.firstName}} 👋 Te recordamos que mañana tienes tu consulta diagnóstica en Hospital Capilar.
>      🕐 Hora: {{opportunity.hora_cita}}
>      📍 Clínica: {{opportunity.clinica_asignada}}
>      Para aprovechar al máximo la consulta te recomendamos:
>      • Venir con el cabello limpio y seco
>      • Traer analíticas recientes si las tienes
>      • Anotar desde cuándo notas la caída y si has tomado algún tratamiento antes
>      ¡Nos vemos mañana! 💙 — Equipo Hospital Capilar"
>
> 4. Actualizar Stage → `Reminder Sent`
>
> 5. Esperar hasta [fecha_cita - 2 horas]
>
> 6. Enviar WhatsApp recordatorio breve:
>    - "Hola {{contact.firstName}}, te esperamos hoy a las {{opportunity.hora_cita}} en {{opportunity.clinica_asignada}}. ¡Hasta ahora! 💙"
>
> 7. FIN del workflow
>    (Tras la cita, el comercial actualiza manualmente el stage a Attended, Won, No-Show o Lost)

---

## PROMPT 4 — Workflow Recuperación No-Show (W4)

> Necesito crear un workflow en GoHighLevel llamado **"W4 — Recuperación No-Show"** para Hospital Capilar.
>
> **TRIGGER:**
> - Tipo: Opportunity Stage Changed
> - Condición: Stage = `No-Show`
> - Pipeline: `Leads HC`
>
> **OBJETIVO:**
> Recuperar pacientes que no aparecieron a su cita. El tono debe ser siempre empático, sin reproches. El objetivo es reagendar, no presionar.
>
> **ACCIONES:**
>
> 1. Esperar 1 hora
>
> 2. Enviar WhatsApp empático:
>    - "Hola {{contact.firstName}}, hoy teníamos tu consulta en Hospital Capilar y no pudiste venir. Esperamos que todo esté bien 🙏 Si surgió algo, no te preocupes. Cuando quieras retomarlo, con mucho gusto te buscamos otro hueco. Solo dinos cuándo te viene bien y lo gestionamos."
>
> 3. Esperar 24 horas
>
> 4. Condición: sin respuesta del contacto →
>    - Crear tarea al comercial:
>      - Título: "Llamar — No-Show, intentar reagendar"
>      - Descripción: "{{contact.firstName}} no apareció a su cita del {{opportunity.fecha_cita}} en {{opportunity.clinica_asignada}}. Llamar con tono empático. No presionar. Objetivo: reagendar. Si no quiere, marcar como Lost con motivo."
>
> 5. Esperar 3 días
>
> 6. Condición: sin respuesta y stage sigue en No-Show →
>    - Enviar WhatsApp segunda oportunidad:
>      - "Hola {{contact.firstName}}, queríamos darte una última oportunidad de reagendar tu consulta diagnóstica. Tenemos disponibilidad esta semana en nuestras clínicas de Madrid, Murcia y Pontevedra. Si quieres reservar tu hueco, escríbenos o llámanos directamente. Estaremos encantados de atenderte 💙 — Equipo Hospital Capilar"
>
> 7. Esperar 7 días
>
> 8. Condición: sin respuesta y stage sigue en No-Show →
>    - Añadir tag: `cold-lead`
>    - FIN del workflow
>
> **NOTA IMPORTANTE:**
> Si el contacto responde en cualquier momento y se reagenda → el comercial cambia el stage a Booked → W3 se dispara automáticamente.
