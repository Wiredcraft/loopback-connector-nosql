'use strict';

/*!
 * Module dependencies
 */
// const debug = require('debug')('loopback:connector:ioredis');

const httpError = require('http-errors');
const Promise = require('bluebird');
const moment = require('moment');

var Redis = require('ioredis');

const NoSQL = require('../');
const Accessor = NoSQL.Accessor;

/**
 * Implement NoSQL connector.
 */
class IORedis extends NoSQL {

  /**
   * To satisfy the tests from `loopback-datasource-juggler`.
   */
  getDefaultIdType(prop) {
    return Number;
  }

  /**
   * Connect to IORedis
   */
  _connect(settings, database) {
    const redis = new Redis(Object.assign({}, settings, {
      lazyConnect: true
    }));
    return Promise.resolve(redis.connect()).return(redis);
  }

  /**
   * Disconnect from IORedis
   */
  _disconnect(redis) {
    return redis.disconnect();
  }

}

/**
 * Implement Accessor.
 */
class IORedisAccessor extends Accessor {

  /**
   * Save data to DB with a given id.
   *
   * Result is a promise with `[id, rev]` or an error.
   */
  saveWithId(id, data, options) {
    const key = this.modelName + ':' + id;
    return this.connection.call('hmset', [key, data]).return([id, null]);
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
    const key = this.modelName + ':' + id;
    return this.connection.call('del', key, options);
  }

  /**
   * Find data from DB by id.
   *
   * Result is a promise with the data or an error.
   */
  findById(id, options) {
    const key = this.modelName + ':' + id;
    return this.exists(id).then((exists) => {
      if (!exists) {
        return Promise.reject(httpError(404));
      }
      return this.connection.call('hgetall', key);
    });
  }

  /**
   * Find data from DB by multiple ids.
   *
   * Result is a promise with an array of 0 to many `[id, data]`.
   */
  findAll(options) {
    return this.connection.call('keys', this.modelName + ':*').map((key) => {
      const id = key.split(':')[1];
      return this.findById(id, options).then((data) => {
        return [id, data];
      }).catchReturn(false);
    }).filter(Boolean);
  }

  /**
   * Helper.
   */
  exists(id) {
    return this.connection.call('exists', this.modelName + ':' + id).then(Boolean);
  }

  /**
   * Convert data from model to DB format.
   */
  forDb(data) {
    for (let i in data) {
      if (data[i] == null) {
        data[i] = '';
        continue;
      }
      let prop = this.properties[i];
      if (prop == null) {
        data[i] = JSON.stringify(data[i]);
        continue;
      }
      switch (prop.type.name) {
        case 'Date':
          data[i] = moment(data[i]).toJSON();
          break;
        case 'Number':
          data[i] = data[i] && data[i].toString();
          break;
        case 'Boolean':
          data[i] = data[i] ? 'true' : 'false';
          break;
        case 'String':
        case 'Text':
          break;
        default:
          data[i] = JSON.stringify(data[i]);
      }
    }
    return data;
  }

  /**
   * Convert data from DB format to model.
   */
  fromDb(data) {
    for (let i in data) {
      if (data[i] == null || data[i] === '') {
        data[i] = null;
        continue;
      }
      let prop = this.properties[i];
      if (prop == null) {
        continue;
      }
      switch (prop.type.name) {
        case 'Date':
          data[i] = moment(data[i]).toDate();
          break;
        case 'Number':
          data[i] = Number(data[i]);
          break;
        case 'Boolean':
          data[i] = data[i] === 'true' || data[i] === '1';
          break;
        case 'String':
        case 'Text':
          break;
        default:
          let d = data[i];
          try {
            data[i] = JSON.parse(data[i]);
          } catch (e) {
            data[i] = d;
          }
      }
    }
    return data;
  }

}

// Export initializer.
exports.initialize = NoSQL.initializer('ioredis', IORedis, IORedisAccessor);
