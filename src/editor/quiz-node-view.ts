import { closeHistory } from './history';
import type { NodeViewRenderer } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { quizQuestionsSchema } from '../domain/quiz';
import { equivalent } from '../domain/equivalence';

export const quizNodeView: NodeViewRenderer = ({ node, editor, getPos }) => {
  let current = node;
  let questions = quizQuestionsSchema.parse(node.attrs.questions);
  let index = 0;
  let answers: (number[] | undefined)[] = [];
  const dom = document.createElement('section');
  dom.className = 'quiz-block'; dom.contentEditable = 'false';
  dom.setAttribute('aria-label', '選択クイズ');
  const header = document.createElement('div'); header.className = 'quiz-header';
  const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'クイズを編集'; edit.className = 'quiz-edit';
  edit.onclick = () => {
    if (!editor.isEditable) return;
    const pos = getPos(); if (pos === undefined) return;
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)));
    dom.dispatchEvent(new CustomEvent('quiz-edit', { bubbles: true, detail: String(current.attrs.id) }));
  };
  const progress = document.createElement('span'); progress.className = 'quiz-progress'; progress.setAttribute('aria-live', 'polite');
  const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'クイズを削除'; remove.className = 'quiz-edit danger';
  remove.onclick = () => { if (!editor.isEditable) return; const pos = getPos(); if (pos !== undefined) editor.view.dispatch(closeHistory(editor.state.tr).delete(pos, pos + current.nodeSize)); };
  const menu = document.createElement('div'); menu.className = 'creation-menu'; menu.hidden = true; menu.setAttribute('role', 'menu');
  const menuRemove = document.createElement('button'); menuRemove.textContent = 'クイズを削除'; menuRemove.setAttribute('role', 'menuitem'); menuRemove.onclick = () => { menu.hidden = true; remove.click(); }; menu.append(menuRemove);
  dom.oncontextmenu = event => { if (!editor.isEditable) return; event.preventDefault(); menu.hidden = false; menu.style.left = Math.min(event.clientX, window.innerWidth - 250) + 'px'; menu.style.top = Math.min(event.clientY, window.innerHeight - 70) + 'px'; menuRemove.focus(); };
  menu.onkeydown = event => { if (event.key === 'Escape' || event.key === 'Tab') menu.hidden = true; };
  menu.addEventListener('focusout', () => { menu.hidden = true; });
  dom.append(menu); header.append(edit, remove, progress);
  const fieldset = document.createElement('fieldset');
  const feedback = document.createElement('div'); feedback.className = 'quiz-feedback'; feedback.setAttribute('role', 'status');
  const footer = document.createElement('div'); footer.className = 'quiz-navigation';
  const previous = document.createElement('button'), next = document.createElement('button');
  previous.type = next.type = 'button'; previous.textContent = '前へ'; next.textContent = '次の問題';
  previous.onclick = () => { if (index > 0) { index--; render(); } };
  next.onclick = () => { if (index < questions.length - 1) { index++; render(); } };
  footer.append(previous, next); dom.append(header, fieldset, feedback, footer);
  function showFeedback() {
    const answer = answers[index], question = questions[index]!;
    feedback.replaceChildren(); feedback.hidden = answer === undefined;
    if (answer === undefined) return;
    const expected = question.multiple ? question.correctIndices! : [question.correctIndex];
    const correct = answer.length === expected.length && expected.every(value => answer.includes(value));
    feedback.className = `quiz-feedback ${correct ? 'correct' : 'incorrect'}`;
    const result = document.createElement('strong'); result.textContent = correct ? '〇 正解' : '× 不正解';
    const explanation = document.createElement('p'); explanation.textContent = `解説：${question.explanation}`;
    feedback.append(result, explanation);
  }
  function render() {
    const question = questions[index]!;
    progress.textContent = `問題 ${index + 1} / ${questions.length}`;
    previous.disabled = index === 0; next.disabled = index === questions.length - 1;
    fieldset.replaceChildren();
    const legend = document.createElement('legend'); legend.textContent = question.prompt; fieldset.append(legend);
    question.options.forEach((option, optionIndex) => {
      const label = document.createElement('label'); label.className = 'quiz-option';
      const radio = document.createElement('input'); radio.type = question.multiple ? 'checkbox' : 'radio'; radio.name = `quiz-${current.attrs.id}-${index}`;
      radio.checked = answers[index]?.includes(optionIndex) ?? false;
      radio.onchange = () => { answers[index] = question.multiple ? (radio.checked ? [...(answers[index] ?? []), optionIndex] : (answers[index] ?? []).filter(value => value !== optionIndex)) : [optionIndex]; showFeedback(); };
      const text = document.createElement('span'); text.textContent = option;
      label.append(radio, text); fieldset.append(label);
    });
    showFeedback();
  }
  render();
  return { dom, stopEvent: () => true, ignoreMutation: () => true,
    update(updated) {
      if (updated.type !== current.type) return false;
      const changed = !equivalent(updated.attrs.questions, current.attrs.questions) || updated.attrs.id !== current.attrs.id;
      current = updated;
      if (changed) { questions = quizQuestionsSchema.parse(updated.attrs.questions); index = 0; answers = []; render(); }
      return true;
    },
  };
};
