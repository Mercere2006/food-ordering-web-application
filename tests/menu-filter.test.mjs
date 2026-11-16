import assert from "node:assert/strict";
import test from "node:test";
import { selectedCategoryId } from "../lib/menu-filter.ts";

const categories = [{ id: 1 }, { id: 3 }];

test("accepts only a single category id that exists", () => {
  assert.equal(selectedCategoryId("3", categories), 3);
  for (const value of [undefined, "", "0", "-1", "1.5", "01", "2", "1abc", ["1", "3"]]) {
    assert.equal(selectedCategoryId(value, categories), null);
  }
});
