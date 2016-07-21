'use strict';

/*!
 * Module dependencies
 */
const debug = require('debug')('loopback:connector:nosql');

const Connector = require('loopback-connector').Connector;
const applyFilter = require('loopback-filters');
const httpError = require('http-errors');
const Promise = require('bluebird');
const notEmptyObject = require('not-empty-object').notEmptyObject;

class NoSQL extends Connector {

  /**
   * Constructor
   *
   * @param {String} name
   * @param {Object} settings
   * @param {Object} Accessor A child accessor class, see `Accessor()`
   */
  constructor(name, settings, Accessor) {
    super(name, settings);
    this._Accessor = Accessor;
    this._accessors = {};
  }

  /**
   * Each model an accessor instance.
   */
  getAccessor(modelName) {
    if (this._accessors[modelName] == null) {
      this._accessors[modelName] = new this._Accessor({
        modelName: modelName,
        idName: this.idName(modelName),
        properties: this.getModelDefinition(modelName).properties,
        settings: this.settings,
        connection: this.connect()
      });
    }
    return this._accessors[modelName];
  }

  /**
   * Connect to DB.
   *
   * Connection is cached with a promise.
   *
   * Hook: `_connect()` must be implemented by a child class.
   */
  connect(callback) {
    if (this._connection == null) {
      // Connect.
      debug('connecting:', this.settings);
      let settings = Object.assign({}, this.settings);
      // Optional.
      let database;
      if (settings.database) {
        database = settings.database;
        delete settings.database;
      } else if (settings.db) {
        database = settings.db;
        delete settings.db;
      }
      this._connection = Promise.resolve(this._connect(settings, database)).bind(this);
    }
    // Callback is optional.
    return this._connection.asCallback(callback);
  }

  /**
   * Disconnect from DB.
   *
   * Hook: `_disconnect()` must be implemented by a child class.
   */
  disconnect(callback) {
    if (this._connection == null) {
      return Promise.resolve(true).asCallback(callback);
    }
    // Disconnect.
    let promise = this._connection.then(this._disconnect);
    // Cleanup.
    this._connection = null;
    // Callback is optional.
    return promise.asCallback(callback);
  }

  /**
   * Hooks.
   */

  /**
   * Implement `create()`. Create an instance of Model with given data and save to the attached data
   * source.
   *
   * @see `DataAccessObject.create()`
   */
  create(modelName, data, options, callback) {
    const id = this.getIdValue(modelName, data);
    // Result must be `id` and `rev`.
    if (id == null) {
      return this.saveWithoutId(modelName, data, options).asCallback(callback, { spread: true });
    }
    // Throw if it exists in DB.
    return this.findById(modelName, id, options).then((res) => {
      return Promise.reject(httpError(409, 'Conflict: duplicate id'));
    }, (err) => {
      return this.saveWithId(modelName, id, data, options);
    }).asCallback(callback, { spread: true });
  }

  /**
   * Implement `save()`. Save instance.
   *
   * @see `DataAccessObject.prototype.save()`
   */
  save(modelName, data, options, callback) {
    const id = this.getIdValue(modelName, data);
    // Result is not used.
    return this.saveWithId(modelName, id, data, options).asCallback(callback);
  }

  /**
   * Implement `destroy()`. Delete object from persistence.
   *
   * @see `DataAccessObject.prototype.remove()`
   */
  destroy(modelName, id, options, callback) {
    const idName = this.idName(modelName);
    // Result is just an info.
    return this.findById(modelName, id, options).then((data) => {
      return this.destroyById(modelName, data[idName], data, options);
    }).return({ count: 1 }).catchReturn({ count: 0 }).asCallback(callback);
  }

  /**
   * TODO: Implement `findOrCreate()`?
   */

  /**
   * Implement `updateAttributes()`. Update set of attributes.
   *
   * @see `DataAccessObject.updateAttributes()`
   */
  updateAttributes(modelName, id, data, options, callback) {
    // Result is not used.
    // Read and merge.
    return this.findById(modelName, id, options).then((res) => {
      return this.saveWithId(modelName, id, Object.assign(res, data), options);
    }).asCallback(callback);
  }

