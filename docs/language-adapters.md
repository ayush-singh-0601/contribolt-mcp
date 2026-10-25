# Language adapters

The 12 built-in ecosystems are JavaScript/TypeScript, Python, Go, Rust, Java, Kotlin, C/C++, C#/F#/.NET, Ruby, PHP, Swift, and Dart/Flutter. Each has detection and command-planning tests. Native execution availability depends on the machine; fixture coverage is not proof that a compiler ran.

Scala, Groovy, Elixir, Erlang, Haskell, OCaml, Lua, Perl, R, Julia, Zig, Nim, Clojure, Objective-C, Solidity, Move, SQL, Shell, PowerShell, Terraform/HCL, Nix, YAML and unknown languages use documented commands or an explicitly trusted community adapter. Unsupported/missing verification is reported as UNAVAILABLE.

An adapter exports a default object with `id`, `detect(repo)`, `planEnvironment(repo)`, `commands(repo)`, and `parseResults(output)`. Commands must follow the shared schema and remain within the approved workspace. Prefer documented commands and project-supported tool versions. Format checks must not rewrite files.

Install adapters outside contribution repositories. Inspect their complete code and dependencies, then run `mergepilot trust-adapter /absolute/path/adapter.mjs` yourself in an interactive terminal. Executable adapters run with the server's privileges; they are trusted plugins, not sandboxed project data. The entry module is pinned by SHA-256; changes require renewed trust. Use locked or bundled dependencies when distributing an adapter. Repository instructions cannot install or trust adapters.

`conformAdapter` provides runtime interface/command validation for extension authors. Missing capabilities should return no command plus an environment requirement, never a fabricated passing check. Bootstrap commands must use kind `bootstrap`, require network consent where applicable, and remain separate from test evidence.

The CI workflow passes package validation on Linux, macOS and Windows and executes a failing regression followed by a focused fix and every planned command for all 12 initial native adapters. These selected-driver fixtures do not cover every alternative manager or framework. Exact scope is recorded in the release report and machine CI evidence.

The execution plan also returns bounded CI `run`/`script` excerpts as `ciCommandCandidates`. They are untrusted suggestions with source lines, not automatically runnable commands. Inspect the full job, environment and working directory. The host can pass up to 20 reviewed `additionalCommands` to `get_execution_plan`; each must satisfy the command schema, stay in the workspace, and contain no detected secret. These commands are persisted with the session and still require approved execution and captured evidence. Review matrix substitutions and external-service requirements manually.
