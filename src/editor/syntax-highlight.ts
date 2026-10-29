import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Decorations leave the source text and saved document untouched.
const patterns: Record<string, RegExp> = {
  javascript: /(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(?<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(?<keyword>\b(?:const|let|var|function|return|if|else|for|while|class|new|import|export|from|async|await|throw|try|catch|true|false|null|undefined)\b)|(?<number>\b\d+(?:\.\d+)?\b)/g,
  typescript: /(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(?<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(?<keyword>\b(?:const|let|function|return|if|else|for|class|new|import|export|from|async|await|interface|type|extends|implements|string|number|boolean|void|true|false|null)\b)|(?<number>\b\d+(?:\.\d+)?\b)/g,
  python: /(?<comment>#[^\n]*)|(?<string>"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(?<keyword>\b(?:def|class|return|if|elif|else|for|while|in|is|not|and|or|import|from|as|with|try|except|raise|lambda|True|False|None|async|await)\b)|(?<number>\b\d+(?:\.\d+)?\b)/g,
  json: /(?<string>"(?:\\.|[^"\\])*")|(?<keyword>\b(?:true|false|null)\b)|(?<number>-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g,
  html: /(?<comment><!--[\s\S]*?-->)|(?<string>"[^"]*"|'[^']*')|(?<keyword><\/?[\w-]+|\/?>)|(?<number>\b\d+\b)/g,
  css: /(?<comment>\/\*[\s\S]*?\*\/)|(?<string>"[^"]*"|'[^']*')|(?<keyword>[\w-]+(?=\s*:)|[.#][\w-]+)|(?<number>\b\d+(?:\.\d+)?(?:px|em|rem|%)?)/g,
  sql: /(?<comment>--[^\n]*|\/\*[\s\S]*?\*\/)|(?<string>'(?:''|[^'])*'|"[^"]*")|(?<keyword>\b(?:SELECT|FROM|WHERE|JOIN|ON|AS|AND|OR|NOT|NULL|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ORDER|GROUP|BY|LIMIT|ASC|DESC)\b)|(?<number>\b\d+(?:\.\d+)?\b)/gi,
  bash: /(?<comment>#[^\n]*)|(?<string>"(?:\\.|[^"\\])*"|'[^']*')|(?<keyword>\b(?:if|then|else|fi|for|do|done|in|while|function|export|echo|exit)\b|\$[\w]+)|(?<number>\b\d+\b)/g,
};
export const syntaxHighlight = Extension.create({
  name: 'syntaxHighlight',
  addProseMirrorPlugins() { return [new Plugin({ props: { decorations(state) {
    const decorations: Decoration[] = [];
    state.doc.descendants((node, pos) => {
      if (node.type.name !== 'codeBlock') return;
      const pattern = patterns[String(node.attrs.language)];
      if (!pattern) return;
      pattern.lastIndex = 0;
      for (const match of node.textContent.matchAll(pattern)) {
        const token = Object.keys(match.groups ?? {}).find(key => match.groups?.[key] !== undefined);
        decorations.push(Decoration.inline(pos + 1 + match.index, pos + 1 + match.index + match[0].length, { class: `syntax-${token}` }));
      }
    });
    return DecorationSet.create(state.doc, decorations);
  } } })]; },
});
