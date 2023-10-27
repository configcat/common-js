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

export function throwError(err: any): never {
  throw err;
}

export function isArray(value: unknown): value is readonly unknown[] {
  // See also: https://github.com/microsoft/TypeScript/issues/17002#issuecomment-1477626624
  return Array.isArray(value);
}

export function isPromiseLike<T>(obj: unknown): obj is PromiseLike<T> {
  // See also: https://stackoverflow.com/a/27746324/8656352
  return typeof (obj as PromiseLike<T>)?.then === "function";
}

export function formatStringList(items: ReadonlyArray<string>, maxLength = 0, getOmittedItemsText?: (count: number) => string, separator = ", "): string {
  const length = items.length;
  if (!length) {
    return "";
  }

  let appendix = "";

  if (maxLength > 0 && length > maxLength) {
    items = items.slice(0, maxLength);
    if (getOmittedItemsText) {
      appendix = getOmittedItemsText?.(length - maxLength);
    }
  }

  return "'" + items.join("'" + separator + "'") + "'" + appendix;
}
