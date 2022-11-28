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

export interface IConfigFetcher {
    fetchLogic(options: OptionsBase, lastEtag: string | null): Promise<IFetchResponse>;
}
