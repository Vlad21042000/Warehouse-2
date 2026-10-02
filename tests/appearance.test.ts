import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_APPEARANCE, readAppearance } from '../src/appearance';
test('appearance recovers from malformed and missing preferences', () => {
  for (const value of [null, '{bad', 'null', '42']) assert.deepEqual(readAppearance(value), DEFAULT_APPEARANCE);
});
test('appearance remembers supported choices and bounds background dimming', () => {
  assert.deepEqual(readAppearance('{"theme":"light","background":"plain","dimming":95}'), {theme:'light',background:'plain',dimming:90});
  assert.equal(readAppearance('{"dimming":-2}').dimming,20);
  assert.deepEqual(readAppearance('{"theme":"unknown","background":"video","dimming":"70"}'),DEFAULT_APPEARANCE);
});
