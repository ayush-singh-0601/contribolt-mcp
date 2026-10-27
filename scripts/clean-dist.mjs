import { rm } from 'node:fs/promises';

// A fresh build must not package modules left behind by deleted source files.
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
