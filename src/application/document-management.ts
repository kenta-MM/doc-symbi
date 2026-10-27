import type { DocumentSession } from './document-session';
export async function deleteCurrentDocument(session: DocumentSession): Promise<void> {
  if (session.state.saveState === 'saving') throw new Error('保存の完了を待ってください');
  const initial = session.state;
  const { document, baseRevision } = initial;
  if (!document) return;
  if (baseRevision !== null) await session.repository.delete(document.id, baseRevision);
  if (!session.isCurrent(initial)) {
    if (session.state.document?.id === document.id) throw new Error('保存ファイルは削除されましたが、待機中の変更は保持しています。文書を取り出してください');
    return;
  }
  session.close();
}
