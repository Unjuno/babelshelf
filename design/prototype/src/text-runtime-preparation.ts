/** Coordinate ownership before a selected local Text runtime is pinned.
 * The caller supplies model-specific validation/loading and keeps UI, receipts,
 * and persistence outside this boundary.
 */
export async function prepareTextRuntime<Runtime>(input: {
  model: string | undefined;
  loadedModel: string | boolean | null | undefined;
  check: () => void;
  releaseCompeting: () => Promise<unknown>;
  prepareSelected: () => Promise<unknown>;
  pin: () => Runtime;
}): Promise<Runtime> {
  input.check();
  await input.releaseCompeting();
  input.check();
  if (!input.model || input.loadedModel !== input.model) {
    await input.prepareSelected();
    input.check();
  }
  return input.pin();
}
