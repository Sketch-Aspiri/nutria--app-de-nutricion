import * as Sentry from '@sentry/nextjs';

import {
  safeBeforeSend,
  sentryEnvironment,
  tracesSampleRate,
} from './src/sentry/privacy';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: sentryEnvironment(),
  sendDefaultPii: false,
  tracesSampleRate: tracesSampleRate(),
  beforeSend: safeBeforeSend,
});
