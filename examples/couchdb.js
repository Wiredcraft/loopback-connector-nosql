'use strict';

/*!
 * Module dependencies
 */
// const debug = require('debug')('loopback:connector:couchdb');

const httpError = require('http-errors');
const Promise = require('bluebird');
const moment = require('moment');

const nano = require('nano');

const NoSQL = require('../');
const Accessor = NoSQL.Accessor;

/*!
 * Generate the CouchDB URL from the options
 */
function generateCouchDBURL(options) {
  options.hostname = (options.hostname || options.host || '127.0.0.1');
  options.protocol = options.protocol || 'http';
  options.port = (options.port || 5984);
  return options.protocol + '://' + options.hostname + ':' + options.port;
}

/**
 * Implement NoSQL connector.
 */
class CouchDB extends NoSQL {

  /**
   * To satisfy the tests from `loopback-datasource-juggler`.
   */
  getDefaultIdType(prop) {
    return Number;
  }

  /**
   * Connect to CouchDB
   */
  _connect(settings, database) {
    if (!database) {
      throw new Error('Database name must be specified in dataSource for CouchDB connector');
    }
    settings.url = settings.url || generateCouchDBURL(settings);
    const _nano = nano(Object.assign({}, settings, {
      parseUrl: false
    }));
    this._nano = Promise.resolve(Promise.promisifyAll(_nano));
    this._db = Promise.resolve(Promise.promisifyAll(_nano.db));
    return this._nano.call('use', database).then(Promise.promisifyAll);
  }

  /**
   * Disconnect from CouchDB
   */
  _disconnect(scopedNano) {
    // Cleanup.
    this._nano = null;
    this._db = null;
    return Promise.resolve(true);
  }

}

/**
 * Implement Accessor.
 */
class CouchDBAccessor extends Accessor {

  /**
   * Save data to DB with a given id.
   *
   * Result is a promise with `[id, rev]` or an error.
   */
  saveWithId(id, data, options) {
    const _id = this.modelName + ':' + id;
    // Force PUT.
    options = Object.assign({ docName: _id }, options || {});
    // Make sure no ID is given.
    if (data._id != null) {
      delete data._id;
    }
    return this.getRev(id, data).then((_rev) => {
      if (_rev) {
        data._rev = _rev;
      }
      return this.connection.call('insertAsync', data, options).then((res) => {
        return [id, res.rev];
      });
    });
  }

  /**
   * Save data to DB without a given id.
   *
   * Result is a promise with `[id, rev]` or an error.
   */
  saveWithoutId(data, options) {
    // Generate ID.
    // Only works for the tests.
    const now = moment();
    const id = now.second() * 1000000 + now.millisecond() * 1000 + Math.floor(Math.random() * 1000);
    return this.saveWithId(id, data, options);
  }

  /**
   * Destroy data from DB by id.
   *
   * Result is a promise with whatever or an error.
   */
  destroyById(id, data, options) {
    const _id = this.modelName + ':' + id;
    return this.getRev(id, data).then((_rev) => {
      return this.connection.call('destroyAsync', _id, _rev);
    });
  }

  /**
   * Find data from DB by id.
   *
   * Result is a promise with the data or an error.
   */
  findById(id, options) {
    const _id = this.modelName + ':' + id;
    return this.connection.call('getAsync', _id, options).then((data) => {
      if (data == null) {
        return Promise.reject(httpError(404));
      }
      return data;
    });
  }

  /**
   * Find all data from DB for a model.
   *
   * Result is a promise with an array of 0 to many `[id, data]`.
   */
  findAll(options) {
    return this.connection.call('listAsync', {
      include_docs: true
    }).get('rows').filter((res) => {
      return res.id.startsWith(this.modelName);
    }).map((res) => {
      const id = res.id.split(':')[1];
      return [id, res.doc];
    });
  }

  /**
   * Convert data from model to DB format.
   */
  forDb(data) {
    data = super.forDb(data);
    // To satisfy the tests from `loopback-datasource-juggler`.
    if (data._id != null) {
      delete data._id;
    }
    if (data._rev != null) {
      delete data._rev;
    }
    return data;
  }

  /**
   * Convert data from DB format to model.
   */
  fromDb(data) {
    data = super.fromDb(data);
    // To satisfy the tests from `loopback-datasource-juggler`.
    if (data._id != null) {
      delete data._id;
    }
    if (data._rev != null) {
      delete data._rev;
    }
    return data;
  }

  /**
   * Helper.
   */
  getRev(id, data) {
    if (data._rev != null) {
      return Promise.resolve(data._rev);
    }
    return this.findById(id).get('_rev').catchReturn(null);
  }

}

// Export initializer.
exports.initialize = NoSQL.initializer('couchdb', CouchDB, CouchDBAccessor);
