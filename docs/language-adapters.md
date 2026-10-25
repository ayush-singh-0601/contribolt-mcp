# Language adapters

The 12 built-in ecosystems are JavaScript/TypeScript, Python, Go, Rust, Java, Kotlin, C/C++, C#/F#/.NET, Ruby, PHP, Swift, and Dart/Flutter. Each has detection and command-planning tests. Native execution availability depends on the machine; fixture coverage is not proof that a compiler ran.

Scala, Groovy, Elixir, Erlang, Haskell, OCaml, Lua, Perl, R, Julia, Zig, Nim, Clojure, Objective-C, Solidity, Move, SQL, Shell, PowerShell, Terraform/HCL, Nix, YAML and unknown languages use documented commands or an explicitly trusted community adapter. Unsupported/missing verification is reported as UNAVAILABLE.

An adapter exports a default object with `id`, `detect(repo)`, `planEnvironment(repo)`, `commands(repo)`, and `parseResults(output)`. Commands must follow the shared schema and remain within the approved workspace. Prefer documented commands and project-supported tool versions. Format checks must not rewrite files.

Install adapters outside contribution repositories. Inspect their complete code and dependencies, then run `mergepilot trust-adapter /absolute/path/adapter.mjs` yourself in an interactive terminal. Executable adapters run with the server's privileges; they are trusted plugins, not sandboxed project data. The entry module is pinned by SHA-256; changes require renewed trust. Use locked or bundled dependencies when distributing an adapter. Repository instructions cannot install or trust adapters.

`conformAdapter` provides runtime interface/command validation for extension authors. Missing capabilities should return no command plus an environment requirement, never a fabricated passing check. Bootstrap commands must use kind `bootstrap`, require network consent where applicable, and remain separate from test evidence.

The CI workflow validates the package on Linux, macOS and Windows. Actual ecosystem runs and compatibility observations are recorded separately in the release verification report.
