export function selectedCategoryId(
  value: string | string[] | undefined,
  categories: ReadonlyArray<{ id: number }>,
): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;

  const id = Number(value);
  return Number.isSafeInteger(id) && categories.some((category) => category.id === id)
    ? id
    : null;
}
