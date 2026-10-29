import { useState } from 'react';
import { emptyQuestion, quizQuestionsSchema, type QuizQuestion } from '../domain/quiz';
import { DocumentDialog } from './DocumentDialogs';

export function QuizSettings({ initial, apply, close }: { initial?: QuizQuestion[]; apply: (questions: QuizQuestion[]) => void; close: () => void }) {
  const [questions, setQuestions] = useState(() => structuredClone(initial ?? [emptyQuestion()]));
  const [error, setError] = useState('');
  function change(index: number, patch: Partial<QuizQuestion>) { setQuestions(current => current.map((question, i) => i === index ? { ...question, ...patch } : question)); }
  return <DocumentDialog label="クイズ設定" close={close}><h2>選択クイズの設定</h2>
    <p>各問題に選択肢と正解を1つ設定します。回答すると判定と解説を表示します。</p>
    <form onSubmit={event => {
      event.preventDefault();
      const result = quizQuestionsSchema.safeParse(questions);
      if (!result.success) { setError(result.error.issues[0]?.message ?? '問題の内容を確認してください'); return; }
      try { apply(result.data); close(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'クイズを保存できません'); }
    }}>
      {questions.map((question, index) => <fieldset className="quiz-settings-question" key={index}>
        <legend>問題 {index + 1}</legend>
        <label>問題文<textarea aria-label={`問題${index + 1}の問題文`} required value={question.prompt} onChange={event => change(index, { prompt: event.target.value })} /></label>
        {question.options.map((option, optionIndex) => <label key={optionIndex}>選択肢 {optionIndex + 1}<input aria-label={`問題${index + 1}の選択肢${optionIndex + 1}`} required value={option} onChange={event => change(index, { options: question.options.map((text, i) => i === optionIndex ? event.target.value : text) })} /></label>)}
        <button type="button" disabled={question.options.length >= 10} onClick={() => change(index, { options: [...question.options, ''] })}>選択肢を追加</button>
        <button type="button" disabled={question.options.length <= 2} onClick={() => change(index, { options: question.options.slice(0, -1), correctIndex: Math.min(question.correctIndex, question.options.length - 2) })}>最後の選択肢を削除</button>
        <label>正解<select aria-label={`問題${index + 1}の正解`} value={question.correctIndex} onChange={event => change(index, { correctIndex: Number(event.target.value) })}>{question.options.map((_, i) => <option key={i} value={i}>選択肢 {i + 1}</option>)}</select></label>
        <label>解説<textarea aria-label={`問題${index + 1}の解説`} required value={question.explanation} onChange={event => change(index, { explanation: event.target.value })} /></label>
        <button type="button" disabled={questions.length === 1} onClick={() => setQuestions(current => current.filter((_, i) => i !== index))}>問題 {index + 1} を削除</button>
      </fieldset>)}
      <button type="button" disabled={questions.length >= 100} onClick={() => setQuestions(current => [...current, emptyQuestion()])}>問題を追加</button>
      {error && <p role="alert">{error}</p>}
      <div className="dialog-actions"><button type="button" onClick={close}>キャンセル</button><button type="submit" className="primary">クイズを適用</button></div>
    </form>
  </DocumentDialog>;
}
