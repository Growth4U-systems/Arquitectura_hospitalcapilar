/**
 * Content for paywall-style result screens — per ECP
 * Used by HospitalCapilarQuiz and ShortQuizLanding
 */

// ─── OBJECTIONS (myth → truth) ──────────────────────────────
export const OBJECTIONS_BY_ECP = {
  '¿Qué Me Pasa?': [
    { myth: 'Ya probé minoxidil y no me funcionó', truth: 'El 40-60% no responde a minoxidil. Sin un diagnóstico real, cualquier tratamiento es una apuesta a ciegas.' },
    { myth: 'No sé si mi caída tiene solución', truth: 'Un diagnóstico con tricoscopía + analítica te da la respuesta en 30 minutos. Sin adivinar.' },
    { myth: 'Me da cosa ir a una clínica capilar', truth: 'No somos un centro estético. Somos un centro médico. Te decimos la verdad, te guste o no.' },
  ],
  'Es Normal': [
    { myth: 'No sé si mi caída tiene solución', truth: 'Un diagnóstico con tricoscopía + analítica hormonal te da la respuesta en 30 minutos.' },
    { myth: 'Ya fui a otro médico y no me dijeron nada', truth: 'Cruzamos dermatología capilar con endocrinología. Nadie más mira tu pelo y tus hormonas juntos.' },
    { myth: 'Es muy caro para no saber si funciona', truth: 'Los 195€ se descuentan íntegros si inicias tratamiento.' },
  ],
  'El Espejo': [
    { myth: 'Soy muy joven, seguro que no es nada grave', truth: 'La alopecia NO espera. Cuanto antes actúes, más opciones tienes y mejores resultados.' },
    { myth: 'Mi médico me dijo que esperara', truth: 'Esperar es la peor decisión con AGA. Cada mes sin actuar es pelo que no vuelve.' },
    { myth: 'No quiero medicarme de por vida', truth: 'Hay opciones sin fármacos orales. Pero primero necesitas saber qué tienes exactamente.' },
  ],
  'Ya Me Engañaron': [
    { myth: 'Ya me engañaron una vez, no quiero repetir', truth: 'Entendemos. Por eso nuestra primera consulta es sin compromiso — para que nos conozcas antes de decidir nada.' },
    { myth: 'Todas las clínicas prometen lo mismo', truth: 'No prometemos resultados. Diagnosticamos con datos objetivos y te damos opciones honestas.' },
    { myth: 'No quiero que me presionen para operarme', truth: 'Nuestros médicos no cobran comisión. Te recomiendan lo que necesitas, no lo más caro.' },
  ],
  'La Inversión': [
    { myth: 'Ya me operé, ¿para qué necesito más?', truth: 'El pelo trasplantado no se cae, pero el nativo sí. Sin mantenimiento perderás densidad alrededor.' },
    { myth: 'Mi cirujano no me habló de mantenimiento', truth: 'Es el error más común. Un trasplante sin plan de mantenimiento pierde resultados con el tiempo.' },
    { myth: '¿No es pronto para preocuparme?', truth: 'El mejor momento para empezar mantenimiento es justo después de la cirugía. Cuanto antes, mejor.' },
  ],
  'Lo Que Vino Con el Bebé': [
    { myth: 'Me dicen que es normal y que se pasará solo', truth: 'En el 70% de casos sí. Pero si hay AGA subyacente, cada mes sin actuar es pelo que no vuelve.' },
    { myth: 'Mi ginecóloga no le da importancia', truth: 'Los ginecólogos tratan hormonas. Los dermatólogos tratan pelo. Nosotros cruzamos ambos.' },
    { myth: 'Es muy caro para no saber si funciona', truth: 'Los 195€ se descuentan íntegros si inicias tratamiento.' },
  ],
  'La Farmacia': [
    { myth: 'Ya probé minoxidil, suplementos y champús — nada funciona', truth: 'Los productos genéricos no están diseñados para tu alopecia concreta. Sin diagnóstico, es un disparo al aire.' },
    { myth: 'He gastado mucho dinero y no quiero gastar más', truth: 'Un diagnóstico médico real (195€) te ahorra años de productos que no funcionan. Y esos 195€ se descuentan si inicias tratamiento.' },
    { myth: 'Con más tiempo se solucionará solo', truth: 'La alopecia sin tratar empeora. Cuanto antes se diagnostica, más opciones de tratamiento efectivo hay.' },
  ],
};

