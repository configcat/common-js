// NOTE: Normally, we'd just use AbortController/AbortSignal, however that may not be available on all platforms,
// and we don't want to include a complete polyfill. So we implement a simplified version that fits our use case.
export class AbortToken {
  private callbacks: (() => void)[] | null = [];
  get aborted(): boolean { return !this.callbacks; }

  abort(): void {
    if (!this.aborted) {
      const callbacks = this.callbacks!;
      this.callbacks = null;
      for (const callback of callbacks) {
        callback();
      }
    }
  }

  registerCallback(callback: () => void): () => void {
    if (this.aborted) {
      callback();
      return () => { };
    }

    this.callbacks!.push(callback);
    return () => {
      const callbacks = this.callbacks;
      let index: number;
      if (callbacks && (index = callbacks.indexOf(callback)) >= 0) {
        callbacks.splice(index, 1);
      }
    };
  }
}

export function delay(delayMs: number, abortToken?: AbortToken | null): Promise<boolean> {
  let timerId: ReturnType<typeof setTimeout>;
  return new Promise<boolean>(resolve => {
    const unregisterAbortCallback = abortToken?.registerCallback(() => {
      clearTimeout(timerId);
      resolve(false);
    });

    timerId = setTimeout(() => {
      unregisterAbortCallback?.();
      resolve(true);
    }, delayMs);
  });
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

export function isStringArray(value: unknown): value is string[] {
  return isArray(value) && !value.some(item => typeof item !== "string");
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
      appendix = getOmittedItemsText(length - maxLength);
    }
  }

  return "'" + items.join("'" + separator + "'") + "'" + appendix;
}

export function isPromiseLike<T>(obj: unknown): obj is PromiseLike<T> {
  // See also: https://stackoverflow.com/a/27746324/8656352
  return typeof (obj as PromiseLike<T>)?.then === "function";
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

export function parseFloatStrict(value: unknown): number {
  // NOTE: JS's float to string conversion is too forgiving, it accepts hex numbers and ignores invalid characters after the number.

  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string" || !value.length || /^\s*$|^\s*0[^\d.e]/.test(value)) {
    return NaN;
  }

  return +value;
}
