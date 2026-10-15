# Google sign-in setup

This guide configures Google sign-in for the Momo mobile app through Supabase Auth. The app opens Supabase's Google OAuth endpoint, uses PKCE, and returns to `aistudy://auth/callback`. The app scheme is already declared in `mobile/app.json`, and the sign-in implementation is in `mobile/lib/auth/`.

## 1. Choose the Supabase project

Set up each environment separately (local, staging, and production). In the Supabase dashboard, open the project that the app build will use and note its project URL and public anon/publishable key. The staging example currently points to project `zkouryrzhsgaeqyiwwyb`; use the matching values for the intended environment.

Do not put a Supabase `service_role` or secret key in the mobile app. The app rejects elevated keys at startup. Keep Google client secrets in the Supabase Auth provider configuration, never in an Expo `EXPO_PUBLIC_*` variable.

## 2. Configure the Google consent screen

1. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview) and select or create the Google Cloud project for this environment.
2. Set the app name, support email, and contact email under Branding.
3. Set the Audience to match your testers. For an External app in Testing status, add each tester's Google account to the test-user list.
4. Request only the standard `openid`, `email`, and `profile` scopes used for sign-in.

## 3. Create a Google OAuth web client

1. In Google Auth Platform, open Clients and choose **Create client** → **Web application**.
2. Give the client a clear environment-specific name, such as `Momo staging Supabase`.
3. In **Authorized redirect URIs**, add the callback URL shown on the Supabase project's Google provider page. For a hosted Supabase project it is usually:

   ```text
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

   Use the exact value shown by Supabase, especially if the project uses a custom auth domain. For local Supabase, the documented callback is `http://127.0.0.1:54321/auth/v1/callback`.
4. If this same OAuth client will serve a web app, add that web app's HTTPS origin under **Authorized JavaScript origins**. Do not put `aistudy://auth/callback` in Google; it is the app return link, not Google's OAuth callback.
5. Create the client and copy its **Client ID** and **Client secret**. Store the secret in a password manager while configuring Supabase.

## 4. Enable Google in Supabase Auth

1. In the Supabase dashboard, open **Authentication** → **Sign In / Providers** → **Google**.
2. Enable Google.
3. Paste the Google **Client ID** and **Client secret** from step 3.
4. Copy the callback URL displayed on this page into Google's **Authorized redirect URIs** if you have not already added it.
5. Save the provider settings.

The Google client secret stays in Supabase. It is not needed by the mobile app at runtime.

## 5. Allow the app's return link in Supabase

1. In Supabase, open **Authentication** → **URL Configuration**.
2. Add this exact entry under **Redirect URLs**:

   ```text
   aistudy://auth/callback
   ```

3. Keep it identical to `EXPO_PUBLIC_AUTH_REDIRECT_URL` and the `scheme` in `mobile/app.json`. The app's current default is `aistudy://auth/callback`.
4. Set **Site URL** to the public website URL if the project has one. The mobile flow passes an explicit redirect URL, so the Site URL is only the fallback for flows without one.

## 6. Configure the mobile app

From `mobile/`, copy the environment example for the environment you are testing, then fill in the matching public configuration. For staging, use `.env.staging.example` as the template; for local development, use `.env.example`.

```ini
EXPO_PUBLIC_APP_ENV=staging
EXPO_PUBLIC_API_URL=https://<your-api-host>
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<public-anon-or-publishable-key>
EXPO_PUBLIC_AUTH_REDIRECT_URL=aistudy://auth/callback
```

Use the `EXPO_PUBLIC_SUPABASE_URL` and public key from the same Supabase project configured in steps 1 and 4. The backend API URL must point to the matching environment. Never add a Google client secret, Supabase service-role key, or Supabase secret key to this file.

## 7. Run the sign-in flow on a development build

The app uses a native URL scheme. Test with an installed Expo development build or staging build so the operating system can reopen the app at `aistudy://auth/callback`. Expo Go does not install this app's native scheme.

From `mobile/`, install dependencies if needed, then run `npm run android` or `npm run ios` for a local native build. Start the app and use its Google sign-in button.

## 8. Verify the full login

On both iOS and Android, confirm each of these:

1. Tapping Google sign-in opens the system browser and the expected Google consent/account screen.
2. Completing sign-in returns to Momo, and the app shows a signed-in account.
3. The backend accepts the session and `/api/me` returns the same account identity. The app verifies this before binding local data to the account.
4. Canceling Google sign-in returns to the app without creating a session.
5. Force-close and reopen the app; the stored session restores or refreshes successfully.
6. Sign out, then sign in with a second test account and confirm the app switches account data cleanly.

Record device/OS, build/environment, and outcomes in the AUTH-01 tracker entry. Configuration alone does not prove the provider callback, native redirect, token refresh, or account switching works. The readiness tracker currently leaves real Google login and native journeys unverified.

## Troubleshooting

- **Google `redirect_uri_mismatch`:** make the Google Authorized redirect URI byte-for-byte equal to the callback shown in Supabase. This is the Supabase callback URL, not `aistudy://auth/callback`.
- **Supabase says redirect URL is not allowed:** add `aistudy://auth/callback` to Supabase Auth's Redirect URLs and make the mobile env value identical.
- **Browser finishes but app does not reopen:** confirm the installed native build uses scheme `aistudy`; rebuild after changing `mobile/app.json` or the scheme.
- **Provider disabled / invalid client:** check that Google is enabled in the same Supabase project whose URL and public key are in the mobile environment, and that its Client ID and secret match the Google client.
- **Hosted app fails during startup:** hosted builds require `EXPO_PUBLIC_APP_ENV=staging` or `production`, the matching Supabase URL, and a public anon/publishable key. An elevated key is rejected.

## Official references

- [Supabase: Sign in with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase: Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Expo: Authentication with OAuth or OpenID providers](https://docs.expo.dev/guides/authentication/)
