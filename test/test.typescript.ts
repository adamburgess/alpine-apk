import 'mocha'
import { expect } from 'chai'
import { writeFileSync } from 'fs'
import { inspect } from 'util'
describe('alpine-apk (typescript)', function() {
    it('can be requried', async function() {
        let { alpineApk } = await import('../index.js');
        expect(alpineApk).to.be.a('function');
    });

    it('fetches packages', async function() {
        this.timeout(5000);

        let { alpineApk } = await import('../index.js');

        let packages = await alpineApk('latest-stable', ['main', 'community']);

        let nodejsCurrent = packages.find(p => p.name === 'nodejs-current');
        expect(nodejsCurrent).to.not.be.undefined;
    });
});
