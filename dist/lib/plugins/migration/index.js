"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DATA_MIGRATOR_BY_COLLECTION = void 0;
Object.defineProperty(exports, "DataMigrator", {
  enumerable: true,
  get: function get() {
    return _dataMigrator.DataMigrator;
  }
});
exports.RxDBMigrationPlugin = void 0;
Object.defineProperty(exports, "_getOldCollections", {
  enumerable: true,
  get: function get() {
    return _dataMigrator._getOldCollections;
  }
});
Object.defineProperty(exports, "_migrateDocuments", {
  enumerable: true,
  get: function get() {
    return _dataMigrator._migrateDocuments;
  }
});
Object.defineProperty(exports, "deleteOldCollection", {
  enumerable: true,
  get: function get() {
    return _dataMigrator.deleteOldCollection;
  }
});
Object.defineProperty(exports, "getBatchOfOldCollection", {
  enumerable: true,
  get: function get() {
    return _dataMigrator.getBatchOfOldCollection;
  }
});
Object.defineProperty(exports, "migrateDocumentData", {
  enumerable: true,
  get: function get() {
    return _dataMigrator.migrateDocumentData;
  }
});
Object.defineProperty(exports, "migrateOldCollection", {
  enumerable: true,
  get: function get() {
    return _dataMigrator.migrateOldCollection;
  }
});
Object.defineProperty(exports, "migratePromise", {
  enumerable: true,
  get: function get() {
    return _dataMigrator.migratePromise;
  }
});

var _rxjs = require("rxjs");

var _operators = require("rxjs/operators");

var _util = require("../../util");

var _dataMigrator = require("./data-migrator");

var _migrationState = require("./migration-state");

var DATA_MIGRATOR_BY_COLLECTION = new WeakMap();
exports.DATA_MIGRATOR_BY_COLLECTION = DATA_MIGRATOR_BY_COLLECTION;
var RxDBMigrationPlugin = {
  name: 'migration',
  rxdb: true,
  hooks: {
    preDestroyRxDatabase: _migrationState.onDatabaseDestroy
  },
  prototypes: {
    RxDatabase: function RxDatabase(proto) {
      proto.migrationStates = function () {
        return (0, _migrationState.getMigrationStateByDatabase)(this).pipe((0, _operators.switchMap)(function (list) {
          return (0, _rxjs.combineLatest)(list);
        }), (0, _operators.shareReplay)(_util.RXJS_SHARE_REPLAY_DEFAULTS));
      };
    },
    RxCollection: function RxCollection(proto) {
      proto.getDataMigrator = function () {
        if (!DATA_MIGRATOR_BY_COLLECTION.has(this)) {
          DATA_MIGRATOR_BY_COLLECTION.set(this, new _dataMigrator.DataMigrator(this.asRxCollection, this.migrationStrategies));
        }

        return DATA_MIGRATOR_BY_COLLECTION.get(this);
      };

      proto.migrationNeeded = function () {
        if (this.schema.version === 0) {
          return _util.PROMISE_RESOLVE_FALSE;
        }

        return (0, _dataMigrator.mustMigrate)(this.getDataMigrator());
      };
    }
  }
}; // used in tests

exports.RxDBMigrationPlugin = RxDBMigrationPlugin;
//# sourceMappingURL=index.js.map