import test from 'node:test';
import assert from 'node:assert/strict';
import { nextOrderStatus, validVendorFilter } from '../lib/vendor.ts';
import { createVendorSession, isValidVendorSession, validVendorPassword } from '../lib/vendor-auth.ts';

test('orders advance one step only and completed orders cannot advance', () => {
  assert.equal(nextOrderStatus('pending'), 'preparing');
  assert.equal(nextOrderStatus('preparing'), 'ready');
  assert.equal(nextOrderStatus('ready'), 'completed');
  assert.equal(nextOrderStatus('completed'), null);
  assert.equal(nextOrderStatus('unknown'), null);
  assert.equal(validVendorFilter('all'), true);
  assert.equal(validVendorFilter('pending'), true);
  assert.equal(validVendorFilter('unknown'), false);
});

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
