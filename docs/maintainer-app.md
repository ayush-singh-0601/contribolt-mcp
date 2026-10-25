# Opt-in maintainer App

Use a dedicated local profile or self-hosted instance for an installed GitHub App. Configure `MERGEPILOT_APP_ID`, `MERGEPILOT_APP_KEY` (private PEM), and `MERGEPILOT_INSTALLATION_ID` through the server environment or a secret manager. Do not put keys into repository files, prompts, tool arguments or dashboard synchronization. The auth provider creates short-lived JWTs and refreshes installation tokens before expiration.

Grant only needed repository access: metadata and contents reads for discovery, issues/PR/check reads for evidence, and public-write permissions only when publication/review features are enabled. GitHub permissions and organization restrictions remain authoritative. Installing an App does not approve a contribution.

To opt into webhooks, configure a random `MERGEPILOT_WEBHOOK_SECRET` of at least 32 characters and the expected installation id. The optional HTTP service exposes `/webhooks/github`. Configure the desired GitHub events on the App. The receiver authenticates raw bytes with HMAC-SHA256, verifies installation scope, deduplicates delivery ids and ignores private repositories. Events invalidate stale approvals/evidence and make monitoring refreshable; they never execute repository code or publish replies.

Installation suspension/deletion blocks App-authenticated operation until the installation is active again. Delivery metadata and affected-session audit events are retained locally; raw webhook bodies are not stored.
