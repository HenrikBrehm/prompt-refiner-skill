---
test_id: pr019-positive
expected_rules: PR019
forbidden_rules:
language: en
args: --format=json --no-config --rules=PR019 -
expect_exit: 0
---
We need to migrate the OAuth2 layer from Auth0 to Keycloak while keeping JWT signing keys rotated through Vault. Document the Postgres schema changes and the Kubernetes ingress path. Include a rollback plan and an audit trail for the OIDC handshake. Mention how Stripe webhooks should be reauthorized after the cutover so the Sentry alerts do not page the team.
