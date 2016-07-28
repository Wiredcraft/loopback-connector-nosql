'use strict';

/*!
 * Module dependencies
 */
// const debug = require('debug')('loopback:connector:nosql');

const moment = require('moment');

// These are the attributes required by the Accessor class.
const Joi = require('joi');
const attrsSchema = Joi.object({
  connector: Joi.object().required(),
  modelName: Joi.string().required(),
  idName: Joi.string().required(),
  properties: Joi.object().required(),
  settings: Joi.object().required(),
  connection: Joi.object().required()
});

class Accessor {

  constructor(attrs) {
    Object.assign(this, Joi.attempt(attrs, attrsSchema));
  }

  /**
   * Convert data from model to DB format.
   *
   * Default implementation. Meant to be overridden.
   */
  forDb(data) {
    for (let i in data) {
      let prop = this.properties[i];
      if (prop == null) {
        continue;
      }
      switch (prop.type.name) {
        // Convert Date to a string.
        case 'Date':
          data[i] = moment(data[i]).toJSON();
          break;
      }
    }
    return data;
  }

  /**
   * Convert data from DB format to model.
   *
   * Default implementation. Meant to be overridden.
   */
  fromDb(data) {
    for (let i in data) {
      let prop = this.properties[i];
      if (prop == null) {
        continue;
      }
      switch (prop.type.name) {
        // Convert Date string back.
        case 'Date':
          data[i] = moment(data[i]).toDate();
          break;
      }
    }
    return data;
  }

}

module.exports = Accessor;
