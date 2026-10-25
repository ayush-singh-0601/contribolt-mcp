# Forge configuration

GitHub is enabled by default. Additional instances are explicitly configured through `MERGEPILOT_FORGES`, a JSON array such as `[{"kind":"gitlab","host":"gitlab.com","tokenEnv":"GITLAB_TOKEN","enabled":true}]`. Set the referenced credential in the server environment; do not place it in issue text or tool arguments. Only configured HTTPS instance hosts are contacted.

GitLab uses its v4 API, including issue notes with system events excluded, related merge requests, project membership, repository files, forks, native Git pushes and merge-request reviewer IDs. Merge requests map to the same contribution workflow and approval ledger. Unsupported group reviewer operations produce a permission/capability result rather than a fabricated success. Review/CI metadata that cannot be read remains incomplete.

Authoritative contracts: [GitLab issues API](https://docs.gitlab.com/api/issues/), [GitLab merge requests API](https://docs.gitlab.com/api/merge_requests/), [Forgejo API usage](https://forgejo.org/docs/latest/user/api/usage/). Live instance compatibility and public-write smoke tests require a configured account and explicit action approval; mock contract tests do not establish live compatibility.

Forgejo instances use `kind: "forgejo"` with the same explicit host/token configuration. Discovery checks direct issue metadata, ownership/maintainer evidence, REST timeline references and repository PR scans. Missing timeline support or incomplete scans exclude a candidate in strict mode. Draft publication probes the instance API schema before any public write. CI uses available commit statuses and explicitly reports unavailable additional checks. Instance-specific limitations are reported rather than inferred as success.
