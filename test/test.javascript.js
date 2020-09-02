require('mocha');
const expect = require('chai').expect;

describe('alpine-apk (javascript)', function() {
    it('can be requried', function() {
        let AlpineApk = require('../index.js');
        expect(AlpineApk).to.be.a('function');
        const alpineApk = new AlpineApk();
        expect(alpineApk.get).to.be.a('function');
    });
});
