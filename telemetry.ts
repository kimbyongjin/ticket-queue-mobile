import * as Sentry from '@sentry/react-native';
import config from './app.json';

export const hasDsn = Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN);

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: hasDsn,
  environment: __DEV__ ? 'development' : 'production',
  // Use the same release label for every event from this app version.
  release: config.expo.slug + '@' + config.expo.version,
  sendDefaultPii: false,
  // Sample all local traces so a single tap is observable. The production baseline
  // keeps roughly one trace in ten. Error events are sampled independently.
  tracesSampleRate: __DEV__ ? 1 : 0.1,
  // The queue adapter uses this type only when the user cancels a request.
  beforeSend(event, hint) {
    return hint.originalException instanceof QueueRequestCancelled ? null : event;
  },
});

export class QueueRequestCancelled extends Error {}
