---
test_id: pr019-negative
expected_rules:
forbidden_rules: PR019
language: en
args: --format=json --no-config --rules=PR019 -
expect_exit: 0
---
You are a senior platform engineer. We need to migrate the OAuth2 layer from Auth0 to Keycloak while keeping JWT signing keys rotated through Vault. Document the Postgres schema changes and the Kubernetes ingress path. Include a rollback plan and an audit trail for the OIDC handshake. Mention how Stripe webhooks should be reauthorized after the cutover so the Sentry alerts do not page the team.
