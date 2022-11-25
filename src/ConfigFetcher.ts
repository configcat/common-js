import { OptionsBase } from "./ConfigCatClientOptions";

export enum FetchStatus {
    Fetched = 0,
    NotModified = 1,
    Errored = 2,
}

export class FetchResult {
    public status: FetchStatus;
    public responseBody: string;
    public eTag?: string;

    private constructor(status: FetchStatus, responseBody: string, eTag?: string) {
        this.status = status;
        this.responseBody = responseBody;
        this.eTag = eTag
    }

    static success(responseBody: string, eTag: string): FetchResult {
        return new FetchResult(FetchStatus.Fetched, responseBody, eTag);
    }

    static notModified(): FetchResult {
        return new FetchResult(FetchStatus.NotModified, "");
    }

    static error(): FetchResult {
        return new FetchResult(FetchStatus.Errored, "");
    }

}

export interface IConfigFetcher {
    /** @remarks Implementers must ensure that callback is called under all circumstances, i.e. in case of successful or failed requests and potential exceptions as well! */
    fetchLogic(options: OptionsBase, lastEtag: string | null, callback: (result: FetchResult) => void): void;
}
