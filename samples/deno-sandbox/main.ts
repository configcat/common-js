import * as path from "std/path/mod.ts";
import { FakeConfigFetcher } from "./fake-config-fetcher.ts";
import { getClient, createConsoleLogger, LogLevel, User, PollingMode } from "src/index.ts";
import { InMemoryCache } from "src/Cache.ts";

const basePath = path.dirname(path.fromFileUrl(Deno.mainModule));
const sampleJsonPath = path.resolve(basePath, "sample.json");
const sampleJson = await Deno.readTextFile(sampleJsonPath);

const configFetcher = new FakeConfigFetcher();
configFetcher.setSuccess(sampleJson);

// Creating the ConfigCat client instance using the SDK Key
const client = getClient(
    "PKDVCLf-Hq-h-kCzMp-L7Q/HhOWfwVtZ0mb30i9wi17GQ",
    PollingMode.AutoPoll,
    {
        // Setting log level to Info to show detailed feature flag evaluation
        logger: createConsoleLogger(LogLevel.Info)
    },
    {
        configFetcher,
        cache: new InMemoryCache(),
        sdkType: "ConfigCat-Deno",
        sdkVersion: "0.0.0-sample"
    });

try {
    // Creating a user object to identify the user (optional)
    const user = new User("<SOME USERID>");
    user.country = "US";
    user.email = "configcat@example.com";
    user.custom = {
        "subscriptionType": "Pro",
        "role": "Admin",
        "version": "1.0.0"
    };

    // Accessing feature flag or setting value
    const value = await client.getValueAsync("isPOCFeatureEnabled", false, user);
    console.log(`isPOCFeatureEnabled: ${value}`);
}
finally {
    client.dispose();
}

Deno.exit();
