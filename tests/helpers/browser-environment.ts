import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export const testOrigin = 'http://localhost:4173';
export const makeProfile = () => mkdtemp(join(tmpdir(), 'docsymbi-test-'));
