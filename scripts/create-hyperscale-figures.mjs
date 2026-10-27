import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';

const dir = 'docs/hyperscale-figures';
mkdirSync(dir, { recursive: true });
const source = (title, slug) => ({ title, url: `https://learn.microsoft.com/en-us/azure/azure-sql/database/${slug}?view=azuresql`, accessedAt: '2026-10-26' });
const architecture = source('Microsoft Learn: Hyperscale architecture', 'hyperscale-architecture');
const diagnostics = source('Microsoft Learn: Performance diagnostics', 'hyperscale-performance-diagnostics');
const replicas = source('Microsoft Learn: Hyperscale secondary replicas', 'service-tier-hyperscale-replicas');
const common = ['論理構成の概念図。物理配置・内部冗長台数・ネットワーク設定を表さない。', '矢印は relationships の from から to の向き。双方向矢印は要求と応答の往復を表す。', '記載した事実は参照日時点の Microsoft Learn に基づく。サービス上限・対応地域は導入時に再確認する。'];
const entity = (id, label, role, x, y, w = 250, h = 86, tone = 'compute') => ({ id, label, role, x, y, w, h, tone });
const edge = (from, to, meaning, path, x, y, label = meaning, tone = 'data', both = false) => ({ from, to, meaning, path, x, y, label, tone, both });
const figures = [
  { number: 1, title: '処理・ログ・保存の分離', subtitle: '全体構成  /  Compute・Log Service・Page Server・Azure Storage',
    purpose: 'Hyperscale の主要コンポーネントの責務と、ページ取得経路・ログ配布経路の違いを理解する。',
    summary: 'Primary が更新を処理し、Log Service が変更ログをページサーバーと読み取りレプリカへ配布する。Compute は Page Server から必要なページを取得し、永続データは Azure Storage に保存される。',
    assumptions: [...common, 'HA / Named は同じ保存領域を共有する。Geo replica はこの図には含めない。', 'Compute のメモリとローカルSSD（RBPEX）キャッシュをまとめて表示。読み取りではまずキャッシュを利用する。'], sources: [architecture, diagnostics],
    entities: [entity('app', '更新アプリ', 'SQL の読み書きを Primary に要求する。', 50, 120, 230), entity('readers', '参照アプリ', '読み取り処理をレプリカへ要求する。', 720, 120, 230),
      entity('primary', 'Primary Compute', 'SQL・更新処理。メモリとRBPEXキャッシュを持つ。', 50, 300, 230), entity('log', 'Log Service', '更新ログの永続化と各コンポーネントへの配布。', 385, 300, 230, 86, 'log'), entity('replicas', 'HA / Named', '読み取り系Compute。共有ストレージを利用する。', 720, 300, 230),
      entity('pages', 'Page Servers', 'ページを提供し、受信したログで担当データを更新する。', 385, 520, 230, 86, 'storage'), entity('storage', 'Azure Storage', 'データファイルとスナップショットを永続保存する。', 385, 700, 230, 86, 'storage'), entity('logs', '長期ログ保存', '復元に利用するトランザクションログを保持する。', 50, 700, 230, 86, 'storage')],
    edges: [edge('app','primary','SQL の読み書き要求','M165 206 V300',190,255,'読み書き'),edge('readers','replicas','SQL の読み取り要求','M835 206 V300',850,255,'読み取り'),edge('primary','log','更新ログの送信','M280 343 H385',330,327,'ログ','log'),edge('log','replicas','変更ログを配布する','M615 343 H720',665,327,'ログ','log'),edge('log','pages','ページ更新のためのログを配布する','M500 386 V520',535,458,'ログ適用','log'),edge('primary','pages','ページ要求と応答（キャッシュミス時）','M165 386 V563 H385',210,540,'ページ取得','data',true),edge('replicas','pages','読み取りレプリカのページ要求と応答','M835 386 V563 H615',785,540,'ページ取得','data',true),edge('pages','storage','データファイルを永続化する','M500 606 V700',560,659,'データ保存'),edge('log','logs','ログを長期保存する','M410 386 V460 H70 V700',162,445,'ログの長期保存','log')],
  },
  { number: 2, title: '必要なページを段階的に取得', subtitle: '読み取り経路  /  キャッシュヒットとリモート読み取り',
    purpose: 'SELECT のページ取得がメモリ、ローカルSSD、Page Server を使い分けることを理解する。',
    summary: 'メモリにないページをRBPEXで探し、そこにもなければPage Serverへ要求する。要求LSNに達するまで待機する場合があり、取得後はComputeでクエリを処理する。',
    assumptions: [...common, 'ページ取得の概念図であり、SQL実行計画や全I/Oの時系列を表すものではない。', '結果生成はComputeのクエリ処理で行う。Page ServerがSQLを実行する意味ではない。'], sources: [diagnostics],
    entities: [entity('memory','メモリ / Buffer Pool','Compute上で必要なページを検索する。',80,160,430), entity('rbpex','ローカルSSD / RBPEX','メモリにないページをComputeのSSDキャッシュで検索する。',80,350,430),entity('pages','Page Server','キャッシュにないページを要求されたLSNで提供する。',80,550,430,100,'storage'),entity('query','Compute でクエリ処理','取得したページを使ってSQLを処理する。',680,350,260,100),entity('result','アプリへ結果を返す','SQLの実行結果を返す。',680,700,260)],
    edges: [edge('memory','rbpex','メモリにページがない場合','M295 246 V350',380,300,'キャッシュミス'),edge('rbpex','pages','RBPEXにページがない場合','M295 436 V550',380,495,'キャッシュミス'),edge('memory','query','メモリのページを利用する','M510 203 H810 V350',680,185,'ヒット'),edge('rbpex','query','RBPEXのページを利用する','M510 393 H680',590,375,'ヒット'),edge('pages','query','要求LSNのページを受信する。追従が必要なら待機する','M510 600 H810 V450',730,625,'LSN確認後に返す'),edge('query','result','クエリ処理の結果を返す','M940 400 H965 V743 H940',900,680,'結果')],
  },
  { number: 3, title: '更新はログを通じて伝わる', subtitle: '更新経路  /  永続化と非同期のログ適用',
    purpose: '更新ログの永続化と、ページ／読み取りレプリカへの反映が別の役割であることを理解する。',
    summary: 'Primary は Log Service にログを送る。ログは Log Service で永続化され、Page Server によるデータ更新、読み取りレプリカの非同期適用、長期ログ保存につながる。',
    assumptions: [...common, '矢印の分岐は各コンポーネントへの伝播を表し、完了時刻の同一性を保証しない。', 'コミット時の永続化先はLog Service。すべての読み取りレプリカへの適用完了を意味しない。', 'Primary が Page Server へデータページを直接書き込む方式ではない。'], sources: [architecture, diagnostics],
    entities: [entity('primary','Primary Compute','UPDATE等のトランザクションを処理する。',70,160,300),entity('log','Log Service','コミットに必要なログを永続化し、配布する。',590,160,300,100,'log'),entity('pages','Page Servers','担当するページにログを適用する。',50,470,270,100,'storage'),entity('replica','読み取りレプリカ','ログを非同期に適用する。反映遅延があり得る。',365,470,270,100),entity('logs','長期ログ保存','バックアップ保持期間内の復元に利用する。',680,470,270,100,'storage'),entity('data','データファイル','Page Serverが更新する永続データ。',50,700,270,86,'storage')],
    edges: [edge('primary','log','更新ログを送信する','M370 203 H590',475,183,'ログ送信','log'),edge('log','pages','担当ページの更新に必要なログを配布する','M650 260 V365 H185 V470',310,347,'ログ配布','log'),edge('log','replica','読み取りレプリカへログを非同期に適用する','M740 260 V400 H500 V470',625,424,'非同期適用','log'),edge('log','logs','ログを長期保存へ送る','M830 260 V350 H815 V470',885,365,'長期保存','log'),edge('pages','data','ログに従ってデータファイルを更新する','M185 570 V700',275,640,'データ更新')],
  },
  { number: 4, title: '読み取り分散と地域障害への備え', subtitle: 'レプリカ構成  /  共有ストレージと独立ストレージの違い',
    purpose: 'HA・Named replicaとGeo replicaの保存領域および障害分離の違いを理解する。',
    summary: 'Region AのPrimary・HA・Namedは同じPage Serverを共有する。Region BのGeo replicaは独立したPage ServerとStorageを持ち、非同期レプリケーションで追従する。',
    assumptions: [...common, 'Region A と Region B は例示の別リージョン。実際の地域名を指定していない。', 'ストレージへの接続線は共有／独立の関係を示す。Computeによるデータページ直接書き込みを意味しない。', 'Geo replicaは非同期のため、強制フェールオーバーでデータ損失が起こり得る。HAやNamedの追加だけで地域災害対策にはならない。', 'Log Serviceと詳細な内部冗長構成は省略。Namedは読み取り分散用で、PrimaryのHA待機系とは役割が異なる。'], sources: [replicas, architecture], regions: true,
    entities: [entity('primary','Primary','Region Aの読み書きCompute。',70,200,160),entity('ha','HA replica','Region Aの待機系および読み取りCompute。',270,200,160),entity('named','Named replica','Region Aの独立したサービスレベルを持つ読み取りCompute。',70,370,360),entity('pagesA','共有 Page Servers A','Primary・HA・Namedが共有するページ保存層。',70,550,360,86,'storage'),entity('storageA','Storage A','Region Aの永続保存領域。',70,720,360,86,'storage'),entity('geo','Geo replica','Region Bに配置した非同期レプリカ。災害復旧用。',580,200,340),entity('pagesB','独立 Page Servers B','Primaryと共有しない、Geo専用のページ保存層。',580,550,340,86,'storage'),entity('storageB','Storage B','Region Bの独立した永続保存領域。',580,720,340,86,'storage')],
    edges: [edge('primary','geo','別リージョンのGeo replicaへ非同期レプリケーションする','M150 200 V130 H750 V200',510,115,'非同期レプリケーション','log'),edge('primary','pagesA','Primaryが共有Page Serverを利用する','M150 286 V320 H50 V593 H70',125,525,'共有ストレージ'),edge('ha','pagesA','HAがPrimaryと同じPage Serverを利用する','M350 286 V320 H450 V593 H430',385,525,'共有'),edge('named','pagesA','NamedがPrimaryと同じPage Serverを利用する','M250 456 V550',305,500,'共有'),edge('pagesA','storageA','Region Aの永続保存','M250 636 V720',310,685,'保存'),edge('geo','pagesB','Geoが独立したPage Serverを利用する','M750 286 V550',830,425,'独立ストレージ'),edge('pagesB','storageB','Region Bの永続保存','M750 636 V720',810,685,'保存')],
  },
];
const esc = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const colors = { compute: ['#eaf3ff','#3174b8'], log: ['#fff0dc','#ac6418'], storage: ['#e7f5ed','#287254'], data: ['#eaf3ff','#3174b8'] };
function svg(figure) {
  const nodes = figure.entities.map(n => `<g id="${n.id}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="14" fill="${colors[n.tone][0]}" stroke="${colors[n.tone][1]}" stroke-width="2"/><text x="${n.x+n.w/2}" y="${n.y+n.h/2+7}" text-anchor="middle" font-size="${n.w < 200 ? 20 : 23}" font-weight="600">${esc(n.label)}</text></g>`).join('');
  const arrows = figure.edges.map((e,i) => `<g id="relation-${i+1}"><path d="${e.path}" fill="none" stroke="${colors[e.tone][1]}" stroke-width="3" marker-end="url(#${e.tone})" ${e.both ? `marker-start="url(#${e.tone})"` : ''}/><text x="${e.x}" y="${e.y}" text-anchor="middle" font-size="17" fill="${colors[e.tone][1]}" stroke="#fff" stroke-width="5" paint-order="stroke">${esc(e.label)}</text></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="920" viewBox="0 0 1000 920" role="img" aria-labelledby="title desc"><title id="title">図${figure.number}：${esc(figure.title)}</title><desc id="desc">${esc(figure.summary)}</desc><defs>${['data','log'].map(t=>`<marker id="${t}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="${colors[t][1]}"/></marker>`).join('')}</defs><rect width="1000" height="920" rx="18" fill="white"/><g font-family="Yu Gothic, Meiryo, sans-serif" fill="#1c3545"><text x="40" y="48" font-size="28" font-weight="700">${figure.number.toString().padStart(2,'0')}  ${esc(figure.title)}</text><text x="40" y="83" font-size="16" fill="#526878">${esc(figure.subtitle)}</text>${figure.regions ? '<rect x="30" y="155" width="440" height="675" rx="16" fill="#f5f8fc" stroke="#bdcfe0"/><rect x="540" y="155" width="420" height="675" rx="16" fill="#f2faf6" stroke="#bbd9c9"/><text x="50" y="184" font-size="18" fill="#526878">Region A</text><text x="560" y="184" font-size="18" fill="#526878">Region B</text>' : ''}${arrows}${nodes}<line x1="40" y1="855" x2="960" y2="855" stroke="#dce5eb"/><text x="40" y="883" font-size="15" fill="#526878">青：ページ取得・利用関係  橙：ログ／レプリケーション  緑の枠：保存層</text><text x="40" y="907" font-size="13" fill="#657887">Microsoft Learn に基づく概念図 · 2026-10-26 · 物理配置や冗長台数は省略</text></g></svg>`;
}
const docPath = 'docs/azure-sql-hyperscale.docsymbi.json';
const original = JSON.parse(readFileSync(docPath,'utf8'));
const blocks = figures.map(figure => {
  const fileName = `figure-${figure.number}.svg`;
  const content = svg(figure);
  writeFileSync(`${dir}/${fileName}`,content);
  const semantics = { version:1,purpose:figure.purpose,summary:figure.summary,entities:figure.entities.map(({id,label,role})=>({id,label,role})),relationships:figure.edges.map(({from,to,meaning})=>({from,to,meaning})),readingOrder:figure.entities.map(n=>n.id),assumptions:figure.assumptions,sources:figure.sources };
  const existing = original.blocks.find(b=>b.kind==='image' && b.file.fileName===fileName);
  const block = {kind:'image',id:existing?.id??randomUUID(),metadata:{figureNumber:figure.number,author:'DocSymbi / AI-assisted',representation:'conceptual-diagram'},file:{id:existing?.file.id??randomUUID(),fileName,mimeType:'image/svg+xml',byteLength:Buffer.byteLength(content),width:1000,height:920,data:Buffer.from(content).toString('base64')},caption:`図${figure.number}：${figure.title}`,alt:figure.summary,semantics};
  writeFileSync(`${dir}/figure-${figure.number}.info.json`,JSON.stringify({imageBlockId:block.id,imageFileId:block.file.id,fileName,caption:block.caption,alt:block.alt,semantics},null,2)+'\n');
  return block;
});
original.blocks = original.blocks.flatMap(block => {
  if(block.kind==='image' && block.metadata.figureNumber) return [blocks[block.metadata.figureNumber-1]];
  if(block.kind!=='code') return [block];
  if(block.text.startsWith('図1')) return [blocks[0]];
  if(block.text.startsWith('図2')) return [blocks[1],blocks[2]];
  if(block.text.startsWith('図4')) return [blocks[3]];
  return [block];
});
original.schemaVersion = 2;
original.updatedAt = new Date().toISOString();
writeFileSync(docPath,JSON.stringify(original,null,2)+'\n');
console.log('Created four SVG diagrams, four semantic JSON files and updated the portable document.');
