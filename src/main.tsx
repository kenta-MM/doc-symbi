import { createRoot } from 'react-dom/client';
import { IndexedDbRepository } from './infrastructure/indexeddb/document-repository';
import { FileDocumentRepository } from './infrastructure/files/document-repository';
import { DocumentSession } from './application/document-session';
import { EditorController } from './editor/editor-controller';
import { App } from './ui/App';
import './ui/styles.css';
const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');
const environment = { id: () => crypto.randomUUID(), clock: () => new Date().toISOString() };
const storage = new FileDocumentRepository(new IndexedDbRepository());
const session = new DocumentSession(storage, environment);
function createEditor(host: HTMLElement) {
  const controller = new EditorController(host, () => {
    if (!session.state.document) throw new Error('文書を開いてください');
    return session.state.document;
  }, environment, error => { host.dispatchEvent(new CustomEvent('editor-error', { detail: error.message, bubbles: true })); });
  controller.onAcceptedChange(document => session.accept(document));
  return controller;
}
createRoot(root).render(<App session={session} createEditor={createEditor} storage={storage} />);
