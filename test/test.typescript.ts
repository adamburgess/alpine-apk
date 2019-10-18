import 'mocha'
import { expect } from 'chai'

import stringify from 'fast-safe-stringify'

describe('alpine-apk (typescript)', function () {
    it('can be requried', async function () {
        let { alpineApk } = await import('../index.js');
        expect(alpineApk).to.be.a('function');
    });

    it('fetches packages', async function () {
        this.timeout(5000);

        let { alpineApk } = await import('../index.js');

        let packages = await alpineApk('latest-stable', ['main', 'community']);

        let nodeJsCurrent = packages['nodejs-current'];
        expect(nodeJsCurrent).to.not.be.undefined;
        expect(stringify(nodeJsCurrent)).to.include('musl');
    });
});