  /**
   * TODO: Implement `updateOrCreate()`?
   */

  /**
   * Implement `replaceById()`. Update set of attributes.
   *
   * @see `DataAccessObject.replaceById()`
   */
  replaceById(modelName, id, data, options, callback) {
    // Result is not used.
    // Read to confirm it's there.
    return this.findById(modelName, id, options).then((res) => {
      return this.saveWithId(modelName, id, data, options);
    }).asCallback(callback);
  }

  /**
   * TODO: Implement `replaceOrCreate()`?
   */

  /**
   * Hooks that do bulk operations.
   */

  /**
   * Implement `all()`. Find all instances of Model that match the specified query.
   *
   * @see `DataAccessObject.find()`
   */
  all(modelName, query, options, callback) {
    // Clone query.
    query = Object.assign({}, query || {});
    const ids = this.getIdsFromWhere(modelName, query.where);
    // Result must be an array.
    let promise;
    if (notEmptyObject(ids)) {
      promise = this.findByIds(modelName, ids, options);
    } else {
      promise = this.findByFilters(modelName, query.where, options);
    }
    // Apply the query except for the filters.
    delete query.where;
    if (notEmptyObject(query)) {
      promise = promise.then((res) => {
        return applyFilter(res, query);
      });
    }
    return promise.asCallback(callback);
  }

  /**
   * Implement `update()`. Update multiple instances that match the where clause.
   *
   * @see `DataAccessObject.update()`
   */
  update(modelName, where, data, options, callback) {
    // Result is just an info.
    return this.all(modelName, { where: where }, options).map((res) => {
      const id = this.getIdValue(modelName, res);
      return this.saveWithId(modelName, id, Object.assign(res, data), options).return(true).catchReturn(false);
    }).filter(Boolean).reduce((info) => {
      info.count++;
      return info;
    }, { count: 0 }).asCallback(callback);
  }

  /**
   * Implement `destroyAll()`. Destroy all matching records.
   *
   * @see `DataAccessObject.remove()`
   */
  destroyAll(modelName, where, options, callback) {
    const idName = this.idName(modelName);
    // Result is just an info.
    return this.all(modelName, { where: where }, options).map((data) => {
      return this.destroyById(modelName, data[idName], data, options).return(true).catchReturn(false);
    }).filter(Boolean).reduce((info) => {
      info.count++;
      return info;
    }, { count: 0 }).asCallback(callback);
  }

  /**
   * Implement `count()`. Return count of matched records.
   *
   * @see `DataAccessObject.count()`
   */
  count(modelName, where, options, callback) {
    return this.all(modelName, { where: where }, options).reduce((count) => {
      return count + 1;
    }, 0).asCallback(callback);
  }

  /**
   * Special.
   */

  /**
   * Not a hook; just to satisfy the tests from `loopback-datasource-juggler`.
   */
  find(modelName, id, options, callback) {
    return this.findById(modelName, id, options).asCallback(callback);
  }

  /**
   * Helpers.
   */

  /**
   * If given, get the ids from the where filter.
   *
   * @return {Array|null}
   */
  getIdsFromWhere(modelName, where) {
    if (where == null) {
      return null;
    }
    const id = this.getIdValue(modelName, where);
    if (id == null) {
      return null;
    }
    if (typeof id === 'number' || typeof id === 'string' || Buffer.isBuffer(id)) {
      return [id];
    }
    if (Array.isArray(id.inq)) {
      return id.inq;
    }
    // TODO: other filter operators?
    return null;
  }

  /**
   * Accessor hooks.
   */

  /**
   * Save data to DB with a given id.
   *
   * Hook: `saveWithId()` must be implemented by the provided accessor class.
   */
  saveWithId(modelName, id, data, options) {
    const accessor = this.getAccessor(modelName);
    // Expect a promise with `[id, rev]` or an error.
    return accessor.saveWithId(id, this.forDb(modelName, data), options);
  }

