// Definición centralizada de todos los eventos de analytics
export const ANALYTICS_EVENTS = {
  // Quiz Flow Events
  QUIZ_STARTED: 'quiz_started',
  QUESTION_ANSWERED: 'question_answered',
  QUIZ_COMPLETED: 'quiz_completed',
  QUIZ_ABANDONED: 'quiz_abandoned',

  // Analysis Events
  ANALYSIS_STARTED: 'analysis_started',
  ANALYSIS_COMPLETED: 'analysis_completed',

  // Form Events
  FORM_VIEWED: 'form_viewed',
  FORM_FIELD_FOCUSED: 'form_field_focused',
  FORM_SUBMITTED: 'form_submitted',
  FORM_VALIDATION_ERROR: 'form_validation_error',

  // Navigation Events
  BACK_BUTTON_CLICKED: 'back_button_clicked',

  // Session Events
  SESSION_START: 'session_start',
  PAGE_VIEW: '$pageview',
};

// Propiedades requeridas por cada evento
export const EVENT_SCHEMAS = {
  [ANALYTICS_EVENTS.QUIZ_STARTED]: {
    required: ['session_id', 'timestamp'],
    optional: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'referrer', 'experiment_variant'],
  },
  [ANALYTICS_EVENTS.QUESTION_ANSWERED]: {
    required: ['session_id', 'question_id', 'question_index', 'answer_value', 'time_to_answer_ms'],
    optional: ['experiment_variant'],
  },
  [ANALYTICS_EVENTS.QUIZ_COMPLETED]: {
    required: ['session_id', 'total_time_ms', 'answers_count'],
    optional: ['answers_summary', 'experiment_variant'],
  },
  [ANALYTICS_EVENTS.QUIZ_ABANDONED]: {
    required: ['session_id', 'last_question_index', 'time_spent_ms', 'answers_count'],
    optional: ['exit_reason'],
  },
  [ANALYTICS_EVENTS.FORM_SUBMITTED]: {
    required: ['session_id', 'lead_score'],
    optional: ['experiment_variant', 'answers_hash'],
  },
  [ANALYTICS_EVENTS.BACK_BUTTON_CLICKED]: {
    required: ['session_id', 'from_question', 'to_question'],
    optional: [],
  },
  [ANALYTICS_EVENTS.FORM_FIELD_FOCUSED]: {
    required: ['session_id', 'field_name'],
    optional: ['field_order'],
  },
};

// Generador de session_id único
export const generateSessionId = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

// Calcular lead score basado en las respuestas
export const calculateLeadScore = (answers) => {
  let score = 0;

  // Urgencia alta = +30 puntos
  if (answers.urgency === 'Lo antes posible') score += 30;
  else if (answers.urgency === 'En los próximos 3 meses') score += 20;
  else if (answers.urgency === 'En 6 meses o más') score += 10;

  // Edad óptima para trasplante = +20 puntos
  if (['25 - 35 años', '36 - 45 años'].includes(answers.age)) score += 20;
  else if (answers.age === '46 - 55 años') score += 15;

  // Ya ha probado tratamientos = +15 puntos (más informado)
  if (answers.medication === 'Sí, actualmente lo uso') score += 15;
  else if (answers.medication === 'Sí, en el pasado pero lo dejé') score += 10;

  // Genética confirmada = +10 puntos (caso más claro)
  if (answers.genetics === 'Sí, padre o madre') score += 10;
  else if (answers.genetics === 'Sí, abuelos o tíos') score += 5;

  // Área de pérdida = puntos según complejidad/ticket
  if (answers.area === 'Avanzada') score += 25;
  else if (answers.area === 'Difusa / General') score += 20;
  else if (answers.area === 'Entradas (Línea frontal)') score += 15;
  else if (answers.area === 'Coronilla') score += 15;

  return Math.min(score, 100); // Max 100
};

// Obtener parámetros UTM de la URL
export const getUTMParams = () => {
  if (typeof window === 'undefined') return {};

  const urlParams = new URLSearchParams(window.location.search);
  return {
    utm_source: urlParams.get('utm_source') || undefined,
    utm_medium: urlParams.get('utm_medium') || undefined,
    utm_campaign: urlParams.get('utm_campaign') || undefined,
    utm_content: urlParams.get('utm_content') || undefined,
    utm_term: urlParams.get('utm_term') || undefined,
    fbclid: urlParams.get('fbclid') || undefined,
    gclid: urlParams.get('gclid') || undefined,
  };
};

// Clasificar fuente de tráfico desde UTM params
export const classifyTrafficSource = (utmParams = null) => {
  const params = utmParams || getUTMParams();

  if (params.fbclid) return 'meta';
  if (params.gclid) return 'google_ads';

  const source = (params.utm_source || '').toLowerCase();
  const medium = (params.utm_medium || '').toLowerCase();

  // Meta (Facebook / Instagram)
  if (['facebook', 'fb', 'instagram', 'ig', 'meta'].includes(source)) return 'meta';

  // Google Ads
  if (source === 'google' && ['cpc', 'ppc', 'paid'].includes(medium)) return 'google_ads';

  // SEO (Google orgánico)
  if (source === 'google' && ['organic', ''].includes(medium)) return 'seo';
  if (medium === 'organic') return 'seo';

  // TikTok
  if (['tiktok', 'tt'].includes(source)) return 'tiktok';

  // Directo (sin UTMs ni referrer con info)
  if (!source && !medium) return 'direct';

  return 'other';
};

// Detectar tipo de funnel desde la URL
export const detectFunnelType = () => {
  if (typeof window === 'undefined') return 'quiz_largo';

  const path = window.location.pathname;

  if (path.startsWith('/form/')) return 'formulario_directo';
  if (path.startsWith('/rapido/')) return 'quiz_corto';
  return 'quiz_largo';
};

// Detectar nicho desde la URL
export const detectNicho = () => {
  if (typeof window === 'undefined') return undefined;

  const path = window.location.pathname;
  // Remove prefix (/form/, /rapido/) and trailing slash
  const slug = path.replace(/^\/(form|rapido)\//, '/').replace(/^\//, '').replace(/\/$/, '');

  if (!slug || slug === 'index') return 'general';
  return slug;
};

// Obtener todas las propiedades de contexto para enriquecer eventos
export const getEventContext = () => {
  const utmParams = getUTMParams();
  return {
    ...utmParams,
    traffic_source: classifyTrafficSource(utmParams),
    funnel_type: detectFunnelType(),
    nicho: detectNicho(),
  };
};
