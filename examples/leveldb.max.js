'use strict';

/*!
 * Module dependencies
 */
// const debug = require('debug')('loopback:connector:leveldb');

const httpError = require('http-errors');
const Promise = require('bluebird');
const toArray = require('stream-to-array');
const moment = require('moment');
const applyFilter = require('loopback-filters');
const notObjectOrIsEmpty = require('not-empty-object').notObjectOrIsEmpty;

const level = require('level');
const levelAsync = Promise.promisify(level);

const NoSQL = require('../');
const Accessor = NoSQL.Accessor;

/**
 * Implement NoSQL connector.
 */
class LevelDB extends NoSQL {

  /**
   * To satisfy the tests from `loopback-datasource-juggler`.
   */
  getDefaultIdType(prop) {
    return Number;
  }

  /**
   * Connect to LevelDB
   */
  _connect(settings, database) {
    if (!database) {
      throw new Error('Database name must be specified in dataSource for LevelDB connector');
    }
    return levelAsync(database, Object.assign({
      valueEncoding: 'json'
    }, settings)).then(Promise.promisifyAll);
  }

  /**
   * Disconnect from LevelDB
   */
  _disconnect(leveldb) {
    return leveldb.closeAsync();
  }

}

/**
 * Implement Accessor.
 *
 * With all the hooks implemented.
 */
class LevelDBAccessor extends Accessor {

  /**
   * Save data to DB without a given id.
   *
   * Result is a promise with `[id, rev]` or an error.
   */
  postWithoutId(data, options) {
    // Generate ID.
    // Only works for the tests.
    const now = moment();
    const id = now.second() * 1000000 + now.millisecond() * 1000 + Math.floor(Math.random() * 1000);
    return this.postWithId(id, data, options);
  }

  /**
   * Save data to DB with a given id.
   *
   * Result is a promise with `[id, rev]` or an error.
   */
  postWithId(id, data, options) {
    return this.exists(id).then((exists) => {
      // To satisfy the tests from `loopback-datasource-juggler`.
      if (exists) {
        return Promise.reject(httpError(409, 'Conflict: duplicate id'));
      }
      return this.connection.call('putAsync', id, data, options).return([id, null]);
    });
  }

  /**
   * Save data to DB with a given id.
   *
   * Result is a promise with `[id, rev]` or an error.
   */
  putWithId(id, data, options) {
    return this.connection.call('putAsync', id, data, options).return([id, null]);
  }

  /**
   * Destroy data from DB by id.
   *
   * Result is a promise with whatever or an error.
   */
  destroyById(id, options) {
    return this.findById(id, options).then(() => {
      return this.connection.call('delAsync', id, options);
    }).return(true).catchReturn(false);
  }

  /**
   * Find data from DB by id.
   *
   * Result is a promise with the data or an error.
   */
  findById(id, options) {
    return this.connection.call('getAsync', id, options).then((data) => {
      if (data == null) {
        return Promise.reject(httpError(404));
      }
      // TODO: ?
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
      return data;
    });
  }

  /**
   * Find data from DB by multiple ids.
   *
   * Result is a promise with an array of 0 to many `[id, data]`.
   */
  findByIds(ids, options) {
    return this.connection.then((db) => {
      return toArray(db.createReadStream());
    }).filter((res) => {
      return ids.indexOf(parseInt(res.key)) > -1;
    }).map((res) => {
      return [res.key, res.value];
    });
  }

  /**
   * Find all data from DB for a model.
   *
   * Result is a promise with an array of 0 to many `[id, data]`.
   */
  findAll(options) {
    const type = this.modelName.toLowerCase();
    return this.connection.then((db) => {
      return toArray(db.createReadStream());
    }).filter((res) => {
      return res.value != null && res.value._type != null && res.value._type.toLowerCase() === type;
    }).map((res) => {
      return [res.key, res.value];
    });
  }

  /**
   * Find data from DB by filters.
   *
   * Result is a promise with an array of 0 to many `[id, data]`.
   */
  findByFilters(filters, options) {
    let promise = this.findAll(options);
    if (notObjectOrIsEmpty(filters)) {
      return promise;
    }
    return promise.reduce((all, res) => {
      const filtered = applyFilter([res[1]], { where: filters });
      if (notObjectOrIsEmpty(filtered)) {
        return all;
      }
      return all.concat([res]);
    }, []);
  }

  /**
   * Helper.
   */
  exists(id, options) {
    return this.connection.call('getAsync', id).then(Boolean).catchReturn(false);
  }

  /**
   * Convert data from model to DB format.
   */
  forDb(data) {
    data = super.forDb(data);
    // Save the model name.
    data._type = this.modelName;
    return data;
  }

  /**
   * Convert data from DB format to model.
   */
  fromDb(data) {
    data = super.fromDb(data);
    // Remove DB only data.
    if (data._type != null) {
      delete data._type;
    }
    return data;
  }

}

// Export initializer.
exports.initialize = NoSQL.initializer('leveldb', LevelDB, LevelDBAccessor);
