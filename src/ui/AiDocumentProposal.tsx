import { useState } from 'react';
import type { AiDocumentAction } from '../application/ai-document-actions';

export function AiDocumentProposal({ action, applied, disabled, apply }: { action: AiDocumentAction; applied: boolean; disabled: boolean; apply: () => void }) {
  const [error, setError] = useState('');
  const blocks = action.type === 'create' ? action.blocks : action.operations.flatMap(operation => operation.type === 'replace' ? [operation.block] : operation.type === 'insert' ? operation.blocks : []);
  return <section className="ai-document-proposal" aria-label={action.type === 'create' ? '文書の作成案' : '文書の修正案'}>
    <strong>{action.type === 'create' ? action.title : '開いている文書への変更案'}</strong>
    {action.type === 'create' && <p>作成先：{action.folderPath || 'ルート'}</p>}
    {action.type === 'update' && action.title && <p>文書名：{action.title}</p>}
    <details><summary>内容を確認</summary>
      {action.type === 'update' && <p>置き換え {action.operations.filter(item => item.type === 'replace').length} 件・追加 {action.operations.filter(item => item.type === 'insert').length} 件・削除 {action.operations.filter(item => item.type === 'delete').length} 件</p>}
      {blocks.map((block, index) => <div className="ai-proposed-block" key={index}>
        {block.kind === 'heading' ? <strong>{block.text}</strong> : block.kind === 'list' ? (block.style === 'ordered' ? <ol>{block.items.map((text, i) => <li key={i}>{text}</li>)}</ol> : <ul>{block.items.map((text, i) => <li key={i}>{text}</li>)}</ul>) : block.kind === 'table' ? <div className="ai-proposed-table"><table><tbody>{block.rows.map((row, i) => <tr key={i}>{row.map((text, j) => <td key={j}>{text}</td>)}</tr>)}</tbody></table></div> : block.kind === 'code' ? <pre>{block.text}</pre> : <p>{block.text}</p>}
      </div>)}
    </details>
    {applied ? <p role="status">適用しました。文書の「保存」で保存できます。</p> : <><p>適用後に本文を確認し、「保存」で保存できます。</p><button className="primary" disabled={disabled} onClick={() => { try { apply(); setError(''); } catch (error) { setError(error instanceof Error ? error.message : '適用できませんでした。'); } }}>{action.type === 'create' ? '文書を作成' : '変更を適用'}</button></>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
