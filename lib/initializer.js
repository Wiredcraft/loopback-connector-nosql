'use strict';

module.exports = initializer;

function initializer(name, Connector, Accessor) {
  /**
   * Initialize the connector against the given data asource
   *
   * @param {DataSource} dataSource The loopback-datasource-juggler dataSource
   * @param {Function} [callback] The callback function
   */
  return function initializeDataSource(dataSource, callback) {
    // Assuming the connector is a child class of `NoSQL`.
    dataSource.connector = new Connector(name, dataSource.settings, Accessor);
    // Though not mentioned, `dataSource.setup()` assumes it's connected when `initialize()` is done.
    dataSource.connector.connect(callback);
  };
}
