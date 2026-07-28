import * as Sentry from '@sentry/nextjs';

import {
  safeBeforeSend,
  sentryEnvironment,
  tracesSampleRate,
} from '@/sentry/privacy';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: sentryEnvironment(),
  sendDefaultPii: false,
  tracesSampleRate: tracesSampleRate(),
  beforeSend: safeBeforeSend,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
