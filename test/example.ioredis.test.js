'use strict';

require('should');

const DataSource = require('loopback-datasource-juggler').DataSource;
const Connector = require('../examples/ioredis');

describe('IORedis connector', function() {

  let ds;
  let connector;

  before(function() {
    const config = {};
    global.getDataSource = global.getSchema = function(customConfig) {
      if (ds) {
        return ds;
      }
      ds = new DataSource(Connector, Object.assign({}, config, customConfig));
      ds.log = function(a) {
        console.log(a);
      };
      connector = ds.connector;
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
