---
tags: [momo, authentication, release-blocker]
---
# Momo Authentication

Parent: [[Momo Public Readiness]]. Boundary: [[Momo Backend Security]].

The backend validates JWT signature, supported algorithm, pinned issuer/audience, expiry, issued-at, authenticated role and UUID subject. Token-provided key URLs do not choose the JWKS endpoint. It accepts only signed Supabase identities whose provider is Google and authentication method is OAuth; anonymous, password and other-provider identities fail. Server keys never belong in the mobile client. Development identity requires explicit local/test flags.

The mobile code contains Google PKCE and secure session persistence with refresh/revocation/account-switch guards. User reports Google OAuth configured in staging, but no real account, redirect, refresh or native journey was exercised. AUTH-01 remains a release blocker. Public staging JWKS metadata contains one ES256/EC verification key; no user token was used in this check. Sign-in is verified by Supabase Auth; each API call verifies the signed Supabase JWT without a live Google/Auth round-trip. If Google disables an account after token issuance, that JWT can remain usable until its Supabase expiry or revocation; this follows the user's selected policy.

`GET /api/me` reads verified token identity and stored profile facts; unknown names/avatars are null. There is currently no Auth-to-`public.users` profile lifecycle writer. AUTH-02 remains open for profile population, native logout/account isolation, and deletion of owned records plus original storage objects. Auth foreign-key cascades alone cannot delete object storage bytes. Ordinary source deletion must preserve generated study material; account deletion is a separate lifecycle.

Dependencies: [[Momo Database]] ENV-02 -> real-account AUTH-01 -> AUTH-02 -> release device QA-01. AUTH-02 also needs profile creation and account deletion including original objects; Auth foreign-key cascades alone do not delete Storage bytes. Use synthetic users and notes only in an approved bounded staging smoke; never load/stress test production. See [[Momo Backend Completion 2026-10-14]].
