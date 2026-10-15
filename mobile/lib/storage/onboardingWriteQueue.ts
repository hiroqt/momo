const writesByOwner = new Map<string, Promise<void>>();

export function enqueueOnboardingWrite<T>(owner: string, write: () => Promise<T>): Promise<T> {
  const previous = writesByOwner.get(owner) ?? Promise.resolve();
  const pending = previous.then(write);
  const settled = pending.then(() => undefined, () => undefined);
  writesByOwner.set(owner, settled);
  void settled.then(() => {
    if (writesByOwner.get(owner) === settled) writesByOwner.delete(owner);
  });
  return pending;
}
