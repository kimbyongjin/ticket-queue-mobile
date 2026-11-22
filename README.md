# Ticket Queue Mobile

A one-screen React Native app for exploring error reporting and tracing with local fixtures.

## Run

Install dependencies with `npm ci`, then run `npm start` and open the project on a device with a matching Expo Go version (SDK 58). On a physical iPhone, sign in to the same Expo account in Expo Go and in the CLI with `npx expo login`. For a native development build on a Mac with Xcode installed, use `npx expo run:ios`.

To send events, copy `.env.example` to `.env.local`, fill in your React Native project's public DSN, and restart Expo. The screen also works without a DSN.

## Try it

* **Load slow queue** reads a fixture after a simulated 1.5-second delay. In Sentry, look for the **Load ticket queue** transaction and its **Read fixture** child span.
* **Load invalid response** passes a malformed fixture to the decoder. Look in Issues for **Ticket queue response has an invalid format**.
* **Cancel load** during the delay exercises the error filter. A user cancellation ends the operation and the SDK drops the cancellation exception.

Local development samples every trace so the two cases are easy to inspect. The example production configuration samples 10% of traces and keeps unexpected errors. Release names use the app slug and version. Bump the version for each release. Native source map uploads require SENTRY_ORG, SENTRY_PROJECT and a build-time SENTRY_AUTH_TOKEN.