// ─── TESTIMONIALS ───────────────────────────────────────────
export const TESTIMONIALS_BY_ECP = {
  '¿Qué Me Pasa?': [
    { name: 'Carlos M.', age: 38, text: 'Llevaba 2 años probando cosas por mi cuenta. En Hospital Capilar me diagnosticaron AGA en 30 minutos y me dieron un plan real. Ojalá hubiera ido antes.', stars: 5 },
    { name: 'Javier R.', age: 42, text: 'Fui pensando que me iban a vender un trasplante. Me dijeron que con tratamiento médico era suficiente. Eso me dio confianza.', stars: 5 },
  ],
  'Es Normal': [
    { name: 'Laura M.', age: 34, text: 'Llevaba 2 años con caída y nadie encontraba la causa. En Hospital Capilar descubrieron que era hormonal. Ahora estoy recuperando densidad.', stars: 5 },
    { name: 'Patricia G.', age: 41, text: 'Después del embarazo no paraba de caer. Me hicieron una analítica completa cruzada con tricoscopía. Por fin un diagnóstico real.', stars: 5 },
  ],
  'El Espejo': [
    { name: 'Alejandro P.', age: 23, text: 'Tenía 22 años y ya se me notaban las entradas. En HC me dijeron exactamente qué hacer y en 6 meses recuperé densidad. Actuar pronto fue clave.', stars: 5 },
    { name: 'Daniel S.', age: 26, text: 'Fui con miedo a que me dijeran que necesitaba cirugía. Solo necesitaba tratamiento médico. Me quitaron un peso de encima.', stars: 5 },
  ],
  'Ya Me Engañaron': [
    { name: 'Roberto L.', age: 35, text: 'Después de una mala experiencia en otra clínica, estaba muy escéptico. En HC me explicaron todo con datos objetivos. Cero presión.', stars: 5 },
    { name: 'Ana B.', age: 39, text: 'Me operaron en el extranjero y quedó mal. En HC me hicieron un plan de recuperación realista y honesto. Agradecida.', stars: 5 },
  ],
  'La Inversión': [
    { name: 'Miguel F.', age: 44, text: 'Me operé hace 2 años y el pelo de alrededor empezaba a caer. En HC me dieron un plan de mantenimiento que funciona. No pierdo más.', stars: 5 },
    { name: 'Fernando D.', age: 37, text: 'Nadie me dijo que necesitaba mantenimiento después del trasplante. En HC me lo explicaron todo claro. Ojalá hubiera ido antes.', stars: 5 },
  ],
  'Lo Que Vino Con el Bebé': [
    { name: 'Elena R.', age: 32, text: 'Después del parto perdí mucho pelo. Mi ginecóloga decía que era normal. En HC descubrieron que tenía AGA subyacente. Gracias a actuar a tiempo estoy recuperando densidad.', stars: 5 },
    { name: 'Sofía T.', age: 29, text: 'Creía que nunca iba a volver a tener mi pelo de antes. El diagnóstico en HC me tranquilizó: era efluvio temporal. Me dieron un plan y en 4 meses estaba como antes.', stars: 5 },
  ],
  'La Farmacia': [
    { name: 'Marta S.', age: 36, text: 'Llevaba 3 años con Olistic, minoxidil y champús especiales. Gastaba 80€ al mes y nada. En HC descubrieron déficit de hierro y AGA. En 4 meses noté la diferencia.', stars: 5 },
    { name: 'Tomás R.', age: 44, text: 'Probé todo lo de farmacia. Me hice la consulta diagnóstica y resultó que los productos que usaba eran incorrectos para mi tipo de alopecia. Ahora tengo un plan que funciona.', stars: 5 },
  ],
};

