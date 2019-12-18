import 'mocha'
import { expect } from 'chai'
import fs from 'fs'
import { AlpineApk } from '../index'

describe('performance', function () {
    let apk = new AlpineApk();
    it('should update', async function () {
        //if (fs.existsSync('repos.json')) {
        //    await apk.setRepositories(JSON.parse(fs.readFileSync('repos.json', 'utf8')));
        //} else {
            const rawRepos = await apk.update();
        //    fs.writeFileSync('repos.json', JSON.stringify(rawRepos));
        //}
    })
    it('should get package', function () {
        this.timeout(500);
        expect(apk.recursiveGetHash('nodejs')).to.include('libuv');
        expect(apk.recursiveGetHash('gdb')).to.include('libgdbm');
    })
    it('should get all', function() {
        this.timeout(500);
        const map: {
            [name: string]: string
        } = {};
        for(let name in apk.pkgNames) {
            map[name] = apk.recursiveGetHash(name);
        }
        const stringed = JSON.stringify(map);
        expect(stringed.length).to.be.greaterThan(1_000_000);
    })
})