  /**
   * Save data to DB without a given id.
   *
   * Hook: `saveWithoutId()` must be implemented by the provided accessor class.
   */
  saveWithoutId(modelName, data, options) {
    const accessor = this.getAccessor(modelName);
    // Expect a promise with `[id, rev]` or an error.
    return accessor.saveWithoutId(this.forDb(modelName, data), options);
  }

  /**
   * Destroy data from DB by id.
   *
   * Hook: `destroyById()` must be implemented by the provided accessor class.
   */
  destroyById(modelName, id, data, options) {
    const accessor = this.getAccessor(modelName);
    // Expect a promise with whatever or an error.
    return accessor.destroyById(id, data, options);
  }

  /**
   * Find data from DB by id.
   *
   * Hook: `findById()` must be implemented by the provided accessor class.
   */
  findById(modelName, id, options) {
    const accessor = this.getAccessor(modelName);
    // Expect a promise with the data or an error.
    return accessor.findById(id, options).then((data) => {
      return this.fromDb(modelName, id, data);
    });
  }

  /**
   * Find data from DB by multiple ids.
   *
   * Hook: `findByIds()` can be implemented by the provided accessor class.
   */
  findByIds(modelName, ids, options) {
    const accessor = this.getAccessor(modelName);
    // Default implementation is using `findById()`.
    if (typeof accessor.findByIds !== 'function') {
      return Promise.map(ids, (id) => {
        return this.findById(modelName, id, options).catchReturn(false);
      }).filter(Boolean);
    }
    // Expect a promise with an array of 0 to many `[id, data]`.
    return accessor.findByIds(ids, options).map((res) => {
      return this.fromDb(modelName, res[0], res[1]);
    });
  }

  /**
   * Find all data from DB for a model.
   *
   * Hook: `findAll()` must be implemented by the provided accessor class.
   */
  findAll(modelName, options) {
    const accessor = this.getAccessor(modelName);
    // Expect a promise with an array of `[id, data]`, can be empty.
    return accessor.findAll(options).map((res) => {
      return this.fromDb(modelName, res[0], res[1]);
    });
  }

  /**
   * Find data from DB by filters.
   *
   * Hook: `findByFilters()` can be implemented by the provided accessor class.
   */
  findByFilters(modelName, filters, options) {
    const accessor = this.getAccessor(modelName);
    // Default implementation is using `findAll()`.
    if (typeof accessor.findByFilters !== 'function') {
      return this.findAll(modelName, options).then((res) => {
        return applyFilter(res, { where: filters });
      });
    }
    // Expect a promise with an array of 0 to many `[id, data]`.
    return accessor.findByFilters(filters, options).map((res) => {
      return this.fromDb(modelName, res[0], res[1]);
    });
  }

  /**
   * Convert data from model to DB format.
   *
   * Hook: `forDb()` can be implemented by the provided accessor class.
   */
  forDb(modelName, data) {
    const accessor = this.getAccessor(modelName);
    const idName = this.idName(modelName);
    // Make sure the id is not included in data.
    data = Object.assign({}, data);
    if (data[idName] != null) {
      delete data[idName];
    }
    // Expect data.
    if (typeof accessor.forDb === 'function') {
      return accessor.forDb(data);
    }
    return data;
  }

  /**
   * Convert data from DB format to model.
   *
   * Hook: `fromDb()` can be implemented by the provided accessor class.
   */
  fromDb(modelName, id, data) {
    const accessor = this.getAccessor(modelName);
    const idName = this.idName(modelName);
    // Make sure the id is included in data.
    data[idName] = id;
    // Expect data.
    if (typeof accessor.fromDb === 'function') {
      return accessor.fromDb(data);
    }
    return data;
  }

}

// Export initializer.
NoSQL.initializer = require('./initializer');

// Export Accessor.
NoSQL.Accessor = require('./accessor');

module.exports = NoSQL;
