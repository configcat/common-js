// See https://stackoverflow.com/a/72237137/8656352
export function allowEventLoop(waitMs = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, waitMs));
}
