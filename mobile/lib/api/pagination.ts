export async function collectPages<T>(
  loadPage: (limit: number, offset: number) => Promise<T[]>
): Promise<T[]> {
  const limit = 100;
  const result: T[] = [];
  for (let offset = 0; offset <= 100000; offset += limit) {
    const page = await loadPage(limit, offset);
    if (!Array.isArray(page) || page.length > limit) {
      throw new Error('The server returned an invalid page.');
    }
    result.push(...page);
    if (page.length < limit) return result;
  }
  throw new Error('The library exceeds the supported listing size.');
}
