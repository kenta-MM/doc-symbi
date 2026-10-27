import { createDocument, renameDocument, type DocumentEnvironment } from '../domain/document';
import type { Document } from '../domain/schema';
import { equivalent } from '../domain/equivalence';
import { validateDocument } from '../domain/validate';
import type { DocumentRepository } from './ports/document-repository';
import { RepositoryError } from './errors';

export interface SessionState {
  document: Document | null; baseRevision: number | null; savedSnapshot: Document | null;
  generation: number; dirty: boolean; saveState: 'unsaved' | 'saving' | 'saved' | 'error'; error: Error | null;
}
export class DocumentSession {
  state: SessionState = { document: null, baseRevision: null, savedSnapshot: null, generation: 0, dirty: false, saveState: 'unsaved', error: null };
  private listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  private pending = 0;
  constructor(readonly repository: DocumentRepository, readonly environment: DocumentEnvironment) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private update(change: Partial<SessionState>): void {
    this.state = { ...this.state, ...change };
    for (const listener of this.listeners) listener();
  }
  create(title: string): void {
    if (this.pending) throw new Error('保存の完了を待ってください');
    this.update({ document: createDocument(title, this.environment), baseRevision: null, savedSnapshot: null, generation: 0, dirty: true, saveState: 'unsaved', error: null });
  }
  close(): void {
    if (this.pending) throw new Error('保存の完了を待ってください');
    this.update({ document: null, baseRevision: null, savedSnapshot: null, generation: 0, dirty: false, saveState: 'unsaved', error: null });
  }
  async load(id: string, expectedState?: SessionState): Promise<void> {
    await this.queue;
    if (expectedState && this.state !== expectedState) return;
    const stored = await this.repository.get(id);
    if (expectedState && this.state !== expectedState) return;
    this.update({ document: stored.document, baseRevision: stored.revision, savedSnapshot: structuredClone(stored.document), generation: 0, dirty: false, saveState: 'saved', error: null });
  }
  accept(document: Document): void {
    const valid = validateDocument(document);
    if (!this.state.document || valid.id !== this.state.document.id) throw new Error('編集対象が異なります');
    const dirty = !equivalent(valid, this.state.savedSnapshot);
    this.update({ document: valid, generation: this.state.generation + 1, dirty,
      saveState: this.pending ? 'saving' : dirty ? 'unsaved' : 'saved' });
  }
  rename(title: string): void {
    if (!this.state.document) throw new Error('文書を開いてください');
    this.accept(renameDocument(this.state.document, title, this.environment.clock));
  }
  save(): Promise<void> {
    this.pending++;
    const run = this.queue.then(async () => {
      if (!this.state.document) throw new Error('文書を開いてください');
      const snapshot = structuredClone(this.state.document);
      const generation = this.state.generation;
      const revision = this.state.baseRevision;
      this.update({ saveState: 'saving', error: null });
      try {
        const saved = revision === null ? await this.repository.create(snapshot) : await this.repository.save(snapshot, revision);
        const dirty = generation !== this.state.generation && !equivalent(this.state.document, snapshot);
        this.update({ baseRevision: saved.revision, savedSnapshot: snapshot, dirty, saveState: dirty ? 'unsaved' : 'saved', error: null });
      } catch (error) {
        const failure = error instanceof Error ? error : new RepositoryError('StorageUnavailable', '保存できません');
        this.update({ saveState: 'error', error: failure }); throw failure;
      }
    }).finally(() => { this.pending--; });
    this.queue = run.catch(() => undefined);
    return run;
  }
}
