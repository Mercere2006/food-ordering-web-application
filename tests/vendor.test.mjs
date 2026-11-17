import test from 'node:test';
import assert from 'node:assert/strict';
import { createVendorSession, isValidVendorSession, validVendorPassword } from '../lib/vendor-auth.ts';

test('vendor sessions require the configured password and expire', () => {
  const password = 'a-strong-test-password';
  assert.equal(validVendorPassword(password, password), true);
  assert.equal(validVendorPassword('wrong', password), false);
  assert.equal(validVendorPassword('', ''), false);
  const token = createVendorSession(password, 1000);
  assert.equal(isValidVendorSession(token, password, 1001), true);
  assert.equal(isValidVendorSession(token, password, 1000 + 8 * 60 * 60 + 1), false);
  assert.equal(isValidVendorSession(token + 'x', password, 1001), false);
  assert.equal(isValidVendorSession(token, 'different-password', 1001), false);
  assert.equal(isValidVendorSession(token, '', 1001), false);
});
