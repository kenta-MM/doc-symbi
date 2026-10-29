import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';

const articleRoot = 'C:/Users/mkrcn/Downloads/test';
const dir = `${articleRoot}/azure-vm-sql-always-on`;
mkdirSync(dir, { recursive: true });
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const colors = { blue: '#1260b4', teal: '#087e78', purple: '#7651a8', gray: '#53657b' };
const figures = [];
function figure(file, title, subtitle, height, purpose, assumptions, urls) {
  const parts = [];
  const entities = [], relationships = [];
  const text = (x, y, lines, size = 20, color = '#172c46', anchor = 'start') => {
    parts.push(`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}">${lines.map((line, i) => `<tspan x="${x}" dy="${i ? 30 : 0}">${esc(line)}</tspan>`).join('')}</text>`);
  };
  const panel = (x, y, w, h, label) => {
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#f4f7fc" stroke="#cbd7e7"/>`);
    text(x + 20, y + 34, [label], 21, colors.gray);
  };
  const box = (id, x, y, w, h, lines, tone = 'blue', role = lines.join(' / ')) => {
    entities.push({ id, label: lines[0], role });
    parts.push(`<g id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="white" stroke="${colors[tone]}" stroke-width="2"/>`);
    text(x + w / 2, y + 34, lines, 20, colors[tone], 'middle'); parts.push('</g>');
  };
  const arrow = (from, to, path, label, x, y, tone = 'blue', dashed = false, meaning = label) => {
    relationships.push({ from, to, meaning });
    parts.push(`<path d="${path}" fill="none" stroke="${colors[tone]}" stroke-width="3" ${dashed ? 'stroke-dasharray="8 7"' : ''} marker-end="url(#${tone})"/>`);
    if (label) text(x, y, [label], 18, colors[tone], 'middle');
  };
  text(36, 48, [title], 28); text(36, 85, [subtitle], 18, colors.gray);
  const finish = summary => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><desc>${esc(summary)}</desc><defs>${Object.entries(colors).map(([name, color]) => `<marker id="${name}" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="${color}"/></marker>`).join('')}</defs><rect width="1200" height="${height}" fill="white"/><g font-family="Yu Gothic, Meiryo, sans-serif">${parts.join('')}</g></svg>`;
    writeFileSync(`${dir}/${file}`, svg);
    figures.push({ file, svg, title, height, summary, semantics: { version: 1, purpose, summary, entities, relationships, readingOrder: entities.map(e => e.id), assumptions, sources: urls.map(([title, url]) => ({ title, url, accessedAt: '2026-10-27' })) } });
  };
  return { text, panel, box, arrow, finish };
}
const overview = ['Azure VM上のAG', 'https://learn.microsoft.com/ja-jp/azure/azure-sql/virtual-machines/windows/availability-group-overview?view=azuresql'];
const modes = ['可用性モード', 'https://learn.microsoft.com/en-us/sql/database-engine/availability-groups/windows/availability-modes-always-on-availability-groups?view=sql-server-ver17'];
const disks = ['マネージドディスクの冗長性', 'https://learn.microsoft.com/ja-jp/azure/virtual-machines/disks-redundancy'];
{
  const f = figure('01-architecture.svg', '01  AGを構成する場所と役割', '複数サブネットVNN / 2レプリカ・2データベース / 独立したストレージ', 920, 'アプリ接続、SQLログ同期、WSFC管理の責務を区別する。', ['Windows Server 2022 / SQL Server 2022 Enterpriseの通常AG。', 'ZoneとSubnetは別の配置軸。図はそれぞれを分けた例。', 'Listenerは論理接続先であり独立VMではない。', '青=アプリ接続、緑=データ/ログ、紫破線=クラスター管理。', 'AD DS/DNSとその通信は省略。WitnessはSQLデータを保持しない。'], [overview]);
  f.box('app', 50, 120, 260, 85, ['アプリケーション', '再接続・リトライ']);
  f.box('listener', 450, 120, 640, 85, ['VNN Listener：sql-listener', 'DNS名＋SubnetごとのIP＋ポート']);
  f.arrow('app', 'listener', 'M310 162 H450', 'SQL接続', 380, 145);
  f.panel(40, 260, 460, 390, 'Zone 1 / Subnet A：VM A');
  f.panel(700, 260, 460, 390, 'Zone 2 / Subnet B：VM B');
  f.box('sqlA', 70, 325, 400, 125, ['SQL Server A', 'AG-Production：Primary', 'SalesDB / CustomerDB']);
  f.box('sqlB', 730, 325, 400, 125, ['SQL Server B', 'AG-Production：Secondary', 'SalesDB / CustomerDB']);
  f.box('diskA', 70, 510, 400, 95, ['A専用ディスク', 'データファイル＋ログファイル'], 'teal');
  f.box('diskB', 730, 510, 400, 95, ['B専用ディスク', 'データファイル＋ログファイル'], 'teal');
  f.arrow('listener', 'sqlA', 'M600 205 V230 H480 V310 H270 V325', '現在のPrimaryへ', 380, 224);
  f.arrow('sqlA', 'sqlB', 'M470 390 H730', 'ログ転送', 600, 373, 'teal', false, 'SQLのエンドポイントで直接ログ転送。ListenerやLBを通さない。');
  f.arrow('sqlA', 'diskA', 'M270 450 V510', '永続化', 325, 487, 'teal');
  f.arrow('sqlB', 'diskB', 'M930 450 V510', 'harden / redo', 1030, 487, 'teal');
  f.box('wsfc', 50, 700, 660, 90, ['同一WSFC：VM A / VM Bがノード', '正常性・AG所有者・クォーラム'], 'purple');
  f.box('witness', 830, 700, 320, 90, ['Cloud Witness', 'Azure Storageの仲裁用Blob'], 'purple');
  f.arrow('wsfc', 'sqlA', 'M120 700 V650 H55 V387 H70', '', 0, 0, 'purple', true, 'ノードA上のWSFC機能がAGリソースを管理。');
  f.arrow('wsfc', 'sqlB', 'M650 700 V650 H1145 V387 H1130', '', 0, 0, 'purple', true, 'ノードB上のWSFC機能がAGリソースを管理。');
  f.arrow('wsfc', 'witness', 'M710 745 H830', '仲裁', 770, 728, 'purple', true);
  f.text(50, 850, ['青：アプリの接続　緑：SQLのデータ処理　紫破線：WSFCの管理', 'WSFCの箱は両VMにまたがる論理表示。別のSQL Server VMではない。'], 20);
  f.finish('VM A/Bは各ゾーンに配置。アプリはVNN経由でPrimaryへ接続し、SQL Server同士がログを転送する。WSFCは両ノードのリソースを管理しWitnessで仲裁を補助する。');
}
{
  const f = figure('02-commit-sequence.svg', '02  同期コミットで待つのはharden', '正常に接続され、同期コミットで動作中の2レプリカ例 / 上から下へ時間が進む', 890, '同期コミットの成功応答とredo完了の違いを理解する。', ['ログ転送とローカルI/Oは並行し得る。図は主要な依存関係を簡略化。', 'Secondary切断・タイムアウト時の継続条件は本文を参照。', '非同期でもログ転送とredoは行うが応答待ちの条件が異なる。'], [modes]);
  f.box('app', 50, 125, 260, 65, ['アプリ']); f.box('primary', 470, 125, 260, 65, ['Primary']); f.box('secondary', 890, 125, 260, 65, ['Secondary'], 'teal');
  for (const x of [180, 600, 1020]) f.text(x, 220, ['│','│','│','│','│','│','│','│','│','│','│','│','│','│'], 24, '#bdc8d8', 'middle');
  f.arrow('app', 'primary', 'M180 245 H600', '① 更新要求', 390, 232);
  f.text(620, 290, ['② ローカルログを永続化'], 19);
  f.arrow('primary', 'secondary', 'M600 330 H1020', '③ トランザクションログを転送', 810, 316, 'teal');
  f.text(1020, 380, ['④ ログファイルへharden'], 19, colors.teal, 'middle');
  f.arrow('secondary', 'primary', 'M1020 425 H600', '⑤ 永続化完了のACK', 810, 410, 'teal');
  f.arrow('primary', 'app', 'M600 485 H180', '⑥ COMMIT成功応答', 390, 470);
  f.text(1020, 550, ['redo：データページへ適用', '成功応答はこの完了を待たない'], 18, colors.teal, 'middle');
  f.panel(50, 680, 1100, 155, '非同期コミットとの違い');
  f.text(75, 750, ['Primaryはローカルのログ永続化後に応答でき、SecondaryのACKを待たない。', '遠隔遅延の影響は抑えられるが、障害時には未到達ログの損失可能性がある。'], 21);
  f.finish('同期コミットの成功応答はSecondaryのログ永続化ACKに依存するが、redo完了には依存しない。非同期コミットはSecondaryのACKを待たない。');
}
{
  const f = figure('03-listener-network.svg', '03  VNN Listenerへの2つの接続経路', 'どちらも現在のPrimaryはA / 緑のログ転送経路はListenerやLBから独立', 880, '単一サブネットと複数サブネットで必要なネットワーク構成を比較する。', ['アプリ接続の要求方向を表示。応答パケットは省略。', 'LBのプローブは専用ポートとWSFC IPリソースを連携させる。', '複数サブネットのDNSには両IPが登録され得る。', '専用のDNN方式は本文を参照。'], [overview]);
  f.panel(30, 120, 550, 670, '単一サブネット＋VNN'); f.panel(620, 120, 550, 670, '複数サブネット＋VNN');
  f.box('app1', 80, 180, 450, 65, ['アプリ → Listener名']); f.box('app2', 670, 180, 450, 65, ['アプリ → Listener名']);
  f.box('lb', 80, 305, 450, 100, ['内部Standard Load Balancer', 'フロントエンド＝Listener IP']);
  f.box('ips', 670, 305, 450, 100, ['Subnet AのIP / Subnet BのIP', 'MultiSubnetFailover=True']);
  f.box('a1', 65, 510, 225, 100, ['A：Primary', '同じSubnet']); f.box('b1', 320, 510, 225, 100, ['B：Secondary', '同じSubnet'], 'teal');
  f.box('a2', 655, 510, 225, 100, ['A：Primary', 'Subnet A']); f.box('b2', 910, 510, 225, 100, ['B：Secondary', 'Subnet B'], 'teal');
  f.arrow('app1', 'lb', 'M305 245 V305', '', 0, 0); f.arrow('app2', 'ips', 'M895 245 V305', '', 0, 0);
  f.arrow('lb', 'a1', 'M200 405 V455 H177 V510', 'プローブ応答側へ', 360, 440);
  f.arrow('ips', 'a2', 'M785 405 V455 H767 V510', '有効なIPへ接続', 980, 440);
  f.arrow('a1', 'b1', 'M177 610 V665 H432 V610', 'SQLログ', 305, 695, 'teal');
  f.arrow('a2', 'b2', 'M767 610 V665 H1022 V610', 'SQLログ', 895, 695, 'teal');
  f.text(305, 750, ['LBがPrimaryを選出するわけではない'], 19, colors.gray, 'middle');
  f.text(895, 750, ['Listener用LBは通常不要'], 19, colors.gray, 'middle');
  f.text(50, 835, ['フェールオーバー後：BがPrimaryになり、アプリは同じ名前で新しい接続を確立する。'], 21);
  f.finish('単一サブネットVNNではLBがプローブ応答側へ接続を転送する。複数サブネットVNNではサブネットごとのIPを用い、通常LBは不要。どちらもSQLログはレプリカ間を直接流れる。');
}
{
  const f = figure('04-zones-storage.svg', '04  冗長化の層を分けて考える', 'VMをどこで動かすか / SQLが何を複製するか / ディスクがどこにデータを持つか', 810, 'AGとLRSの組合せ、およびZRSがSQLレプリカを増やさないことを理解する。', ['上段は通常AG、各VM専用のLRSディスク。', 'LRSの3コピーはストレージ内部でありSQLレプリカ数ではない。', '下段のZRSは別の選択例。上段のLRSがさらにZRSへ接続される意味ではない。', 'Witnessのストレージ冗長性とは別の判断。'], [overview, disks]);
  f.panel(40, 130, 450, 370, 'Zone 1'); f.panel(710, 130, 450, 370, 'Zone 2');
  f.box('vmA', 75, 195, 380, 95, ['VM A / SQL Server', 'Primary']); f.box('vmB', 745, 195, 380, 95, ['VM B / SQL Server', 'Secondary']);
  f.box('lrsA', 75, 365, 380, 95, ['独立LRSディスク A', '内部で3コピー'], 'teal'); f.box('lrsB', 745, 365, 380, 95, ['独立LRSディスク B', '内部で3コピー'], 'teal');
  f.arrow('vmA', 'vmB', 'M455 243 H745', 'AG：SQLログ転送', 600, 225, 'teal');
  f.arrow('vmA', 'lrsA', 'M265 290 V365', '', 0, 0, 'teal'); f.arrow('vmB', 'lrsB', 'M935 290 V365', '', 0, 0, 'teal');
  f.panel(40, 550, 1120, 200, '別のディスク選択肢：ZRS');
  f.box('zrs', 75, 615, 340, 95, ['1つのZRSディスク', '論理的に1つのディスク'], 'teal');
  f.box('zones', 645, 615, 470, 95, ['Zone 1 / Zone 2 / Zone 3', 'ストレージ内部で同期複製'], 'teal');
  f.arrow('zrs', 'zones', 'M415 662 H645', 'ディスクデータ', 530, 645, 'teal');
  f.text(50, 788, ['ZRSだけではSQL Serverの複数インスタンスやAGフェールオーバーは作られない。'], 21);
  f.finish('異なるゾーンの2台のVMが独立したLRSディスクを持ち、AGがSQLログを複製する。ZRSはディスク内部のゾーン間同期であり、VMやSQLレプリカを自動作成しない。');
}

// Preserve document identity when regenerating the article.
const output = `${articleRoot}/azure-vm-sql-always-on.docsymbi.json`;
const old = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : null;
const metadata = () => ({});
const plain = text => text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1 — $2').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
const block = (kind, text, more = {}) => ({ kind, id: randomUUID(), metadata: metadata(), text: plain(text), ...more });
const blocks = [];
const lines = readFileSync(`${articleRoot}/azure-vm-sql-always-on.md`, 'utf8').replace(/\r\n/g, '\n').split('\n');
const sourceMap = new Map();
for (const line of lines) for (const match of line.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)) sourceMap.set(match[2], match[1]);
for (let i = 0; i < lines.length;) {
  const line = lines[i];
  if (!line.trim()) { i++; continue; }
  if (line.startsWith('# ')) { i++; continue; }
  const heading = line.match(/^(#{2,6}) (.+)$/);
  if (heading) { blocks.push(block('heading', heading[2], { level: heading[1].length - 1 })); i++; continue; }
  if (line.startsWith('![')) {
    const file = line.match(/\(([^)]+)\)/)[1].split('/').at(-1);
    const f = figures.find(value => value.file === file);
    const bytes = Buffer.from(f.svg);
    blocks.push({ kind: 'image', id: randomUUID(), metadata: {}, caption: f.title, alt: f.summary,
      file: { id: randomUUID(), fileName: file, mimeType: 'image/svg+xml', byteLength: bytes.length, width: 1200, height: f.height, data: bytes.toString('base64') }, semantics: f.semantics });
    i++; continue;
  }
  if (line.startsWith('```')) {
    const language = line.slice(3); const code = []; i++;
    while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
    blocks.push({ ...block('code', code.join('\n')), metadata: { language } }); i++; continue;
  }
  if (line.startsWith('|')) {
    const rows = []; while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++].split('|').slice(1, -1).map(c => c.trim()));
    const [headers, , ...body] = rows;
    blocks.push({ kind: 'list', id: randomUUID(), metadata: { presentation: 'comparison', columns: headers }, style: 'bullet', items: body.map(row => ({ id: randomUUID(), metadata: {}, text: plain(row[0]), children: [{ kind: 'list', id: randomUUID(), metadata: {}, style: 'bullet', items: row.slice(1).map((cell, c) => ({ id: randomUUID(), metadata: {}, text: plain(`${headers[c + 1]}：${cell}`), children: [] })) }] })) });
    continue;
  }
  if (/^\d+\. /.test(line)) {
    const items = []; while (i < lines.length && /^\d+\. /.test(lines[i])) items.push({ id: randomUUID(), metadata: {}, text: plain(lines[i++].replace(/^\d+\. /, '')), children: [] });
    blocks.push({ kind: 'list', id: randomUUID(), metadata: {}, style: 'ordered', items }); continue;
  }
  const paragraph = [line]; i++;
  while (i < lines.length && lines[i].trim() && !/^(#|!\[|\||```|\d+\. )/.test(lines[i])) paragraph.push(lines[i++]);
  blocks.push(block('paragraph', paragraph.join('\n')));
}
const now = new Date().toISOString();
const doc = { format: 'docsymbi', schemaVersion: 2, id: old?.id ?? randomUUID(), title: 'Azure VM上のSQL Server Always On可用性グループ：アーキテクチャ解説資料', createdAt: old?.createdAt ?? now, updatedAt: now,
  metadata: { audience: 'Microsoft AZ-305学習者', verifiedAt: '2026-10-27', baseline: 'Windows Server 2022 / SQL Server 2022 Enterprise / WSFC / 通常AG', sources: [...sourceMap].map(([url, title]) => ({ title, url, accessedAt: '2026-10-27' })), note: 'Microsoft Learnを基に作成。AzureデプロイとSQL実機検証は未実施。' }, blocks };
writeFileSync(output, JSON.stringify(doc, null, 2) + '\n');
writeFileSync(`${dir}/preview.html`, `<!doctype html><html lang="ja"><meta charset="utf-8"><title>Always On 図版確認</title><style>body{margin:24px;background:#e7edf4;font-family:Meiryo,sans-serif}figure{margin:24px auto;width:1200px;background:white}img{display:block;width:1200px}figcaption{padding:20px}</style>${figures.map(f => `<figure><img src="${f.file}" alt="${esc(f.summary)}"><figcaption>${esc(f.summary)}</figcaption></figure>`).join('')}</html>`);
console.log(JSON.stringify({ output, blocks: blocks.length, figures: figures.length, bytes: Buffer.byteLength(JSON.stringify(doc)) }));
