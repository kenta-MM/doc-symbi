import type { DocumentSession } from './document-session';
export async function deleteCurrentDocument(session: DocumentSession): Promise<void> {
  if (session.state.saveState === 'saving') throw new Error('保存の完了を待ってください');
  const { document, baseRevision } = session.state;
  if (!document) return;
  if (baseRevision !== null) await session.repository.delete(document.id, baseRevision);
  session.close();
}
