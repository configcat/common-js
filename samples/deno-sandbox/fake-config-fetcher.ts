import { IConfigFetcher, OptionsBase } from "src/index.ts";
import type { IFetchResponse } from "../../src/ConfigFetcher.ts";

export class FakeConfigFetcher implements IConfigFetcher {
  private currentFetchResponse: IFetchResponse = { statusCode: 404, reasonPhrase: "Not Found" };
  private currentETag = 0;

  fetchLogic(_options: OptionsBase, lastEtag: string | null): Promise<IFetchResponse> {
    return Promise.resolve(this.currentFetchResponse.statusCode === 200 && (this.currentETag + "") === lastEtag
      ? <IFetchResponse>{ statusCode: 304, reasonPhrase: "Not Modified" }
      : this.currentFetchResponse);
  }

  setSuccess(configJson: string): void {
    this.currentFetchResponse = { statusCode: 200, reasonPhrase: "OK", eTag: (++this.currentETag) + "", body: configJson };
  }

  setError(statusCode: number, reasonPhrase: string): void {
    this.currentFetchResponse = { statusCode, reasonPhrase };
  }
}
