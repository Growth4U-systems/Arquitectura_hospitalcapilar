// ============================================
// SHARED NICHO CONFIGURATIONS
// Used by both NichoLanding (quiz) and DirectFormLanding (form)
// ============================================

export const NICHOS = {
  mujeres: {
    slug: 'mujeres',
    door: 'landing_mujeres',
    badge: 'Especialistas en Alopecia Femenina',
    headline: '¿Tu pelo pierde densidad y nadie te da una respuesta clara?',
    subheadline: 'El 40% de las mujeres sufre pérdida de pelo. Cruzamos tu perfil hormonal con un estudio capilar completo para encontrar la causa real.',
    ctaQuiz: 'Descubre qué le pasa a tu pelo',
    ctaForm: 'SOLICITAR VALORACIÓN',
    ecp: 'Es Normal',
    stats: [
      { value: '40%', label: 'de mujeres sufren caída capilar' },
      { value: '80%', label: 'mal diagnosticadas la primera vez' },
      { value: '30 min', label: 'diagnóstico integral completo' },
    ],
    painPoints: [
      '¿Notas que se te ve el cuero cabelludo?',
      '¿Llevas meses probando champús y suplementos sin resultado?',
      '¿Te dijeron que "es normal" pero tú sabes que no lo es?',
      '¿Crees que puede ser hormonal pero nadie lo ha evaluado?',
    ],
    testimonials: [
      { name: 'Laura M.', age: 34, text: 'Llevaba 2 años con caída y nadie encontraba la causa. En Hospital Capilar descubrieron que era hormonal. Ahora estoy recuperando densidad.', stars: 5 },
      { name: 'Patricia G.', age: 41, text: 'Después del embarazo no paraba de caer. Me hicieron una analítica completa cruzada con tricoscopía. Por fin un diagnóstico real.', stars: 5 },
    ],
    solution: 'Somos el único centro que cruza dermatología capilar con endocrinología. Tu pelo y tus hormonas están conectados — y nadie los mira juntos.',
    faqs: [
      { q: '¿Es normal que se me caiga el pelo?', a: 'Perder entre 50-100 cabellos al día es normal. Si notas que pierdes más, se te ven claros, o el pelo no crece como antes, es momento de hacer un diagnóstico profesional.' },
      { q: '¿La caída por hormonas tiene solución?', a: 'En la mayoría de casos, sí. Pero necesitamos una analítica hormonal cruzada con un estudio capilar para identificar la causa exacta y diseñar el tratamiento correcto.' },
      { q: '¿Qué incluye la valoración?', a: 'Tricoscopía digital (microscopio capilar), revisión de tu historial hormonal, valoración médica personalizada y plan de acción. Todo en 30 minutos.' },
      { q: '¿Me van a intentar vender algo?', a: 'No. Nuestros médicos te diagnostican y te explican tus opciones. Si no necesitas tratamiento, te lo decimos. Sin presión comercial.' },
    ],
    tags: ['nicho-mujeres'],
  },

  jovenes: {
    slug: 'jovenes',
    door: 'landing_jovenes',
    badge: 'Alopecia Temprana: Actúa Antes',
    headline: '¿Notas que tus entradas retroceden antes de tiempo?',
    subheadline: 'La alopecia a los 18-28 años es más común de lo que piensas. Cuanto antes actúes, más pelo conservas. Un diagnóstico a tiempo cambia todo.',
    ctaQuiz: 'Evalúa tu caso en 3 minutos',
    ctaForm: 'SOLICITAR VALORACIÓN GRATUITA',
    ecp: 'El Espejo',
    stats: [
      { value: '25%', label: 'de hombres notan caída antes de los 25' },
      { value: '95%', label: 'de éxito si se trata a tiempo' },
      { value: '3 min', label: 'para saber dónde estás' },
    ],
    painPoints: [
      '¿Las entradas cada vez más atrás?',
      '¿Tu padre o abuelo perdió el pelo y temes que te pase igual?',
      '¿Has buscado en internet pero no sabes qué es fiable?',
      '¿Te da cosa ir a una clínica porque crees que te van a vender algo?',
    ],
    testimonials: [
      { name: 'Alejandro R.', age: 22, text: 'Empecé a notar las entradas a los 20. Me dijeron que era genético y no había nada que hacer. En HC me explicaron todas las opciones reales.', stars: 5 },
      { name: 'Daniel P.', age: 26, text: 'No quería acabar como mi padre. Fui a tiempo, me hicieron un diagnóstico completo y ahora tengo un plan que funciona.', stars: 5 },
    ],
    solution: 'No vendemos cirugías a jóvenes que no las necesitan. Primero diagnosticamos con microscopio + analítica. Después te explicamos todas las opciones reales — sin presión.',
    faqs: [
      { q: '¿A los 20 ya puedo perder el pelo?', a: 'Sí. El 25% de los hombres empiezan a notar caída antes de los 25. La genética, las hormonas y el estrés pueden acelerar el proceso.' },
      { q: '¿Si mi padre es calvo, yo también lo seré?', a: 'No necesariamente. La genética influye, pero no determina al 100%. Un diagnóstico temprano permite frenar o retrasar la caída significativamente.' },
      { q: '¿Es muy pronto para un trasplante?', a: 'Depende. En muchos casos, a los 20-25 es mejor estabilizar la caída con tratamiento médico antes de plantearse una cirugía. Te lo explicamos sin presión.' },
      { q: '¿Los tratamientos tienen efectos secundarios?', a: 'Existen opciones con y sin efectos secundarios. Nuestros médicos te explican cada opción, sus pros y contras, para que tomes una decisión informada.' },
    ],
    tags: ['nicho-jovenes'],
  },

  'hombres-caida': {
    slug: 'hombres-caida',
    door: 'landing_hombres_caida',
    badge: 'Diagnóstico Capilar Avanzado',
    headline: '¿Llevas tiempo con caída y nada de lo que pruebas funciona?',
    subheadline: 'El 60% de hombres que usan minoxidil no ven resultados. No porque el producto no sirva — sino porque nunca les diagnosticaron correctamente la causa.',
    ctaQuiz: 'Descubre por qué no funciona',
    ctaForm: 'SOLICITAR VALORACIÓN',
    ecp: '¿Qué Me Pasa?',
    stats: [
      { value: '60%', label: 'no responden a minoxidil sin diagnóstico' },
      { value: '20+', label: 'tipos de alopecia con tratamientos distintos' },
      { value: '30 min', label: 'diagnóstico integral completo' },
    ],
    painPoints: [
      '¿Minoxidil, finasteride, champús... y sigue cayendo?',
      '¿Llevas más de un año perdiendo densidad?',
      '¿Te han dado recetas genéricas sin hacerte un estudio completo?',
      '¿No sabes si necesitas tratamiento médico o cirugía?',
    ],
    testimonials: [
      { name: 'Carlos M.', age: 38, text: 'Llevaba 3 años con minoxidil y finasteride sin resultado. En HC descubrieron que mi alopecia era mixta. Cambiaron el tratamiento y en 6 meses noté la diferencia.', stars: 5 },
      { name: 'Javier L.', age: 45, text: 'Me operé en Turquía y el pelo seguía cayendo. En Hospital Capilar me diseñaron un plan de mantenimiento que protege mi inversión.', stars: 5 },
    ],
    solution: 'Hacemos lo que nadie hace: un diagnóstico integral con tricoscopía + analítica hormonal + valoración médica en 30 minutos. Sin diagnóstico correcto, cualquier tratamiento es una apuesta.',
    faqs: [
      { q: '¿Por qué el minoxidil no me funciona?', a: 'Hay más de 20 tipos de alopecia. Si no sabes cuál tienes, el tratamiento puede no ser el adecuado. Un diagnóstico preciso es el primer paso.' },
      { q: '¿Necesito trasplante o tratamiento?', a: 'Depende de tu tipo de alopecia, tu edad y el grado de pérdida. Nuestros médicos te lo explican con datos reales después del diagnóstico.' },
      { q: '¿Cuánto cuesta la valoración?', a: 'La primera valoración médica incluye tricoscopía digital + revisión de tu caso. Consulta las condiciones al solicitar tu cita.' },
      { q: '¿Los resultados son permanentes?', a: 'Los tratamientos médicos requieren seguimiento. Los trasplantes son permanentes en la zona implantada, pero el pelo nativo necesita mantenimiento.' },
    ],
    tags: ['nicho-hombres-caida'],
  },

  'segunda-opinion': {
    slug: 'segunda-opinion',
    door: 'landing_segunda_opinion',
    badge: 'Segunda Opinión Capilar',
    headline: '¿Tuviste una mala experiencia en otra clínica capilar?',
    subheadline: 'Sabemos que hay clínicas que prometen mucho y entregan poco. Hospital Capilar es un centro médico, no un centro estético. Aquí no hay consultas que son ventas disfrazadas.',
    ctaQuiz: 'Evalúa tu caso sin compromiso',
    ctaForm: 'QUE ME LLAMEN SIN COMPROMISO',
    ecp: 'Ya Me Engañaron',
    stats: [
      { value: '35%', label: 'de pacientes vienen de otra clínica' },
      { value: '0', label: 'presión comercial en la consulta' },
      { value: '100%', label: 'transparencia con tu diagnóstico' },
    ],
    painPoints: [
      '¿Te prometieron resultados que nunca llegaron?',
      '¿Sientes que te vendieron un tratamiento sin diagnosticarte bien?',
      '¿Desconfías de las clínicas capilares después de tu experiencia?',
      '¿Necesitas una opinión médica real, sin compromiso ni presión?',
    ],
    testimonials: [
      { name: 'Miguel A.', age: 42, text: 'Me operaron en otra clínica y el resultado fue desastroso. En HC me explicaron por qué falló y qué opciones reales tenía. Por primera vez sentí que alguien me decía la verdad.', stars: 5 },
      { name: 'Roberto S.', age: 35, text: 'Fui a 3 clínicas antes. Todas me vendían lo mismo sin hacerme un estudio serio. En Hospital Capilar me hicieron tricoscopía, analítica y me explicaron todo con datos.', stars: 5 },
    ],
    solution: 'No hacemos consultas comerciales. Nuestros médicos te diagnostican con datos (tricoscopía + analítica) y te dicen la verdad sobre tu caso, te guste o no.',
    faqs: [
      { q: '¿Puedo arreglar un trasplante mal hecho?', a: 'En muchos casos sí. Primero evaluamos el estado actual con tricoscopía y determinamos qué opciones hay. Cada caso es diferente.' },
      { q: '¿Me van a intentar vender otra cirugía?', a: 'No. Nuestros médicos te explican qué se puede y qué no se puede hacer. Si la mejor opción es no intervenir, te lo decimos.' },
      { q: '¿Es confidencial?', a: 'Absolutamente. Todo lo que compartas con nuestro equipo médico es confidencial. No necesitas decirnos dónde te operaste si no quieres.' },
      { q: '¿Cuánto cuesta la segunda opinión?', a: 'Te llamamos sin compromiso para entender tu caso. La consulta presencial incluye un diagnóstico completo con datos objetivos.' },
    ],
    tags: ['nicho-segunda-opinion'],
  },

  'post-trasplante': {
    slug: 'post-trasplante',
    door: 'landing_post_trasplante',
    badge: 'Mantenimiento Post-Trasplante',
    headline: 'Ya te operaste. ¿Quién protege tu inversión?',
    subheadline: 'Un trasplante capilar sin plan de mantenimiento pierde resultados con el tiempo. El pelo trasplantado no se cae, pero el nativo sigue sometido a los mismos factores.',
    ctaQuiz: 'Protege tu trasplante',
    ctaForm: 'SOLICITAR VALORACIÓN',
    ecp: 'La Inversión',
    stats: [
      { value: '40%', label: 'pierden resultados sin mantenimiento' },
      { value: '12 meses', label: 'críticos post-cirugía' },
      { value: '3.000€+', label: 'invertidos que hay que proteger' },
    ],
    painPoints: [
      '¿Te operaste pero el pelo nativo sigue cayendo?',
      '¿No tienes un plan de mantenimiento post-trasplante?',
      '¿Tu clínica no te hizo seguimiento después de la cirugía?',
      '¿Quieres que los resultados de tu trasplante duren para siempre?',
    ],
    testimonials: [
      { name: 'Fernando G.', age: 39, text: 'Me operé en Turquía hace 2 años. El trasplante se ve bien, pero el resto del pelo seguía cayendo. En HC me diseñaron un plan de mantenimiento y ahora tengo todo controlado.', stars: 5 },
      { name: 'Andrés M.', age: 44, text: 'Me operé en HC y el seguimiento post-operatorio es otro nivel. Tricoscopía cada 6 meses, tratamiento personalizado, y siempre disponibles.', stars: 5 },
    ],
    solution: 'Diseñamos planes de mantenimiento personalizados que protegen tanto el pelo trasplantado como el nativo. Tricoscopía de control + tratamiento médico adaptado a tu caso.',
    faqs: [
      { q: '¿El pelo trasplantado se puede caer?', a: 'El pelo trasplantado es permanente. Pero el pelo nativo (no trasplantado) sigue sometido a la alopecia y necesita protección con tratamiento médico.' },
      { q: '¿Cuándo debo empezar el mantenimiento?', a: 'Lo ideal es empezar desde el primer mes post-cirugía. Pero nunca es tarde — incluso años después podemos diseñar un plan que proteja tus resultados.' },
      { q: '¿Puedo hacer mantenimiento aunque me operé en otra clínica?', a: 'Sí. Evaluamos el estado actual de tu trasplante y del pelo nativo, y diseñamos un plan personalizado independientemente de dónde te operaste.' },
      { q: '¿En qué consiste el seguimiento?', a: 'Tricoscopía de control cada 6 meses, ajuste de tratamiento médico según evolución, y acceso a nuestro equipo para cualquier duda.' },
    ],
    tags: ['nicho-post-trasplante'],
  },

  postparto: {
    slug: 'postparto',
    door: 'landing_postparto',
    badge: 'Caída Capilar Postparto',
    headline: '¿Se te cae el pelo desde el embarazo o el parto?',
    subheadline: 'El efluvio postparto afecta al 50% de madres. En la mayoría de casos es temporal, pero en algunas mujeres revela una alopecia subyacente. La única forma de saberlo es con un diagnóstico.',
    ctaQuiz: 'Descubre si es temporal o algo más',
    ctaForm: 'SOLICITAR VALORACIÓN',
    ecp: 'Lo Que Vino Con el Bebé',
    stats: [
      { value: '50%', label: 'de madres sufren caída postparto' },
      { value: '85%', label: 'se recuperan con tratamiento adecuado' },
      { value: '6 meses', label: 'clave para actuar a tiempo' },
    ],
    painPoints: [
      '¿Pierdes mechones de pelo desde que diste a luz?',
      '¿Te dijeron que es normal pero llevas meses así?',
      '¿No sabes si es temporal o algo más serio?',
      '¿Te preocupa que no vuelva a crecer como antes?',
    ],
    testimonials: [
      { name: 'Elena R.', age: 32, text: 'Después del parto perdí mucho pelo. Mi ginecóloga decía que era normal. En HC descubrieron que tenía AGA subyacente. Gracias a actuar a tiempo estoy recuperando densidad.', stars: 5 },
      { name: 'Sofía T.', age: 29, text: 'Creía que nunca iba a volver a tener mi pelo de antes. El diagnóstico en HC me tranquilizó: era efluvio temporal. Me dieron un plan y en 4 meses estaba como antes.', stars: 5 },
    ],
    solution: 'Cruzamos tu perfil hormonal postparto con un estudio capilar completo. Si es efluvio temporal, te lo decimos. Si hay una alopecia subyacente, actuamos a tiempo.',
    faqs: [
      { q: '¿Es normal perder pelo después del parto?', a: 'Sí, el efluvio postparto es muy común. Pero si la caída persiste más de 6 meses, puede haber una alopecia subyacente que necesita tratamiento.' },
      { q: '¿Cuándo debería preocuparme?', a: 'Si llevas más de 4-6 meses con caída intensa, si notas zonas con menos densidad, o si el pelo no vuelve a crecer, es momento de hacer un diagnóstico.' },
      { q: '¿Los tratamientos son compatibles con la lactancia?', a: 'Sí. Existen tratamientos seguros durante la lactancia. Nuestros médicos te indican opciones que no afectan al bebé.' },
      { q: '¿Mi pelo volverá a ser como antes?', a: 'En la mayoría de casos, sí. Si es efluvio temporal, se recupera solo o con ayuda. Si hay AGA, el tratamiento temprano frena la caída y recupera densidad.' },
    ],
    tags: ['nicho-postparto'],
  },
};
