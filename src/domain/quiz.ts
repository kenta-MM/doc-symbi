import { z } from 'zod';
import { textSchema } from './text';

const requiredText = textSchema.refine(value => value.trim().length > 0, '空欄を入力してください');
export const quizQuestionSchema = z.strictObject({
  prompt: requiredText,
  options: z.array(requiredText).min(2).max(10),
  correctIndex: z.number().int().nonnegative(),
  explanation: requiredText,
}).refine(question => question.correctIndex < question.options.length, '正解の選択肢を指定してください');
export const quizQuestionsSchema = z.array(quizQuestionSchema).min(1).max(100);
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export const emptyQuestion = (): QuizQuestion => ({ prompt: '', options: ['', ''], correctIndex: 0, explanation: '' });
