import axios from 'axios'
import tarStream, { pack } from 'tar-stream'
import { createGunzip } from 'zlib'
import { pipeline as pipelineCb, Readable } from 'stream'
import { promisify } from 'util'
import { StringDecoder } from 'string_decoder'
const pipeline = promisify(pipelineCb);

export interface AlpineRepositoryRaw {
    name: string
    content: string
    description: string
}

async function downloadRepo(repo: string, version: string, arch: string = 'x86_64'): Promise<AlpineRepositoryRaw> {
    const url = `http://dl-cdn.alpinelinux.org/alpine/${version}/${repo}/${arch}/APKINDEX.tar.gz`

    let response = await axios(url, {
        responseType: 'stream'
    });

    let responseStream = response.data as Readable;
    let unzip = createGunzip();
    let tar = tarStream.extract();

    let fileData = {
        APKINDEX: '',
        DESCRIPTION: ''
    };

    tar.on('entry', (header, stream, next) => {
        if (header.name in fileData) {
            const stringDec = new StringDecoder();
            stream.on('data', chunk => {
                fileData[header.name as keyof typeof fileData] += stringDec.write(chunk);
            });
            stream.on('end', () => {
                fileData[header.name as keyof typeof fileData] += stringDec.end();
                next();
            });
        } else {
            stream.on('end', next);
        }
        stream.resume();
    });

    await pipeline(
        responseStream,
        unzip,
        tar
    );

    if (!fileData.APKINDEX || !fileData.DESCRIPTION) throw new Error(`Failed to download ${url}`);

    return {
        name: repo,
        content: fileData.APKINDEX,
        description: fileData.DESCRIPTION
    };
}

export interface AlpineApkPackage {
    deps: string[]
    version: string
}

export class AlpineApk {
    async update(version: string = 'v3.10', arch: string = 'x86_64') {
        const repos = ['main', 'community'];
        const rawRepos = await Promise.all(repos.map(r => downloadRepo(r, version, arch)));
        this.setRepositories(rawRepos);
        return rawRepos;
    }

    pkgs: {
        [name: string]: AlpineApkPackage
    } = {};

    pkgNames: {
        [name: string]: AlpineApkPackage
    } = {};

    setRepositories(repositories: AlpineRepositoryRaw[]) {
        for (let repo of repositories) {
            for (let pkgLines of repo.content.split('\n\n')) {
                let pkg: AlpineApkPackage = {
                    version: '',
                    deps: []
                };
                for (let line of pkgLines.split('\n')) {
                    let c = line[0];
                    let rest = line.substr(2);
                    if (c == 'P') {
                        this.pkgs[rest] = this.pkgNames[rest] = pkg;
                    } else if(c == 'D') {
                        pkg.deps = rest.split(' ').map(d => {
                            if(d.startsWith('!')) d = d.substr(1);
                            [d] = d.split(/[=<>~]/);
                            return d;
                        });
                    } else if(c == 'p') {
                        for(let p of rest.split(' ')) {
                            [p] = p.split('=');
                            this.pkgs[p] = pkg;
                        }
                    } else if(c == 'V') {
                        pkg.version = rest;
                    }
                }
            }
        }
    }

    get(name: string) {
        return this.pkgs[name];
    }

    recursiveGetHash(name: string) {
        let seen = new Set<AlpineApkPackage>();

        return this.recursiveGetHash_(name, this.pkgNames[name], seen);
    }

    private recursiveGetHash_(name: string, pkg: AlpineApkPackage, seen: Set<AlpineApkPackage>) {
        let output = name + '@' + pkg.version + ',';
        for(let dep of pkg.deps) {
            let dPkg = this.pkgs[dep];
            if(dPkg === undefined) {
                continue;
            }
            if(!seen.has(dPkg)) {
                seen.add(dPkg);
                output += this.recursiveGetHash_(dep, dPkg, seen);
            }
        }
        return output;
    }
}