import 'mocha'
import { expect } from 'chai'
import AlpineApk from '../index'

describe('performance', function () {
    const apk = new AlpineApk();
    it('should update', async function () {
        //if (fs.existsSync('repos.json')) {
        //    await apk.setRepositories(JSON.parse(fs.readFileSync('repos.json', 'utf8')));
        //} else {
        await apk.update();
        //    fs.writeFileSync('repos.json', JSON.stringify(rawRepos));
        //}
    });
    it('should get package', function () {
        this.timeout(500);
        expect(apk.getDependencyTree('nodejs')).to.include('libuv');
        expect(apk.getDependencyTree('gdb')).to.include('libgdbm');
    });
    it('should get all', function () {
        this.timeout(500);
        const map: {
            [name: string]: string
        } = {};
        for (const name in apk.pkgNames) {
            map[name] = apk.getDependencyTree(name);
        }
        const stringed = JSON.stringify(map);
        expect(stringed.length).to.be.greaterThan(1_000_000);
    });
});
