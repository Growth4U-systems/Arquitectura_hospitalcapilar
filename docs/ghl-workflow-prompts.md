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

> Necesito crear un workflow en GoHighLevel llamado **"W1 — Nurturing por ECP"** para Hospital Capilar, una clínica médica capilar con 4.8★ en Trustpilot.
>
> **TRIGGER:**
> - Tipo: Opportunity Stage Changed
> - Condición: Stage = `New Lead`
> - Pipeline: `Leads HC`
>
> **LÓGICA GENERAL:**
> El workflow se ramifica según el custom field de contacto `ecp`. La secuencia para cada perfil es siempre:
> 1. Notificación interna al comercial para llamar
> 2. WhatsApp personalizado por perfil
> 3. Email personalizado por perfil
> El workflow se detiene si el stage cambia (comercial interviene, lead paga o agenda).
>
> ---
>
> ### RAMA 1 — ECP = "No candidato - cuero cabelludo"
> *(Perfil: problema dermatológico, no capilar. Fuera del funnel comercial.)*
>
> 1. Actualizar `tratamiento_status` = `no_candidate`
> 2. Añadir tag: `no-candidato`
> 3. Enviar Email:
>    - **Asunto:** `{{contact.firstName}}, hemos revisado tu caso`
>    - **Cuerpo:** "Hola {{contact.firstName}}, gracias por confiar en Hospital Capilar. Tras revisar tu diagnóstico, nuestro equipo médico considera que tu caso está más relacionado con el cuero cabelludo que con la caída capilar propiamente dicha. Esto significa que el especialista más adecuado para ti es un dermatólogo. Te adjuntamos una guía con las principales patologías del cuero cabelludo y cómo encontrar al especialista correcto. Si en algún momento la situación cambia o tienes dudas, estaremos aquí. Un saludo, Equipo Médico Hospital Capilar."
> 4. FIN del workflow
>
> ---
>
> ### RAMA 2 — `ubicacion_clinica` = ciudad sin clínica operativa
> *(Ciudades operativas: Madrid, Murcia, Pontevedra. Cualquier otra entra aquí.)*
>
> 1. Actualizar `tratamiento_status` = `waitlist`
> 2. Añadir tag: `waitlist-2026`
> 3. Enviar WhatsApp:
>    - "Hola {{contact.firstName}}, hemos recibido tu diagnóstico capilar. Nos encantaría atenderte en persona, pero aún no tenemos clínica en tu zona. Estamos en plena expansión y abriremos nuevas ubicaciones en 2026. ¿Te apuntamos a la lista de espera para que seas el primero en saberlo cuando abramos cerca de ti? — Hospital Capilar"
> 4. FIN del workflow
>
> ---
>
> ### RAMA 3 — ECP = "Mala experiencia otra clinica" (perfil "Ya Me Engañaron")
> *(Dolor: "Pagué miles de euros y cero resultados. No me fío de nadie." NUNCA ofrecer pago directo en esta rama.)*
>
> 1. Añadir tag: `mala-experiencia`
> 2. Actualizar `tratamiento_status` = `not_paid`
> 3. **Notificación interna al comercial** (prioridad ALTA, vence en 2h):
>    - **Título:** "🔴 LLAMADA PRIORITARIA — Segunda opinión médica"
>    - **Descripción:** "{{contact.firstName}} tuvo una mala experiencia en otra clínica. Score: {{contact.contact_score}}. INSTRUCCIONES: NO ofrecer pago. Escuchar su caso sin interrumpir. Validar su frustración. Ofrecer segunda opinión médica gratuita y sin compromiso. Generar confianza antes que venta. Ciudad: {{contact.ubicacion_clinica}}."
> 4. Esperar 4 horas — [si tarea no completada] →
> 5. Enviar **WhatsApp 1:**
>    - "Hola {{contact.firstName}}, soy [nombre comercial] del equipo de Hospital Capilar. He visto que completaste nuestro diagnóstico y quería presentarme personalmente. Sé que no siempre las experiencias en clínicas capilares son las que uno espera. En Hospital Capilar trabajamos diferente: somos médicos especialistas, no comerciales, y nuestra prioridad es darte un diagnóstico honesto antes de hablar de cualquier tratamiento. ¿Tienes 10 minutos esta semana para una llamada sin compromiso? — Hospital Capilar ⭐ 4.8/5 en Trustpilot"
> 6. Esperar 48 horas — [sin respuesta] →
> 7. Enviar **Email 1:**
>    - **Asunto:** `{{contact.firstName}}, entendemos tu desconfianza — y es completamente normal`
>    - **Cuerpo:** "Hola {{contact.firstName}}, si has tenido una mala experiencia con otra clínica, lo último que necesitas es que te vendan otro tratamiento. Por eso no te voy a vender nada. Solo quiero que sepas que en Hospital Capilar el primer paso siempre es el diagnóstico médico real. Sin diagnóstico, no hay tratamiento. Tenemos 4.8★ en Trustpilot con más de [X] opiniones verificadas porque así es como trabajamos. Si quieres escuchar una segunda opinión médica, totalmente gratuita y sin compromiso, solo dinos cuándo. — Equipo Médico Hospital Capilar"
> 8. Esperar 7 días — [sin respuesta] →
> 9. Enviar **WhatsApp 2** (último intento):
>    - "Hola {{contact.firstName}}, un último mensaje y ya no te molestamos más 🙏 Si algún día quieres una segunda opinión sobre tu caso capilar, aquí estaremos. Sin presión, sin promesas vacías. Solo medicina. — Hospital Capilar"
> 10. Añadir tag: `cold-lead` → FIN
>
> ---
>
> ### RAMA 4 — ECP = "Mujer con caida hormonal" (perfil "Es Normal") + lead_priority = HOT o WARM
> *(Dolor: "El médico me dice que es normal a mi edad. Llevo años con esto y nadie me ayuda.")*
>
> 1. Actualizar `tratamiento_status` = `not_paid`
> 2. **Notificación interna al comercial** (prioridad ALTA, vence en 4h):
>    - **Título:** "Llamar — Mujer hormonal HOT/WARM"
>    - **Descripción:** "{{contact.firstName}} completó el quiz. Perfil: caída hormonal femenina. Score: {{contact.contact_score}}. Ciudad: {{contact.ubicacion_clinica}}. CTA: bono diagnóstico 195€. Mensaje clave: su ginecólogo no es especialista capilar, 4 de cada 10 mujeres lo sufren y tiene solución médica real."
> 3. Esperar 15 minutos →
> 4. Enviar **WhatsApp 1:**
>    - "Hola {{contact.firstName}} 👋 Hemos recibido tu diagnóstico capilar. Lo que describes — caída difusa, cabello más fino, sensación de que no crece — es mucho más frecuente de lo que parece: 4 de cada 10 mujeres lo experimentan en algún momento. Y no, no es normal tener que convivir con ello. En Hospital Capilar hacemos diagnósticos médicos reales para identificar la causa exacta y diseñar un plan personalizado. El bono diagnóstico es de 195€, y si decides seguir con el tratamiento, ese importe se descuenta del precio final. ¿Damos el paso? 👉 [link pago]"
> 5. Esperar 1 hora — [sin pago] →
> 6. Enviar **Email 1:**
>    - **Asunto:** `{{contact.firstName}}, "es normal a tu edad" no es un diagnóstico`
>    - **Cuerpo:** "Hola {{contact.firstName}}, si alguna vez un médico te ha dicho que tu caída de pelo 'es normal a tu edad', te entendemos perfectamente. Es una de las respuestas más frustrantes que puede escuchar una paciente. La realidad es que la caída femenina de origen hormonal tiene causas identificables y tratamientos efectivos. Pero para encontrarlos, necesitas un diagnóstico médico especializado, no una crema de farmacia. En tu consulta diagnóstica (45 min) nuestro médico analizará tu caso, identificará si el origen es hormonal, nutricional o genético, y te presentará un plan personalizado. El coste es de 195€, que se descuentan si continúas con el tratamiento. [BOTÓN: Reservar mi consulta diagnóstica] — Equipo Médico Hospital Capilar"
> 7. Esperar 24 horas — [sin pago] →
> 8. Enviar **WhatsApp 2:**
>    - "Hola {{contact.firstName}}, ¿tienes alguna duda sobre la consulta? Es normal tener preguntas antes de dar el paso. La consulta dura 45 minutos y saldrás con: diagnóstico médico real de tu caso, causas identificadas de tu caída, y un plan de tratamiento personalizado. Todo por 195€ que se descuentan si decides seguir adelante 💙 ¿Quieres que te cuente más antes de decidir?"
> 9. Esperar 3 días — [sin pago] →
> 10. **Notificación interna al comercial:**
>     - **Título:** "Llamar — lleva 3 días sin convertir (hormonal)"
>     - **Descripción:** "{{contact.firstName}} no ha pagado el bono. Score: {{contact.contact_score}}. Posibles objeciones: precio, no cree que tenga solución, está esperando. Resolver objeciones y ayudar a dar el paso."
> 11. Esperar 7 días — [sin pago] →
> 12. Enviar **WhatsApp 3** (último intento):
>     - "Hola {{contact.firstName}}, este es nuestro último mensaje 🙏 Solo queremos que sepas que las plazas para consulta diagnóstica se llenan rápido y solemos tener lista de espera. Si decides dar el paso, aquí estaremos. — Hospital Capilar"
> 13. Añadir tag: `cold-lead` → FIN
>
> ---
>
> ### RAMA 5 — ECP = "Caida postparto" (perfil "Lo Que Vino Con el Bebé") + lead_priority = HOT o WARM
> *(Dolor: "Han pasado 8 meses desde el parto y sigo perdiendo pelo. No sé si es normal o no.")*
>
> 1. Actualizar `tratamiento_status` = `not_paid`
> 2. **Notificación interna al comercial** (prioridad ALTA, vence en 4h):
>    - **Título:** "Llamar — Postparto HOT/WARM"
>    - **Descripción:** "{{contact.firstName}} completó el quiz. Perfil: caída postparto. Score: {{contact.contact_score}}. Ciudad: {{contact.ubicacion_clinica}}. Mensaje clave: si la caída lleva más de 6 meses no es 'normal', tiene solución médica. CTA: bono 195€."
> 3. Esperar 15 minutos →
> 4. Enviar **WhatsApp 1:**
>    - "Hola {{contact.firstName}} 👋 Hemos recibido tu diagnóstico. La caída postparto es de las situaciones más angustiantes porque nadie te avisa de que puede durar tanto. Si llevas más de 6 meses con caída intensa, tu cuerpo te está diciendo que algo necesita atención médica, no solo paciencia. En Hospital Capilar diagnosticamos y tratamos la caída postparto con protocolos médicos específicos. El bono diagnóstico es de 195€ — y si sigues con el tratamiento, ese importe se descuenta del precio final. ¿Empezamos? 👉 [link pago]"
> 5. Esperar 1 hora — [sin pago] →
> 6. Enviar **Email 1:**
>    - **Asunto:** `{{contact.firstName}}, si lleva más de 6 meses, ya no es "normal"`
>    - **Cuerpo:** "Hola {{contact.firstName}}, la caída de pelo tras el parto es habitual, sí. Pero cuando se alarga más de 6 meses, ya no es solo un proceso natural: es una señal de que algo en tu organismo necesita ayuda médica. Puede ser déficit de hierro, alteraciones hormonales postparto o una alopecia que se ha activado con el embarazo. Sin diagnóstico es imposible saberlo, y sin saberlo, ningún tratamiento va a funcionar de verdad. En tu consulta diagnóstica nuestro médico identificará exactamente qué está pasando y te dará un plan concreto. 195€ que se descuentan si decides seguir adelante. [BOTÓN: Quiero mi diagnóstico] — Equipo Médico Hospital Capilar"
> 7. Esperar 24 horas — [sin pago] →
> 8. Enviar **WhatsApp 2:**
>    - "Hola {{contact.firstName}}, muchas mamás nos preguntan si merece la pena la consulta antes de decidir. La respuesta siempre es sí — porque sin saber la causa exacta, cualquier tratamiento es un disparo al aire. En 45 minutos tendrás un diagnóstico médico real y un plan personalizado. ¿Tienes alguna duda antes de dar el paso? Puedes escribirme aquí 💙"
> 9. Esperar 3 días — [sin pago] →
> 10. **Notificación interna al comercial:**
>     - **Título:** "Llamar — Postparto sin convertir (3 días)"
>     - **Descripción:** "{{contact.firstName}} no ha pagado. Score: {{contact.contact_score}}. Posible objeción: precio o dudas sobre si tiene solución. Llamar con tono empático, no comercial."
> 11. Esperar 7 días — [sin pago] →
> 12. Enviar **WhatsApp 3** (último intento):
>     - "Hola {{contact.firstName}}, último mensaje 🙏 Si cuando estés lista quieres saber exactamente qué está pasando con tu pelo, aquí estaremos. Sin lista de espera larga, sin promesas vacías. Solo medicina. — Hospital Capilar"
> 13. Añadir tag: `cold-lead` → FIN
>
> ---
>
> ### RAMA 6 — ECP = "Mujer con caida hormonal" O "Caida postparto" + lead_priority = COLD
> *(Perfil fuera de zona operativa o puntuación muy baja)*
>
> 1. Actualizar `tratamiento_status` = `not_paid`
> 2. **Notificación interna al comercial** (prioridad MEDIA):
>    - **Título:** "Llamar — Mujer/Postparto COLD"
>    - **Descripción:** "{{contact.firstName}} está en {{contact.ubicacion_clinica}}, fuera de zona operativa o con score bajo. Valorar si existe opción de videoconsulta médica online."
> 3. FIN del workflow
>
> ---
>
> ### RAMA 7 — ECP = "Hombre con caida sin diagnostico" (perfil "¿Qué Me Pasa?") + lead_priority = HOT o WARM
> *(Dolor: "¿Es estrés? ¿Es genético? Google me asusta." El 70% del mercado.)*
>
> 1. Actualizar `tratamiento_status` = `free_consult`
> 2. **Notificación interna al comercial** (prioridad ALTA, vence en 4h):
>    - **Título:** "Llamar — Hombre sin diagnóstico HOT/WARM"
>    - **Descripción:** "{{contact.firstName}} no sabe qué le pasa. Score: {{contact.contact_score}}. Ciudad: {{contact.ubicacion_clinica}}. CTA: consulta gratuita. Mensaje clave: sin diagnóstico no se puede saber si tiene solución, y la mayoría sí la tiene si se actúa a tiempo."
> 3. Esperar 15 minutos →
> 4. Enviar **WhatsApp 1:**
>    - "Hola {{contact.firstName}} 👋 Hemos visto tu diagnóstico capilar. La buena noticia: sin un diagnóstico médico real es imposible saber exactamente qué está pasando — y eso significa que muchos casos que parecen graves tienen solución cuando se tratan correctamente. Te hemos reservado una consulta médica gratuita con nuestros especialistas en {{contact.ubicacion_clinica}}. Sin coste, sin compromiso. ¿Cuándo te viene bien que te llamemos para agendarla? — Hospital Capilar"
> 5. Esperar 24 horas — [sin respuesta ni gestión comercial] →
> 6. Enviar **Email 1:**
>    - **Asunto:** `{{contact.firstName}}, ¿estrés, genética o algo más? Solo hay una forma de saberlo`
>    - **Cuerpo:** "Hola {{contact.firstName}}, la caída de pelo masculina tiene múltiples causas: genética, estrés, déficits nutricionales, problemas hormonales, o una combinación de todas ellas. Sin un diagnóstico médico especializado, es imposible saber cuál es tu caso — y sin saberlo, cualquier tratamiento que pruebes es un disparo al aire. En Hospital Capilar ofrecemos una consulta diagnóstica gratuita donde nuestro médico especialista analizará tu caso, identificará la causa real y te dirá qué opciones tienes. Sin venta, sin presión. Solo información médica real. [BOTÓN: Quiero mi consulta gratuita] — Equipo Médico Hospital Capilar"
> 7. Esperar 3 días — [sin gestión comercial] →
> 8. **Notificación interna al comercial:**
>     - **Título:** "Segundo intento — Hombre sin gestionar (3 días)"
>     - **Descripción:** "{{contact.firstName}} lleva 3 días sin ser contactado. Score: {{contact.contact_score}}. Perfil muy común, alta probabilidad de conversión si se contacta. Intentar de nuevo."
> 9. Esperar 7 días — [sin gestión] →
> 10. Añadir tag: `cold-lead` → FIN
>
> ---
>
> ### RAMA 8 — ECP = "Joven con alopecia temprana" (perfil "El Espejo") + lead_priority = HOT o WARM
> *(Dolor: "Tengo 24 años y cada mañana veo las entradas. Me da pánico quedarme calvo.")*
>
> 1. Actualizar `tratamiento_status` = `free_consult`
> 2. **Notificación interna al comercial** (prioridad ALTA, vence en 4h):
>    - **Título:** "Llamar — Joven alopecia temprana HOT/WARM"
>    - **Descripción:** "{{contact.firstName}}, perfil joven con alopecia temprana. Score: {{contact.contact_score}}. Ciudad: {{contact.ubicacion_clinica}}. Mensaje clave: actuar ahora frena la caída, esperar la acelera. CTA: consulta gratuita."
> 3. Esperar 15 minutos →
> 4. Enviar **WhatsApp 1:**
>    - "Hola {{contact.firstName}} 👋 Hemos recibido tu diagnóstico. Si estás notando caída a tu edad, lo más importante que puedes hacer es actuar ahora — no esperar. La alopecia temprana se frena mucho mejor en las primeras fases. Cuanto más tarde en diagnosticarse, menos opciones hay. Por eso queremos ofrecerte una consulta médica gratuita con nuestros especialistas. Sin coste, sin compromiso. Solo para saber exactamente qué está pasando y qué puedes hacer. ¿Te llamamos esta semana? — Hospital Capilar"
> 5. Esperar 24 horas — [sin respuesta] →
> 6. Enviar **Email 1:**
>    - **Asunto:** `{{contact.firstName}}, actuar ahora puede cambiarlo todo`
>    - **Cuerpo:** "Hola {{contact.firstName}}, detectar la alopecia a tu edad es, aunque no lo parezca, una ventaja enorme. En las primeras fases de caída los tratamientos son mucho más efectivos y los resultados, más rápidos. La mayoría de pacientes que esperan años antes de consultar tienen muchas menos opciones que los que actúan pronto. En Hospital Capilar trabajamos con jóvenes como tú con protocolos médicos específicos para alopecia de inicio temprano. La primera consulta es gratuita y sin ningún tipo de compromiso. [BOTÓN: Reservar consulta gratuita] — Equipo Médico Hospital Capilar"
> 7. Esperar 3 días — [sin gestión] →
> 8. **Notificación interna al comercial:**
>     - **Título:** "Segundo intento — Joven sin gestionar (3 días)"
>     - **Descripción:** "{{contact.firstName}} lleva 3 días sin contactar. Perfil joven con alta motivación. Score: {{contact.contact_score}}. Alta probabilidad de conversión."
> 9. Esperar 7 días → Añadir tag: `cold-lead` → FIN
>
> ---
>
> ### RAMA 9 — ECP = "Post-trasplante mantenimiento" (perfil "La Inversión") + lead_priority = HOT o WARM
> *(Dolor: "Me operé en Turquía y nadie me dijo que tenía que hacer mantenimiento. El pelo nativo sigue cayendo.")*
>
> 1. Actualizar `tratamiento_status` = `free_consult`
> 2. **Notificación interna al comercial** (prioridad ALTA, vence en 4h):
>    - **Título:** "Llamar — Post-trasplante HOT/WARM"
>    - **Descripción:** "{{contact.firstName}} se operó (posiblemente en el extranjero) y no recibe mantenimiento. Score: {{contact.contact_score}}. Ciudad: {{contact.ubicacion_clinica}}. Mensaje clave: el trasplante no detiene la caída del pelo nativo, el mantenimiento es esencial para proteger la inversión. CTA: revisión gratuita."
> 3. Esperar 15 minutos →
> 4. Enviar **WhatsApp 1:**
>    - "Hola {{contact.firstName}} 👋 Hemos visto tu diagnóstico. Si te hiciste un trasplante capilar y no estás siguiendo un protocolo de mantenimiento médico, el pelo nativo que no se trasplantó sigue su proceso de caída — y eso puede comprometer el resultado de la operación con el tiempo. En Hospital Capilar hacemos revisiones post-trasplante gratuitas para evaluar el estado actual de tu cabello nativo y trasplantado, y diseñar el protocolo de mantenimiento adecuado para proteger tu inversión. ¿Te llamamos esta semana? — Hospital Capilar"
> 5. Esperar 24 horas — [sin respuesta] →
> 6. Enviar **Email 1:**
>    - **Asunto:** `{{contact.firstName}}, el trasplante fue el primer paso — el mantenimiento es lo que protege el resultado`
>    - **Cuerpo:** "Hola {{contact.firstName}}, un trasplante capilar es una inversión importante. Pero lo que muchas clínicas no explican antes de operar es que el trasplante no detiene la caída del pelo nativo. Sin un protocolo de mantenimiento médico, el cabello que no se trasplantó sigue cayendo — y eso puede arruinar el resultado visual de la operación a largo plazo. En Hospital Capilar hacemos revisiones post-trasplante gratuitas. En esa visita evaluamos el estado de tu cuero cabelludo, el resultado del trasplante y diseñamos el protocolo de mantenimiento específico para tu caso. [BOTÓN: Reservar revisión gratuita] — Equipo Médico Hospital Capilar"
> 7. Esperar 3 días — [sin gestión] →
> 8. **Notificación interna al comercial:**
>     - **Título:** "Segundo intento — Post-trasplante sin gestionar"
>     - **Descripción:** "{{contact.firstName}} lleva 3 días sin contactar. Alto valor potencial (ticket €1K-4K/año). Score: {{contact.contact_score}}. Intentar de nuevo."
> 9. Esperar 7 días → Añadir tag: `cold-lead` → FIN
>
> ---
>
> ### RAMA 10 — ECP = "Hombre / Joven / Post-trasplante" + lead_priority = COLD
>
> 1. Actualizar `tratamiento_status` = `free_consult`
> 2. **Notificación interna al comercial** (prioridad BAJA):
>    - **Título:** "Llamar — Perfil masculino COLD"
>    - **Descripción:** "{{contact.firstName}} está en {{contact.ubicacion_clinica}}, fuera de zona operativa o con score bajo. Perfil: {{contact.ecp}}. Valorar desplazamiento o consulta online."
> 3. FIN del workflow
>
> ---
>
> **CONDICIÓN DE PARADA GLOBAL:**
> Si en cualquier punto el stage de la oportunidad cambia (comercial actualiza, lead paga o agenda), el workflow se detiene automáticamente para ese contacto.

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
