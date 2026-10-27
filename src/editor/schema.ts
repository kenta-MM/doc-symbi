import { Node } from '@tiptap/core';
import DocumentNode from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import HardBreak from '@tiptap/extension-hard-break';
import { BulletList, OrderedList, ListItem } from '@tiptap/extension-list';
import { imageFileSchema, imageSource } from '../domain/image';

const identity = () => ({ id: { default: null, rendered: false }, metadata: { default: {}, rendered: false } });
const Paragraph = Node.create({
  name: 'paragraph', group: 'block', content: 'inline*', marks: '',
  addAttributes: identity, parseHTML: () => [{ tag: 'p' }], renderHTML: () => ['p', 0],
});
const Heading = Node.create({
  name: 'heading', group: 'block', content: 'inline*', marks: '', defining: true,
  addAttributes: () => ({ ...identity(), level: { default: 1 } }),
  parseHTML: () => [1, 2, 3, 4, 5, 6].map(level => ({ tag: `h${level}`, attrs: { level } })),
  renderHTML: ({ node }) => [`h${node.attrs.level as number}`, 0],
});
const Code = Node.create({
  name: 'codeBlock', group: 'block', content: 'text*', marks: '', code: true, defining: true,
  addAttributes: identity, parseHTML: () => [{ tag: 'pre', preserveWhitespace: 'full' }], renderHTML: () => ['pre', ['code', 0]],
  addKeyboardShortcuts() { return { Enter: () => this.editor.isActive('codeBlock') && this.editor.commands.insertContent('\n') }; },
});
const ImageBlock = Node.create({
  name: 'imageBlock', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({ ...identity(), file: { default: null, rendered: false }, caption: { default: '', rendered: false }, alt: { default: '', rendered: false }, semantics: { default: null, rendered: false } }),
  // SVG is only ever loaded as an image; never inject markup or use object/iframe.
  renderHTML: ({ node }) => ['figure', { class: 'attached-image' },
    ['img', { src: imageSource(imageFileSchema.parse(node.attrs.file)), alt: String(node.attrs.alt), draggable: 'false' }],
    ['figcaption', {}, String(node.attrs.caption)]],
});
export const editorNodes = [DocumentNode, Text, HardBreak, Paragraph, Heading, Code, ImageBlock,
  BulletList.extend({ addAttributes: identity, addInputRules: () => [] }),
  OrderedList.extend({ addAttributes: identity, renderHTML: () => ['ol', 0], addInputRules: () => [] }),
  ListItem.extend({ content: 'paragraph (bulletList | orderedList)*', addAttributes: identity }),
];
