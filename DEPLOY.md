# How to deploy

## Via shell script

1. Run `./deploy.sh`

2. Update `common-js` in `js-sdk` and `node-sdk` and re-deploy both packages.

or

## Manually
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
    
    If you tag the commit, TravisCI automatically publishes the package to NPM. 
    ```PowerShell
    git push origin <new version>
    ```
    *Example: git push origin v1.1.15*

    You can follow the build status here -> https://travis-ci.com/configcat/common-js

2. Update `common-js` in `js-sdk`, `node-sdk` and `js-ssr-sdk` and re-deploy all packages.
3. Test all packages manually!
