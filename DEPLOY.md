## Deploy steps


### 1. Create a new version (patch, minor, major)
Increase version number by using `npm version patch | minor | major`

 *Example: increasing patch version* 
```PowerShell
npm version patch
```

### 2. Push tag to remote
 ```PowerShell
  git push origin <new tag>
 ```

You can follow the build status here -> https://travis-ci.org/configcat/common-js

### 4. Update dependant packages
Update `common-js` version number in `js-sdk` and `node-sdk`'s `package.json` and re-deploy both packages.