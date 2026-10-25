# Maintainer acceptance policies

Repository maintainers may commit `.mergepilot/policy.json` on the default branch. GitHub organizations may place the same file in their `.github` repository for organization defaults. The tool retrieves these files through the forge API and records the file revision and source URL. Arbitrary issue attachments and external links are not authoritative manifests.

```json
{
  "schemaVersion": 1,
  "maintainers": ["maintainer-login"],
  "ai": "allowed_with_disclosure",
  "externalPullRequests": true,
  "disclosure": "Describe how AI assistance was used.",
  "blockedLabels": ["security-review"],
  "reservedLabels": ["claimed"],
  "requiredChecks": ["test", "lint"],
  "requireDraft": false,
  "allowAutoClosingReferences": false,
  "cooldownHours": 48,
  "preferredAreas": ["documentation", "tests"]
}
```

Optional `repositories` restricts acceptance to listed full repository names; `excludedRepositories` adds exclusions. Each nonempty `allowedLabels` group must match. `requirePriorDiscussion` prevents autonomous submission until the documented requirement is resolved. `reviewerConventions` stores process guidance; it cannot grant platform permissions or authorize notifications.

Explicit prohibitions from any applicable source remain hard stops. Malformed or incomplete policy evidence remains unknown. Required checks must be represented in the validation plan. Cooldowns use the stricter project/system interval, with one open contribution per repository by default. A manifest never authorizes publication, reviewer requests, credentials, or executable plugins.
