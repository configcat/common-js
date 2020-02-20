const numeric = /^[0-9]+$/;
const compareIdentifiers = (a, b) => {
    const anum = numeric.test(a);
    const bnum = numeric.test(b);

    if (anum && bnum) {
        a = +a;
        b = +b;
    }

    return a === b ? 0
        : (anum && !bnum) ? -1
            : (bnum && !anum) ? 1
                : a < b ? -1
                    : 1
}

const rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);

const SEMVER_SPEC_VERSION = '2.0.0';

const MAX_LENGTH = 256;
const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER ||
  /* istanbul ignore next */ 9007199254740991;

const MAX_SAFE_COMPONENT_LENGTH = 16;


// The actual regexps go on exports.re
const re = [];
const src = [];
const t = {};
let R = 0;


const createToken = (name, value) => {
    const index = R++;
    t[name] = index;
    src[index] = value;
    re[index] = new RegExp(value, undefined);
}

createToken('NUMERICIDENTIFIER', '0|[1-9]\\d*');
createToken('NUMERICIDENTIFIERLOOSE', '[0-9]+');
createToken('NONNUMERICIDENTIFIER', '\\d*[a-zA-Z-][a-zA-Z0-9-]*');
createToken('MAINVERSION', `(${src[t['NUMERICIDENTIFIER']]})\\.` +
    `(${src[t['NUMERICIDENTIFIER']]})\\.` +
    `(${src[t['NUMERICIDENTIFIER']]})`);
createToken('MAINVERSIONLOOSE', `(${src[t['NUMERICIDENTIFIERLOOSE']]})\\.` +
    `(${src[t['NUMERICIDENTIFIERLOOSE']]})\\.` +
    `(${src[t['NUMERICIDENTIFIERLOOSE']]})`);
createToken('PRERELEASEIDENTIFIER', `(?:${src[t['NUMERICIDENTIFIER']]
    }|${src[t['NONNUMERICIDENTIFIER']]})`);
createToken('PRERELEASEIDENTIFIERLOOSE', `(?:${src[t['NUMERICIDENTIFIERLOOSE']]
    }|${src[t['NONNUMERICIDENTIFIER']]})`);
createToken('PRERELEASE', `(?:-(${src[t['PRERELEASEIDENTIFIER']]
    }(?:\\.${src[t['PRERELEASEIDENTIFIER']]})*))`);
createToken('PRERELEASELOOSE', `(?:-?(${src[t['PRERELEASEIDENTIFIERLOOSE']]
    }(?:\\.${src[t['PRERELEASEIDENTIFIERLOOSE']]})*))`);
createToken('BUILDIDENTIFIER', '[0-9A-Za-z-]+');
createToken('BUILD', `(?:\\+(${src[t['BUILDIDENTIFIER']]
    }(?:\\.${src[t['BUILDIDENTIFIER']]})*))`);
createToken('FULLPLAIN', `v?${src[t['MAINVERSION']]
    }${src[t['PRERELEASE']]}?${
    src[t['BUILD']]}?`);
createToken('FULL', `^${src[t['FULLPLAIN']]}$`);
createToken('LOOSEPLAIN', `[v=\\s]*${src[t['MAINVERSIONLOOSE']]
    }${src[t['PRERELEASELOOSE']]}?${
    src[t['BUILD']]}?`);
createToken('LOOSE', `^${src[t['LOOSEPLAIN']]}$`);

class SemVer {
    loose;
    includePrerelease;
    version;
    options;
    raw;
    major;
    minor;
    patch;
    build;
    prerelease;