// ─── WHAT'S INCLUDED — by CTA type ─────────────────────────
export const INCLUDED_BY_CTA = {
  pagar_bono: [
    'Tricoscopía digital con microscopio de alta resolución',
    'Analítica hormonal completa',
    'Valoración médica personalizada (30 min)',
    'Plan de tratamiento detallado',
  ],
  agendar_consulta: [
    'Valoración médica presencial con especialista',
    'Estudio capilar con microscopio digital',
    'Orientación personalizada sobre tu caso',
    'Sin coste de consulta — 100% gratuita',
  ],
  solicitar_llamada: [
    'Llamada personalizada con asesor médico',
    'Revisión detallada de tu caso',
    'Orientación sobre opciones de tratamiento',
    'Sin compromiso ni coste',
  ],
  waitlist: [
    'Notificación prioritaria cuando abramos en tu zona',
    'Acceso a videoconsulta médica (próximamente)',
    'Sin compromiso ni coste',
  ],
  descarga_guia: [
    'Guía personalizada según tu perfil',
    'Información objetiva sobre opciones de tratamiento',
    'Sin compromiso — para que decidas con calma',
  ],
};

// ─── FAQs — by CTA type ────────────────────────────────────
export const FAQS_BY_CTA = {
  pagar_bono: [
    { q: '¿Qué incluye exactamente el diagnóstico?', a: 'Tricoscopía digital (microscopio capilar de alta resolución), analítica hormonal completa, valoración médica personalizada de 30 minutos y plan de tratamiento detallado.' },
    { q: '¿Los 195€ se descuentan si hago tratamiento?', a: 'Sí. Si decides iniciar tratamiento en Hospital Capilar, los 195€ del diagnóstico se descuentan íntegros del coste.' },
    { q: '¿Me van a intentar vender algo?', a: 'No. Nuestros médicos te diagnostican con datos objetivos (microscopio + analítica) y te explican tus opciones. Si no necesitas tratamiento, te lo decimos.' },
  ],
  agendar_consulta: [
    { q: '¿La consulta es realmente gratuita?', a: 'Sí. La valoración inicial es sin coste. Incluye estudio capilar con microscopio y orientación médica personalizada.' },
    { q: '¿Qué pasa si no necesito tratamiento?', a: 'Te lo decimos. No vamos a recomendarte algo que no necesitas. Nuestros médicos te dan un diagnóstico honesto.' },
    { q: '¿Me van a presionar para operarme?', a: 'No. Solo el 30% de nuestros pacientes necesita cirugía. La mayoría responde a tratamiento médico.' },
  ],
  solicitar_llamada: [
    { q: '¿Cuándo me llamarán?', a: 'Un asesor médico te contactará en menos de 24 horas laborables.' },
    { q: '¿Es realmente sin compromiso?', a: 'Sí. La llamada es para entender tu caso y orientarte. No hay ningún compromiso ni coste.' },
    { q: '¿Quién me va a llamar?', a: 'Un asesor médico del equipo de Hospital Capilar, especializado en tu tipo de caso.' },
  ],
  waitlist: [
    { q: '¿Cuándo abriréis cerca de mí?', a: 'Estamos abriendo 6 nuevas clínicas en 2026. Te avisaremos en cuanto tengamos fecha para tu zona.' },
    { q: '¿Ofrecéis videoconsulta?', a: 'Estamos trabajando en ello. Si te apuntas, serás de los primeros en acceder.' },
  ],
  descarga_guia: [
    { q: '¿Qué contiene la guía?', a: 'Información objetiva sobre tu tipo de caída, opciones de tratamiento y criterios para elegir un buen profesional.' },
    { q: '¿Es sin compromiso?', a: 'Sí. La guía es tuya para que tomes la mejor decisión a tu ritmo.' },
  ],
};

// ─── Helper: get primary CTA type from getCTAConfig result ──
export function getPrimaryCTAType(cta) {
  return cta?.primary?.type || 'solicitar_llamada';
}
