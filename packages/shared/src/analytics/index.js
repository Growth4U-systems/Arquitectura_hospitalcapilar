// Analytics module - barrel export
export { PostHogProvider, posthog } from './PostHogProvider';
export { AnalyticsContext, AnalyticsProvider } from './AnalyticsContext';
export { useAnalytics } from './useAnalytics';
export {
  ANALYTICS_EVENTS,
  EVENT_SCHEMAS,
  generateSessionId,
  calculateLeadScore,
  getUTMParams,
  classifyTrafficSource,
  detectFunnelType,
  detectNicho,
  getEventContext,
} from './events';
