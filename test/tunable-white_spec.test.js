/* global describe, beforeEach, afterEach, it */
// const should = require('should')
const helper = require('node-red-node-test-helper')
const testNode = require('../tunable-white.js')

helper.init(require.resolve('node-red'))

describe('tunable-white Node', function () {
  beforeEach(function (done) {
    helper.startServer(done)
  })

  afterEach(function (done) {
    helper.unload()
    helper.stopServer(done)
  })

  it('should be loaded', function (done) {
    const flow = [{ id: 'n1', type: 'tunable-white', name: 'tunable-white' }]
    helper.load(testNode, flow, function () {
      const n1 = helper.getNode('n1')
      n1.should.have.property('name', 'tunable-white')
      done()
    })
  })
})
