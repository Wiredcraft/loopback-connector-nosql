'use strict';

require('should');

const DataSource = require('loopback-datasource-juggler').DataSource;
const Connector = require('../examples/ioredis');

describe('IORedis connector', function() {
  let ds;
  let connector;

  before(function() {
    const config = {};
    ds = new DataSource(Connector, Object.assign({}, config));
    ds.log = function(a) {
      console.log(a);
    };
    connector = ds.connector;
    global.getDataSource = global.getSchema = function() {
      return ds;
    };
  });

  after(function(done) {
    connector.connect().call('flushall').then(function() {
      ds = null;
      connector = null;
      done();
    }, done);
  });

  require('loopback-datasource-juggler/test/datatype.test.js');
  require('loopback-datasource-juggler/test/manipulation.test.js');
});
