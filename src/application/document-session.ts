import { createDocument, renameDocument, type DocumentEnvironment } from '../domain/document';
import type { Document } from '../domain/schema';
import { equivalent } from '../domain/equivalence';
import { validateDocument } from '../domain/validate';
import type { DocumentRepository } from './ports/document-repository';
import { RepositoryError } from './errors';

export interface SessionState {
  document: Document | null; baseRevision: number | null; savedSnapshot: Document | null;
  generation: number; loadVersion: number; draftTitle: string | null;
  dirty: boolean; saveState: 'unsaved' | 'saving' | 'saved' | 'error'; error: Error | null;
}
export class DocumentSession {
  state: SessionState = { document: null, baseRevision: null, savedSnapshot: null, generation: 0, loadVersion: 0, draftTitle: null, dirty: false, saveState: 'unsaved', error: null };
  private listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  private pending = 0;
  private loadRequest = 0;
  private creationFolder = '';
  constructor(readonly repository: DocumentRepository, readonly environment: DocumentEnvironment) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  isCurrent(state: SessionState): boolean {
    return this.state.loadVersion === state.loadVersion && this.state.generation === state.generation;
  }
  private update(change: Partial<SessionState>): void {
    this.state = { ...this.state, ...change };
    for (const listener of this.listeners) listener();
  }
  create(title: string, folderPath = ''): void {
    if (this.pending) throw new Error('保存の完了を待ってください');
    this.loadRequest++;
    this.creationFolder = folderPath;
    this.update({ document: createDocument(title, this.environment), baseRevision: null, savedSnapshot: null, generation: 0, loadVersion: this.state.loadVersion + 1, draftTitle: null, dirty: true, saveState: 'unsaved', error: null });
  }
  close(): void {
    if (this.pending) throw new Error('保存の完了を待ってください');
    this.loadRequest++;
    this.update({ document: null, baseRevision: null, savedSnapshot: null, generation: 0, loadVersion: this.state.loadVersion + 1, draftTitle: null, dirty: false, saveState: 'unsaved', error: null });
  }
  async load(id: string, expectedState?: SessionState): Promise<boolean> {
    const request = ++this.loadRequest;
    const initial = expectedState ?? this.state;
    await this.queue;
    if (request !== this.loadRequest || (expectedState && !this.isCurrent(initial))) return false;
    if (!this.isCurrent(initial)) throw new Error('文書が変更されたため読み込みを中止しました');
    const stored = await this.repository.get(id);
    if (request !== this.loadRequest || (expectedState && !this.isCurrent(initial))) return false;
    if (!this.isCurrent(initial)) throw new Error('文書が変更されたため読み込みを中止しました');
    this.update({ document: stored.document, baseRevision: stored.revision, savedSnapshot: structuredClone(stored.document), generation: 0, loadVersion: this.state.loadVersion + 1, draftTitle: null, dirty: false, saveState: 'saved', error: null });
    return true;
  }
  accept(document: Document): void {
    const valid = validateDocument(document);
    if (!this.state.document || valid.id !== this.state.document.id) throw new Error('編集対象が異なります');
    const dirty = !equivalent(valid, this.state.savedSnapshot) || (this.state.draftTitle !== null && this.state.draftTitle !== valid.title);
    this.update({ document: valid, generation: this.state.generation + 1, dirty,
      saveState: this.pending ? 'saving' : dirty ? 'unsaved' : 'saved' });
  }
  rename(title: string): void {
    if (!this.state.document) throw new Error('文書を開いてください');
    const document = renameDocument(this.state.document, title, this.environment.clock);
    this.update({ draftTitle: null });
    this.accept(document);
  }
  setTitleDraft(title: string): void {
    if (!this.state.document) return;
    const draftTitle = title === this.state.document.title ? null : title;
    const dirty = draftTitle !== null || !equivalent(this.state.document, this.state.savedSnapshot);
    this.update({ draftTitle, generation: this.state.generation + 1, dirty,
      saveState: this.pending ? 'saving' : dirty ? 'unsaved' : 'saved' });
  }
  save(): Promise<void> {
    if (this.state.draftTitle !== null) {
      try { this.rename(this.state.draftTitle); } catch (error) { return Promise.reject(error); }
    }
    this.pending++;
    const run = this.queue.then(async () => {
      if (!this.state.document) throw new Error('文書を開いてください');
      const snapshot = structuredClone(this.state.document);
      const generation = this.state.generation;
      const revision = this.state.baseRevision;
      this.update({ saveState: 'saving', error: null });
      try {
        const saved = revision === null ? await this.repository.create(snapshot, this.creationFolder) : await this.repository.save(snapshot, revision);
        const dirty = this.state.draftTitle !== null || (generation !== this.state.generation && !equivalent(this.state.document, snapshot));
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
