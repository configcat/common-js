## Deploy steps


1. Run tests
   ```PowerShell
    npm test
    ```

1. Create a new version (patch, minor, major)
Increase version number by using `npm version patch | minor | major`

    *Example: increasing patch version* 
    ```PowerShell
    npm version patch
    ```

1. Push tag to remote
    ```PowerShell
    git push origin <new version>
    ```
    *Example: npm push origin 1.1.15*

    You can follow the build status here -> https://travis-ci.org/configcat/common-js

1. Update dependant packages
    Update `common-js` version number in `js-sdk` and `node-sdk`'s `package.json` and re-deploy both packages.