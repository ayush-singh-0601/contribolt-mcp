import { defineAdapter, command, text } from '../adapter.js';
export const rust = defineAdapter({
  id: 'rust',
  matches: (f) => f === 'Cargo.toml',
  tools: ['cargo'],
  requirements: (r) => [text(r, 'rust-toolchain.toml') || 'Project-supported Rust toolchain'],
  bootstrap: (r) => [
    command(r, 'rust', 'bootstrap', 'cargo', ['fetch', '--locked'], 'Cargo.toml', false),
  ],
  commands: (r) => [
    command(r, 'rust', 'test', 'cargo', ['test', '--locked'], 'Cargo.toml'),
    command(r, 'rust', 'lint', 'cargo', ['clippy', '--all-targets', '--locked'], 'Cargo.toml'),
    command(r, 'rust', 'format_check', 'cargo', ['fmt', '--', '--check'], 'Cargo.toml'),
    command(r, 'rust', 'build', 'cargo', ['build', '--locked'], 'Cargo.toml'),
  ],
});
