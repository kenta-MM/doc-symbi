import { Node, Mark } from '@tiptap/core';
import DocumentNode from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import HardBreak from '@tiptap/extension-hard-break';
import { BulletList, OrderedList, ListItem } from '@tiptap/extension-list';
import { imageFileSchema, imageSource } from '../domain/image';
import { safeLink } from '../domain/rich-text';
import { tableNodeView } from './table-node-view';
import { imageNodeView } from './image-node-view';
import { quizNodeView } from './quiz-node-view';
import { syntaxHighlight } from './syntax-highlight';
import { codeNodeView } from './code-node-view';

const identity = () => ({ id: { default: null, rendered: false }, metadata: { default: {}, rendered: false } });
const Paragraph = Node.create({
  name: 'paragraph', group: 'block', content: 'inline*',
  addAttributes: identity, parseHTML: () => [{ tag: 'p' }], renderHTML: () => ['p', 0],
});
const Heading = Node.create({
  name: 'heading', group: 'block', content: 'inline*', defining: true,
  addAttributes: () => ({ ...identity(), level: { default: 1 } }),
  parseHTML: () => [1, 2, 3, 4, 5, 6].map(level => ({ tag: `h${level}`, attrs: { level } })),
  renderHTML: ({ node }) => [`h${node.attrs.level as number}`, { 'data-heading-id': node.attrs.id }, 0],
});
const Code = Node.create({
  name: 'codeBlock', group: 'block', content: 'text*', marks: '', code: true, defining: true,
  addAttributes: () => ({ ...identity(), language: { default: null, rendered: false }, width: { default: null, rendered: false } }),
  addNodeView() { return codeNodeView; },
  parseHTML: () => [{ tag: 'pre', preserveWhitespace: 'full' }], renderHTML: ({ node }) => ['pre', { 'data-language': node.attrs.language ?? 'text' }, ['code', 0]],
  addKeyboardShortcuts() { return { Enter: () => this.editor.isActive('codeBlock') && this.editor.commands.insertContent('\n'), 'Mod-Enter': () => this.editor.commands.exitCode() }; },
});
const Bold = Mark.create({ name: 'bold', parseHTML: () => [{ tag: 'strong' }, { tag: 'b' }], renderHTML: () => ['strong', 0], addKeyboardShortcuts() { return { 'Mod-b': () => this.editor.commands.toggleMark('bold') }; } });
const InlineCode = Mark.create({ name: 'inlineCode', code: true,
  parseHTML: () => [{ tag: 'code', getAttrs: element => element.closest('pre') ? false : null }],
  renderHTML: () => ['code', { class: 'inline-code' }, 0],
});
const Link = Mark.create({ name: 'link', inclusive: false, addAttributes: () => ({ href: { default: null } }),
  parseHTML: () => [{ tag: 'a[href]', getAttrs: element => safeLink(element.getAttribute('href') ?? '') ? { href: element.getAttribute('href') } : false }],
  renderHTML: ({ HTMLAttributes }) => ['a', { href: safeLink(String(HTMLAttributes.href)) ? HTMLAttributes.href : undefined, rel: 'noopener noreferrer' }, 0],
});
const Table = Node.create({ name: 'table', group: 'block', content: 'tableRow+', isolating: true, addAttributes: () => ({ ...identity(), displaySize: { default: null, rendered: false } }), addNodeView() { return tableNodeView; }, parseHTML: () => [{ tag: 'table' }], renderHTML: () => ['table', ['tbody', 0]] });
const TableRow = Node.create({ name: 'tableRow', content: '(tableCell | tableHeader)+', parseHTML: () => [{ tag: 'tr' }], renderHTML: () => ['tr', 0] });
const TableCell = Node.create({ name: 'tableCell', content: 'paragraph', isolating: true, addAttributes: identity, parseHTML: () => [{ tag: 'td' }], renderHTML: () => ['td', 0] });
const TableHeader = TableCell.extend({ name: 'tableHeader', parseHTML: () => [{ tag: 'th' }], renderHTML: () => ['th', 0] });
const ImageBlock = Node.create({
  name: 'imageBlock', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({ ...identity(), file: { default: null, rendered: false }, caption: { default: '', rendered: false }, alt: { default: '', rendered: false }, semantics: { default: null, rendered: false }, displaySize: { default: null, rendered: false } }),
  addNodeView() { return imageNodeView; },
  // SVG is only ever loaded as an image; never inject markup or use object/iframe.
  renderHTML: ({ node }) => ['figure', { class: 'attached-image' },
    ['img', { src: imageSource(imageFileSchema.parse(node.attrs.file)), alt: String(node.attrs.alt), draggable: 'false' }],
    ['figcaption', {}, String(node.attrs.caption)]],
});
const QuizBlock = Node.create({
  name: 'quizBlock', group: 'block', atom: true,
  addAttributes: () => ({ ...identity(), questions: { default: [], rendered: false } }),
  renderHTML: () => ['section', { class: 'quiz-block' }, '選択クイズ'],
  addNodeView() { return quizNodeView; },
});
export const editorNodes = [DocumentNode, Text, HardBreak, Paragraph, Heading, Code, ImageBlock, QuizBlock, Bold, InlineCode, Link, Table, TableRow, TableCell, TableHeader, syntaxHighlight,
  BulletList.extend({ addAttributes: identity, addInputRules: () => [] }),
  OrderedList.extend({ addAttributes: identity, renderHTML: () => ['ol', 0], addInputRules: () => [] }),
  ListItem.extend({ content: 'paragraph (bulletList | orderedList)*', addAttributes: identity }),
];
