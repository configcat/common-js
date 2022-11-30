import { OptionsBase } from "./ConfigCatClientOptions";

export enum FetchStatus {
    Fetched = 0,
    NotModified = 1,
    Errored = 2,
}

export class FetchResult {
    private constructor(
        public status: FetchStatus,
        public responseBody: string,
        public eTag?: string,
        public errorMessage?: string,
        public errorException?: any) {
    }

    static success(responseBody: string, eTag: string): FetchResult {
        return new FetchResult(FetchStatus.Fetched, responseBody, eTag);
    }

    static notModified(): FetchResult {
        return new FetchResult(FetchStatus.NotModified, "");
    }

    static error(errorMessage?: string, errorException?: any): FetchResult {
        return new FetchResult(FetchStatus.Errored, "", void 0, errorMessage ?? "Unknown error.", errorException);
    }
}

export interface IFetchResponse {
    statusCode: number;
    reasonPhrase: string;
    eTag?: string;
    body?: string;
}

export type FetchErrorCauses = {
    timeout: [timeoutMs: number];
};

export class FetchError<TCause extends keyof FetchErrorCauses> extends Error {
    public args: FetchErrorCauses[TCause];

    constructor(public cause: TCause, ...args: FetchErrorCauses[TCause]) {
        let message: string | undefined;
        switch (cause) {
            case "timeout":
                const [timeoutMs] = args;
                message = `Request timed out. Timeout value: ${timeoutMs}ms`;
                break;
        }
        super(message);

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
