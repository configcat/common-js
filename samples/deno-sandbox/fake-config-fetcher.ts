import { FetchResult, FetchStatus, IConfigFetcher, OptionsBase } from "src/index.ts";

export class FakeConfigFetcher implements IConfigFetcher
{
    private currentFetchResult = FetchResult.error();
    private currentETag = 0;

    fetchLogic(_options: OptionsBase, lastEtag: string | null, callback: (result: FetchResult) => void) {
        callback(this.currentFetchResult.status === FetchStatus.Fetched && this.currentFetchResult.eTag === lastEtag
            ? FetchResult.notModified()
            : this.currentFetchResult);
    }

    setSuccess(configJson: string) {
        this.currentFetchResult = FetchResult.success(configJson, (++this.currentETag) + "");
    }
    
    setError() {
        this.currentFetchResult = FetchResult.error();
    }
}