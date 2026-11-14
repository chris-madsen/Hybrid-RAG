import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

// Remove only TypeSpec-owned generated artifacts. An obsolete emitted schema
// must disappear, not survive as a stale tracked contract or SDK symbol.
rmSync(resolve(import.meta.dirname, '../generated'), { recursive: true, force: true });
