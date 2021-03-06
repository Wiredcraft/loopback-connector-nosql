'use strict';

require('should');

const randexp = require('randexp').randexp;
const DataSource = require('loopback-datasource-juggler').DataSource;
const Connector = require('../examples/couchdb');

describe('CouchDB connector', function() {
  let ds;
  let connector;

  before(function() {
    const config = {
      database: randexp(/^[a-z]{16}$/)
    };
    ds = new DataSource(Connector, Object.assign({}, config));
    ds.log = function(a) {
      console.log(a);
    };
    connector = ds.connector;
    global.getDataSource = global.getSchema = function() {
      return ds;
    };
  });

  before(function(done) {
    connector._db.call('create', connector.settings.database, done);
  });

  after(function(done) {
    connector._db.call('destroy', connector.settings.database, done);
  });

  require('loopback-datasource-juggler/test/datatype.test.js');
  require('loopback-datasource-juggler/test/manipulation.test.js');
});
