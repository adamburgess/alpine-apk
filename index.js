"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const tar_stream_1 = __importDefault(require("tar-stream"));
const zlib_1 = require("zlib");
const stream_1 = require("stream");
const util_1 = require("util");
const string_decoder_1 = require("string_decoder");
const pipeline = util_1.promisify(stream_1.pipeline);
// export the function as default
module.exports = alpineApk;
// typescript will add the types and also the function to the exports, so set it before that
exports = alpineApk;
async function alpineApk(version = 'latest-stable', repositories = ['main', 'community'], architecture = 'x86_64') {
    let packageMetadata = await Promise.all(repositories.map(async (repo) => {
        const url = `http://dl-cdn.alpinelinux.org/alpine/${version}/${repo}/${architecture}/APKINDEX.tar.gz`;
        let response = await axios_1.default(url, {
            responseType: 'stream'
        });
        let responseStream = response.data;
        let unzip = zlib_1.createGunzip();
        let tar = tar_stream_1.default.extract();
        let fileData = {
            APKINDEX: '',
            DESCRIPTION: ''
        };
        tar.on('entry', (header, stream, next) => {
            if (header.name in fileData) {
                const stringDec = new string_decoder_1.StringDecoder();
                stream.on('data', chunk => {
                    fileData[header.name] += stringDec.write(chunk);
                });
                stream.on('end', () => {
                    fileData[header.name] += stringDec.end();
                    next();
                });
            }
            else {
                stream.on('end', next);
            }
            stream.resume();
        });
        await pipeline(responseStream, unzip, tar);
        if (!fileData.APKINDEX || !fileData.DESCRIPTION)
            throw new Error(`Failed to download ${url}`);
        return Object.assign({ repo }, fileData);
    }));
    const middleStage = packageMetadata.flatMap(meta => {
        const repo = {
            name: meta.repo,
            version: meta.DESCRIPTION
        };
        const packages = meta.APKINDEX.split('\n\n').map(pkgStr => {
            let lines = pkgStr.split('\n');
            let index = {};
            for (let line of lines) {
                let c = line[0];
                let rest = line.substr(2);
                if (c == 'S' || c == 'I') {
                    index[c] = parseInt(rest, 10);
                }
                else if (c == 't') {
                    index[c] = new Date(parseInt(rest, 10) * 1000);
                }
                else {
                    index[c] = rest;
                }
            }
            let pkg = {
                name: index.P,
                architecture: index.A,
                commit: index.c,
                dependencies: [],
                description: index.T,
                license: index.L,
                maintainer: index.m,
                origin: index.o,
                packageSize: index.S,
                packageSizeInstalled: index.I,
                provides: [],
                pullChecksum: index.C,
                repository: repo,
                timestamp: index.t,
                url: index.U,
                version: index.V
            };
            if (index.p) {
                let provides = index.p.split(' ');
                for (let p of provides) {
                    let type;
                    let version;
                    let name;
                    if (p.includes(':'))
                        [type, p] = p.split(':');
                    if (p.includes('='))
                        [name, version] = p.split('=');
                    else
                        name = p;
                    if (!type) {
                        pkg.provides.push({
                            type: 'package',
                            name,
                            version: version || ''
                        });
                    }
                    else if ((type == 'so' || type == 'pc') && version !== undefined) {
                        pkg.provides.push({
                            type: type == 'so' ? 'library' : 'header',
                            name,
                            version: version
                        });
                    }
                    else {
                        pkg.provides.push({
                            type: 'command',
                            name
                        });
                    }
                }
            }
            return { pkg, depsStr: index.D };
        });
        return packages;
    });
    let provides = middleStage.flatMap(p => p.pkg.provides.map(prov => (Object.assign({ pkg: p.pkg }, prov))));
    let m1 = provides.flatMap(p => {
        let ret = [[`${p.name}:${p.type}`, p.pkg]];
        if (p.version)
            ret.push([`${p.name}:${p.type}:${p.version}`, p.pkg]);
        return ret;
    });
    let m2 = middleStage.map(p => [`${p.pkg.name}:package`, p.pkg]);
    let conc = m1.concat(m2);
    let providesMap = Object.fromEntries(conc);
    for (let { pkg, depsStr } of middleStage) {
        if (!depsStr)
            continue;
        let deps = depsStr.split(' ');
        for (let dep of deps) {
            let anti;
            let type;
            let version;
            let name;
            let dOrig = dep;
            anti = dep.startsWith('!');
            if (anti)
                dep = dep.substr(1);
            if (dep.includes(':'))
                [type, dep] = dep.split(':');
            if (dep.includes('>') || dep.includes('<'))
                [name] = dep.split(/[<>]/);
            else if (dep.includes('='))
                [name, version] = dep.split('=');
            else
                name = dep;
            // resolve.
            if (type === undefined) {
                // search for package
                let link;
                let found = version === undefined ? providesMap[`${name}:package`] : providesMap[`${name}:package:${version}`];
                if (!found) {
                    // attempt to find direct package
                    let foundPackage = middleStage.find(p => p.pkg.name === name &&
                        (version === undefined || p.pkg.version === version));
                    if (!foundPackage) {
                        link = undefined;
                    }
                    else {
                        link = foundPackage.pkg;
                    }
                }
                else {
                    link = found;
                }
                pkg.dependencies.push({
                    type: 'package',
                    name,
                    version,
                    link,
                    anti
                });
            }
            else if (type === 'cmd') {
                // search for command
                let found = providesMap[`${name}:command`];
                let link = found ? found : undefined;
                pkg.dependencies.push({
                    type: 'command',
                    name,
                    version,
                    link,
                    anti
                });
            }
            else {
                // search for library/header
                let aType = type === 'so' ? 'library' : 'header';
                let found = version === undefined ? providesMap[`${name}:${aType}`] : providesMap[`${name}:${aType}:${version}`];
                let link = found ? found : undefined;
                pkg.dependencies.push({
                    type: aType,
                    name,
                    version,
                    link,
                    anti
                });
            }
        }
    }
    return middleStage.map(p => p.pkg);
}
exports.alpineApk = alpineApk;