    constructor(version, options) {
        if (!options || typeof options !== 'object') {
            options = {
                loose: !!options,
                includePrerelease: false
            }
        }
        if (version instanceof SemVer) {
            if (version.loose === !!options.loose &&
                version.includePrerelease === !!options.includePrerelease) {
                return version
            } else {
                version = version.version
            }
        } else if (typeof version !== 'string') {
            throw new TypeError(`Invalid Version: ${version}`)
        }

        if (version.length > MAX_LENGTH) {
            throw new TypeError(
                `version is longer than ${MAX_LENGTH} characters`
            )
        }

        this.options = options
        this.loose = !!options.loose
        // this isn't actually relevant for versions, but keep it so that we
        // don't run into trouble passing this.options around.
        this.includePrerelease = !!options.includePrerelease

        const m = version.trim().match(options.loose ? re[t['LOOSE']] : re[t['FULL']])

        if (!m) {
            throw new TypeError(`Invalid Version: ${version}`)
        }

        this.raw = version

        // these are actually numbers
        this.major = +m[1]
        this.minor = +m[2]
        this.patch = +m[3]

        if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
            throw new TypeError('Invalid major version')
        }

        if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
            throw new TypeError('Invalid minor version')
        }

        if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
            throw new TypeError('Invalid patch version')
        }

        // numberify any prerelease numeric ids
        if (!m[4]) {
            this.prerelease = []
        } else {
            this.prerelease = m[4].split('.').map((id) => {
                if (/^[0-9]+$/.test(id)) {
                    const num = +id
                    if (num >= 0 && num < MAX_SAFE_INTEGER) {
                        return num
                    }
                }
                return id
            })
        }

        this.build = m[5] ? m[5].split('.') : []
        this.format()
    }

    format() {
        this.version = `${this.major}.${this.minor}.${this.patch}`
        if (this.prerelease.length) {
            this.version += `-${this.prerelease.join('.')}`
        }
        return this.version
    }

    toString() {
        return this.version
    }

    compare(other) {
        if (!(other instanceof SemVer)) {
            if (typeof other === 'string' && other === this.version) {
                return 0
            }
            other = new SemVer(other, this.options)
        }

        if (other.version === this.version) {
            return 0
        }

        return this.compareMain(other) || this.comparePre(other)
    }

    compareMain(other) {
        if (!(other instanceof SemVer)) {
            other = new SemVer(other, this.options)
        }

        return (
            compareIdentifiers(this.major, other.major) ||
            compareIdentifiers(this.minor, other.minor) ||
            compareIdentifiers(this.patch, other.patch)
        )
    }

    comparePre(other) {
        if (!(other instanceof SemVer)) {
            other = new SemVer(other, this.options)
        }

        // NOT having a prerelease is > having one
        if (this.prerelease.length && !other.prerelease.length) {
            return -1
        } else if (!this.prerelease.length && other.prerelease.length) {
            return 1
        } else if (!this.prerelease.length && !other.prerelease.length) {
            return 0
        }

        let i = 0
        do {
            const a = this.prerelease[i]
            const b = other.prerelease[i]
            if (a === undefined && b === undefined) {
                return 0
            } else if (b === undefined) {
                return 1
            } else if (a === undefined) {
                return -1
            } else if (a === b) {
                continue
            } else {
                return compareIdentifiers(a, b)
            }
        } while (++i)
    }

    compareBuild(other) {
        if (!(other instanceof SemVer)) {
            other = new SemVer(other, this.options)
        }

        let i = 0
        do {
            const a = this.build[i]
            const b = other.build[i]
            if (a === undefined && b === undefined) {
                return 0
            } else if (b === undefined) {
                return 1
            } else if (a === undefined) {
                return -1
            } else if (a === b) {
                continue
            } else {
                return compareIdentifiers(a, b)
            }
        } while (++i)
    }

    // preminor will bump the version up to the next minor release, and immediately
    // down to pre-release. premajor and prepatch work the same way.
    inc(release, identifier) {
        switch (release) {
            case 'premajor':
                this.prerelease.length = 0
                this.patch = 0
                this.minor = 0
                this.major++
                this.inc('pre', identifier)
                break
            case 'preminor':
                this.prerelease.length = 0
                this.patch = 0
                this.minor++
                this.inc('pre', identifier)
                break
            case 'prepatch':
                // If this is already a prerelease, it will bump to the next version
                // drop any prereleases that might already exist, since they are not
                // relevant at this point.
                this.prerelease.length = 0
                this.inc('patch', identifier)
                this.inc('pre', identifier)
                break
            // If the input is a non-prerelease version, this acts the same as
            // prepatch.
            case 'prerelease':
                if (this.prerelease.length === 0) {
                    this.inc('patch', identifier)
                }
                this.inc('pre', identifier)
                break

            case 'major':
                // If this is a pre-major version, bump up to the same major version.
                // Otherwise increment major.
                // 1.0.0-5 bumps to 1.0.0
                // 1.1.0 bumps to 2.0.0
                if (
                    this.minor !== 0 ||
                    this.patch !== 0 ||
                    this.prerelease.length === 0
                ) {
                    this.major++
                }
                this.minor = 0
                this.patch = 0
                this.prerelease = []
                break
            case 'minor':
                // If this is a pre-minor version, bump up to the same minor version.
                // Otherwise increment minor.
                // 1.2.0-5 bumps to 1.2.0
                // 1.2.1 bumps to 1.3.0
                if (this.patch !== 0 || this.prerelease.length === 0) {
                    this.minor++
                }
                this.patch = 0
                this.prerelease = []
                break
            case 'patch':
                // If this is not a pre-release version, it will increment the patch.
                // If it is a pre-release it will bump up to the same patch version.
                // 1.2.0-5 patches to 1.2.0
                // 1.2.0 patches to 1.2.1
                if (this.prerelease.length === 0) {
                    this.patch++
                }
                this.prerelease = []
                break
            // This probably shouldn't be used publicly.
            // 1.0.0 'pre' would become 1.0.0-0 which is the wrong direction.
            case 'pre':
                if (this.prerelease.length === 0) {
                    this.prerelease = [0]
                } else {
                    let i = this.prerelease.length
                    while (--i >= 0) {
                        if (typeof this.prerelease[i] === 'number') {
                            this.prerelease[i]++
                            i = -2
                        }
                    }
                    if (i === -1) {
                        // didn't increment anything
                        this.prerelease.push(0)
                    }
                }
                if (identifier) {
                    // 1.2.0-beta.1 bumps to 1.2.0-beta.2,
                    // 1.2.0-beta.fooblz or 1.2.0-beta bumps to 1.2.0-beta.0
                    if (this.prerelease[0] === identifier) {
                        if (isNaN(this.prerelease[1])) {
                            this.prerelease = [identifier, 0]
                        }
                    } else {
                        this.prerelease = [identifier, 0]
                    }
                }
                break

            default:
                throw new Error(`invalid increment argument: ${release}`)
        }
        this.format()
        this.raw = this.version
        return this
    }
}

const parse = (version, options) => {
    if (!options || typeof options !== 'object') {
        options = {
            loose: !!options,
            includePrerelease: false
        }
    }

    if (version instanceof SemVer) {
        return version
    }

    if (typeof version !== 'string') {
        return null
    }

    if (version.length > MAX_LENGTH) {
        return null
    }

    const r = options.loose ? re[t['LOOSE']] : re[t['FULL']]
    if (!r.test(version)) {
        return null
    }

    try {
        return new SemVer(version, options)
    } catch (er) {
        return null
    }
}

const compare = (a, b, loose) =>
    new SemVer(a, loose).compare(new SemVer(b, loose));

export const valid = (version) => {
    const v = parse(version, false)
    return v ? v.version : null
};
export const looseeq = (a, b) => compare(a, b, true) === 0;
export const eq = (a, b) => compare(a, b, false) === 0;
export const lt = (a, b) => compare(a, b, false) < 0;
export const lte = (a, b) => compare(a, b, false) <= 0;
export const gt = (a, b) => compare(a, b, false) > 0;
export const gte = (a, b) => compare(a, b, false) >= 0;