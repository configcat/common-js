export function delay(delayMs: number, delayCleanup?: { clearTimer?: () => void } | null): Promise<void> {
  let timerId: ReturnType<typeof setTimeout>;
  const promise = new Promise<void>(resolve => timerId = setTimeout(resolve, delayMs));
  if (delayCleanup) {
    delayCleanup.clearTimer = () => clearTimeout(timerId);
  }
  return promise;
}

export function errorToString(err: any, includeStackTrace = false): string {
  return err instanceof Error
    ? includeStackTrace && err.stack ? err.stack : err.toString()
    : err + "";
}

export function isPromiseLike<T>(obj: unknown): obj is PromiseLike<T> {
  // See also: https://stackoverflow.com/a/27746324/8656352
  return typeof (obj as PromiseLike<T>)?.then === "function";
}
