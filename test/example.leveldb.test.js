'use strict';

require('should');

const path = require('path');
const leveldown = require('leveldown');
const randexp = require('randexp').randexp;
const DataSource = require('loopback-datasource-juggler').DataSource;
const Connector = require('../examples/leveldb');

describe('LevelDB connector', function() {
  let ds;
  let connector;

  before(function() {
    const config = {
      database: path.resolve(__dirname, randexp(/^[a-z]{16}$/))
    };
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
    connector.connect().then(function(db) {
      const location = db.db.db.location;
      return connector.disconnect().then(function() {
        leveldown.destroy(location, done);
      });
    }).catch(done);
  });

  require('loopback-datasource-juggler/test/datatype.test.js');
  require('loopback-datasource-juggler/test/manipulation.test.js');
});
