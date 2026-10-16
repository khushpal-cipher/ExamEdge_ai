import { describe, expect, it } from 'vitest';
import { fieldLabel, textFields, withTexts } from './studio';

const quiz = {
  questions: [{ id: 'q1', stem: 'S', options: [{ id: 'a', text: 'A' }], answer: 'a', explanation: 'E', cites: [0] }],
};

describe('artifact text editing', () => {
  it('lists every text leaf except ids', () => {
    expect(textFields(quiz)).toEqual([
      ['questions.0.stem', 'S'],
      ['questions.0.options.0.text', 'A'],
      ['questions.0.answer', 'a'],
      ['questions.0.explanation', 'E'],
    ]);
  });
  it('replaces only string leaves and keeps ids and citations', () => {
    const values = new Map([
      ['questions.0.stem', 'New stem'],
      ['questions.0.id', 'forged'],
      ['questions.0.cites.0', '9'],
      ['questions', 'x'],
    ]);
    expect(withTexts(quiz, values)).toEqual({
      questions: [{ ...quiz.questions[0], stem: 'New stem' }],
    });
  });
  it('labels a path for people', () => {
    expect(fieldLabel('questions.0.options.2.text')).toBe('Questions 1 · options 3 · text');
    expect(fieldLabel('root')).toBe('Root');
  });
});
