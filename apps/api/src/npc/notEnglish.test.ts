import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notEnglish } from './llm';

test('learner lines in their own language never count as English', () => {
  for (const s of ['cho tôi một ly cà phê', 'Xin chào', 'tôi muốn trả bằng thẻ', 'ok cho mình hỏi giá bao nhiêu', '我要一杯咖啡', 'ขอกาแฟหนึ่งแก้ว', 'أريد قهوة من فضلك']) assert.equal(notEnglish(s), true, s);
  for (const s of ['Hello, I would like a latte please.', 'My name is Hiếu.', 'Can I have bánh mì, please?', 'I want phở and bánh mì', 'Hi Mai! How are you?', '123', '']) assert.equal(notEnglish(s), false, s);
});
