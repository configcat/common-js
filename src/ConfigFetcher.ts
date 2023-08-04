import type { OptionsBase } from "./ConfigCatClientOptions";
import type { ProjectConfig } from "./ProjectConfig";

export enum FetchStatus {
  Fetched = 0,
  NotModified = 1,
  Errored = 2,
}

export class FetchResult {
  private constructor(
    public status: FetchStatus,
    public config: ProjectConfig,
    public errorMessage?: string,
    public errorException?: any) {
  }

  static success(config: ProjectConfig): FetchResult {
    return new FetchResult(FetchStatus.Fetched, config);
  }

  static notModified(config: ProjectConfig): FetchResult {
    return new FetchResult(FetchStatus.NotModified, config);
  }

  static error(config: ProjectConfig, errorMessage?: string, errorException?: any): FetchResult {
    return new FetchResult(FetchStatus.Errored, config, errorMessage ?? "Unknown error.", errorException);
  }
}

export interface IFetchResponse {
  statusCode: number;
  reasonPhrase: string;
  eTag?: string;
  body?: string;
}

export type FetchErrorCauses = {
  abort: [];
  timeout: [timeoutMs: number];
  failure: [err?: any];
};

export class FetchError<TCause extends keyof FetchErrorCauses = keyof FetchErrorCauses> extends Error {
  args: FetchErrorCauses[TCause];

  constructor(public cause: TCause, ...args: FetchErrorCauses[TCause]) {
    super(((cause: TCause, args: FetchErrorCauses[TCause]): string | undefined => {
      switch (cause) {
        case "abort":
          return "Request was aborted.";
        case "timeout":
          const [timeoutMs] = args as FetchErrorCauses["timeout"];
          return `Request timed out. Timeout value: ${timeoutMs}ms`;
        case "failure":
          const [err] = args as FetchErrorCauses["failure"];
          const message = "Request failed due to a network or protocol error.";
          return err
            ? message + " " + (err instanceof Error ? err.message : err + "")
            : message;
      }
    })(cause, args));

    // NOTE: due to a known issue in the TS compiler, instanceof is broken when subclassing Error and targeting ES5 or earlier
    // (see https://github.com/microsoft/TypeScript/issues/13965).
    // Thus, we need to manually fix the prototype chain as recommended in the TS docs
    // (see https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work)
    if (!(this instanceof FetchError)) {
      (Object.setPrototypeOf || ((o, proto) => o["__proto__"] = proto))(this, FetchError.prototype);
    }
    this.args = args;
  }
}

export interface IConfigFetcher {
  fetchLogic(options: OptionsBase, lastEtag: string | null): Promise<IFetchResponse>;
}
