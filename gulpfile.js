var gulp = require('gulp');
var replace = require('gulp-replace');
var fs = require('fs');

const OUT_CJS = 'lib/cjs';
const OUT_ESM = 'lib/esm';

function updateVersion(dst){

    const VERSION = JSON.parse(fs.readFileSync('./package.json')).version;

    return gulp.src(dst + '/Version.js')
        .pipe(replace('COMMON_JS_VERSION', VERSION))
        .pipe(gulp.dest(dst));
}

function updateVersion_cjs(){
    return updateVersion(OUT_CJS);
}

function updateVersion_esm(){
    return updateVersion(OUT_ESM);
}

exports.default = gulp.series(    
    gulp.parallel(updateVersion_esm, updateVersion_cjs));
