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

export function utf8Encode(text: string): string {
  function codePointAt(text: string, index: number): number {
    const ch = text.charCodeAt(index);
    if (0xD800 <= ch && ch < 0xDC00) { // is high surrogate?
      const nextCh = text.charCodeAt(index + 1);
      if (0xDC00 <= nextCh && nextCh <= 0xDFFF) { // is low surrogate?
        return (ch << 10) + nextCh - 0x35FDC00;
      }
    }
    return ch;
  }

  let utf8text = "", chunkStart = 0;
  const fromCharCode = String.fromCharCode;

  let i;
  for (i = 0; i < text.length; i++) {
    const cp = codePointAt(text, i);
    if (cp <= 0x7F) {
      continue;
    }

    // See also: https://stackoverflow.com/a/6240184/8656352

    utf8text += text.slice(chunkStart, i);
    if (cp <= 0x7FF) {
      utf8text += fromCharCode(0xC0 | (cp >> 6));
      utf8text += fromCharCode(0x80 | (cp & 0x3F));
    }
    else if (cp <= 0xFFFF) {
      utf8text += fromCharCode(0xE0 | (cp >> 12));
      utf8text += fromCharCode(0x80 | ((cp >> 6) & 0x3F));
      utf8text += fromCharCode(0x80 | (cp & 0x3F));
    }
    else {
      utf8text += fromCharCode(0xF0 | (cp >> 18));
      utf8text += fromCharCode(0x80 | ((cp >> 12) & 0x3F));
      utf8text += fromCharCode(0x80 | ((cp >> 6) & 0x3F));
      utf8text += fromCharCode(0x80 | (cp & 0x3F));
      ++i;
    }
    chunkStart = i + 1;
  }

  return utf8text += text.slice(chunkStart, i);
}
