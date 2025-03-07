"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RxQueryBase = void 0;
exports._getDefaultQuery = _getDefaultQuery;
exports.createRxQuery = createRxQuery;
exports.isInstanceOf = isInstanceOf;
exports.tunnelQueryCache = tunnelQueryCache;

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _fastDeepEqual = _interopRequireDefault(require("fast-deep-equal"));

var _rxjs = require("rxjs");

var _operators = require("rxjs/operators");

var _util = require("./util");

var _rxError = require("./rx-error");

var _hooks = require("./hooks");

var _rxDocumentPrototypeMerge = require("./rx-document-prototype-merge");

var _eventReduce = require("./event-reduce");

var _queryCache = require("./query-cache");

var _rxCollectionHelper = require("./rx-collection-helper");

var _queryCount = 0;

var newQueryID = function newQueryID() {
  return ++_queryCount;
};

var RxQueryBase = /*#__PURE__*/function () {
  /**
   * Some stats then are used for debugging and cache replacement policies
   */
  // used by some plugins
  // used to count the subscribers to the query
  function RxQueryBase(op, mangoQuery, collection) {
    this.id = newQueryID();
    this._execOverDatabaseCount = 0;
    this._creationTime = (0, _util.now)();
    this._lastEnsureEqual = 0;
    this.other = {};
    this.uncached = false;
    this.refCount$ = new _rxjs.BehaviorSubject(null);
    this._latestChangeEvent = -1;
    this._resultsData = null;
    this._resultsDataMap = new Map();
    this._lastExecStart = 0;
    this._lastExecEnd = 0;
    this._resultsDocs$ = new _rxjs.BehaviorSubject(null);
    this._ensureEqualQueue = _util.PROMISE_RESOLVE_FALSE;
    this.op = op;
    this.mangoQuery = mangoQuery;
    this.collection = collection;

    if (!mangoQuery) {
      mangoQuery = _getDefaultQuery();
    }
  }

  var _proto = RxQueryBase.prototype;

  /**
   * set the new result-data as result-docs of the query
   * @param newResultData json-docs that were received from pouchdb
   */
  _proto._setResultData = function _setResultData(newResultData) {
    var _this = this;

    var docs = (0, _rxDocumentPrototypeMerge.createRxDocuments)(this.collection, newResultData);
    /**
     * Instead of using the newResultData in the result cache,
     * we directly use the objects that are stored in the RxDocument
     * to ensure we do not store the same data twice and fill up the memory.
     */

    var primPath = this.collection.schema.primaryPath;
    this._resultsDataMap = new Map();
    this._resultsData = docs.map(function (doc) {
      var docData = doc._dataSync$.getValue();

      var id = docData[primPath];

      _this._resultsDataMap.set(id, docData);

      return docData;
    });

    this._resultsDocs$.next(docs);

    return docs;
  }
  /**
   * executes the query on the database
   * @return results-array with document-data
   */
  ;

  _proto._execOverDatabase = function _execOverDatabase() {
    var _this2 = this;

    this._execOverDatabaseCount = this._execOverDatabaseCount + 1;
    this._lastExecStart = (0, _util.now)();
    var docsPromise;

    switch (this.op) {
      case 'find':
        docsPromise = this.collection._queryStorageInstance(this);
        break;

      case 'findOne':
        docsPromise = this.collection._queryStorageInstance(this, 1);
        break;

      default:
        throw (0, _rxError.newRxError)('QU1', {
          collection: this.collection.name,
          op: this.op
        });
    }

    return docsPromise.then(function (docs) {
      _this2._lastExecEnd = (0, _util.now)();
      return docs;
    });
  }
  /**
   * Execute the query
   * To have an easier implementations,
   * just subscribe and use the first result
   */
  ;

  _proto.exec = function exec(throwIfMissing) {
    var _this3 = this;

    // TODO this should be ensured by typescript
    if (throwIfMissing && this.op !== 'findOne') {
      throw (0, _rxError.newRxError)('QU9', {
        collection: this.collection.name,
        query: this.mangoQuery,
        op: this.op
      });
    }
    /**
     * run _ensureEqual() here,
     * this will make sure that errors in the query which throw inside of pouchdb,
     * will be thrown at this execution context
     */


    return _ensureEqual(this).then(function () {
      return (0, _rxjs.firstValueFrom)(_this3.$);
    }).then(function (result) {
      if (!result && throwIfMissing) {
        throw (0, _rxError.newRxError)('QU10', {
          collection: _this3.collection.name,
          query: _this3.mangoQuery,
          op: _this3.op
        });
      } else {
        return result;
      }
    });
  }
  /**
   * cached call to get the queryMatcher
   * @overwrites itself with the actual value
   */
  ;

  /**
   * returns a string that is used for equal-comparisons
   * @overwrites itself with the actual value
   */
  _proto.toString = function toString() {
    var stringObj = (0, _util.sortObject)({
      op: this.op,
      query: this.mangoQuery,
      other: this.other
    }, true);
    var value = JSON.stringify(stringObj, _util.stringifyFilter);

    this.toString = function () {
      return value;
    };

    return value;
  }
  /**
   * returns the prepared query
   * which can be send to the storage instance to query for documents.
   * @overwrites itself with the actual value.
   */
  ;

  _proto.getPreparedQuery = function getPreparedQuery() {
    var hookInput = {
      rxQuery: this,
      // can be mutated by the hooks so we have to deep clone first.
      mangoQuery: (0, _util.clone)(this.mangoQuery)
    };
    (0, _hooks.runPluginHooks)('prePrepareQuery', hookInput);
    var value = this.collection.database.storage.statics.prepareQuery(this.collection.storageInstance.schema, hookInput.mangoQuery);

    this.getPreparedQuery = function () {
      return value;
    };

    return value;
  }
  /**
   * returns true if the document matches the query,
   * does not use the 'skip' and 'limit'
   * // TODO this was moved to rx-storage
   */
  ;

  _proto.doesDocumentDataMatch = function doesDocumentDataMatch(docData) {
    // if doc is deleted, it cannot match
    if (docData._deleted) {
      return false;
    }

    return this.queryMatcher((0, _rxCollectionHelper._handleToStorageInstance)(this.collection, docData));
  }
  /**
   * deletes all found documents
   * @return promise with deleted documents
   */
  ;

  _proto.remove = function remove() {
    var ret;
    return this.exec().then(function (docs) {
      ret = docs;

      if (Array.isArray(docs)) {
        return Promise.all(docs.map(function (doc) {
          return doc.remove();
        }));
      } else {
        return docs.remove();
      }
    }).then(function () {
      return ret;
    });
  }
  /**
   * helper function to transform RxQueryBase to RxQuery type
   */
  ;

  /**
   * updates all found documents
   * @overwritten by plugin (optional)
   */
  _proto.update = function update(_updateObj) {
    throw (0, _util.pluginMissing)('update');
  } // we only set some methods of query-builder here
  // because the others depend on these ones
  ;

  _proto.where = function where(_queryObj) {
    throw (0, _util.pluginMissing)('query-builder');
  };

  _proto.sort = function sort(_params) {
    throw (0, _util.pluginMissing)('query-builder');
  };

  _proto.skip = function skip(_amount) {
    throw (0, _util.pluginMissing)('query-builder');
  };

  _proto.limit = function limit(_amount) {
    throw (0, _util.pluginMissing)('query-builder');
  };

  (0, _createClass2["default"])(RxQueryBase, [{
    key: "$",
    get: function get() {
      var _this4 = this;

      if (!this._$) {
        /**
         * We use _resultsDocs$ to emit new results
         * This also ensures that there is a reemit on subscribe
         */
        var results$ = this._resultsDocs$.pipe((0, _operators.mergeMap)(function (docs) {
          return _ensureEqual(_this4).then(function (hasChanged) {
            if (hasChanged) {
              // wait for next emit
              return false;
            } else {
              return docs;
            }
          });
        }), // not if previous returned false
        (0, _operators.filter)(function (docs) {
          return !!docs;
        }), // copy the array so it wont matter if the user modifies it
        (0, _operators.map)(function (docs) {
          return docs.slice(0);
        }), (0, _operators.map)(function (docs) {
          if (_this4.op === 'findOne') {
            // findOne()-queries emit document or null
            var doc = docs.length === 0 ? null : docs[0];
            return doc;
          } else {
            // find()-queries emit RxDocument[]
            return docs;
          }
        }), (0, _operators.shareReplay)(_util.RXJS_SHARE_REPLAY_DEFAULTS)).asObservable();
        /**
         * subscribe to the changeEvent-stream so it detects changes if it has subscribers
         */


        var changeEvents$ = this.collection.$.pipe((0, _operators.tap)(function () {
          return _ensureEqual(_this4);
        }), (0, _operators.filter)(function () {
          return false;
        }));
        this._$ = // tslint:disable-next-line
        (0, _rxjs.merge)(results$, changeEvents$, this.refCount$.pipe((0, _operators.filter)(function () {
          return false;
        })));
      }

      return this._$;
    } // stores the changeEvent-number of the last handled change-event

  }, {
    key: "queryMatcher",
    get: function get() {
      return (0, _util.overwriteGetterForCaching)(this, 'queryMatcher', this.collection.database.storage.statics.getQueryMatcher(this.collection.storageInstance.schema, this.getPreparedQuery()));
    }
  }, {
    key: "asRxQuery",
    get: function get() {
      return this;
    }
  }]);
  return RxQueryBase;
}();

exports.RxQueryBase = RxQueryBase;

function _getDefaultQuery() {
  return {
    selector: {}
  };
}
/**
 * run this query through the QueryCache
 */


function tunnelQueryCache(rxQuery) {
  return rxQuery.collection._queryCache.getByQuery(rxQuery);
}

function createRxQuery(op, queryObj, collection) {
  // checks
  if (queryObj && typeof queryObj !== 'object') {
    throw (0, _rxError.newRxTypeError)('QU7', {
      queryObj: queryObj
    });
  }

  if (Array.isArray(queryObj)) {
    throw (0, _rxError.newRxTypeError)('QU8', {
      queryObj: queryObj
    });
  }

  (0, _hooks.runPluginHooks)('preCreateRxQuery', {
    op: op,
    queryObj: queryObj,
    collection: collection
  });
  var ret = new RxQueryBase(op, queryObj, collection); // ensure when created with same params, only one is created

  ret = tunnelQueryCache(ret);
  (0, _hooks.runPluginHooks)('createRxQuery', ret);
  (0, _queryCache.triggerCacheReplacement)(collection);
  return ret;
}
/**
 * Check if the current results-state is in sync with the database
 * which means that no write event happened since the last run.
 * @return false if not which means it should re-execute
 */


function _isResultsInSync(rxQuery) {
  var currentLatestEventNumber = rxQuery.asRxQuery.collection._changeEventBuffer.counter;

  if (rxQuery._latestChangeEvent >= currentLatestEventNumber) {
    return true;
  } else {
    return false;
  }
}
/**
 * wraps __ensureEqual()
 * to ensure it does not run in parallel
 * @return true if has changed, false if not
 */


function _ensureEqual(rxQuery) {
  // Optimisation shortcut
  if (rxQuery.collection.database.destroyed || _isResultsInSync(rxQuery)) {
    return _util.PROMISE_RESOLVE_FALSE;
  }

  rxQuery._ensureEqualQueue = rxQuery._ensureEqualQueue.then(function () {
    return __ensureEqual(rxQuery);
  });
  return rxQuery._ensureEqualQueue;
}
/**
 * ensures that the results of this query is equal to the results which a query over the database would give
 * @return true if results have changed
 */


function __ensureEqual(rxQuery) {
  rxQuery._lastEnsureEqual = (0, _util.now)();
  /**
   * Optimisation shortcuts
   */

  if ( // db is closed
  rxQuery.collection.database.destroyed || // nothing happend since last run
  _isResultsInSync(rxQuery)) {
    return _util.PROMISE_RESOLVE_FALSE;
  }

  var ret = false;
  var mustReExec = false; // if this becomes true, a whole execution over the database is made

  if (rxQuery._latestChangeEvent === -1) {
    // have not executed yet -> must run
    mustReExec = true;
  }
  /**
   * try to use the queryChangeDetector to calculate the new results
   */


  if (!mustReExec) {
    var missedChangeEvents = rxQuery.asRxQuery.collection._changeEventBuffer.getFrom(rxQuery._latestChangeEvent + 1);

    if (missedChangeEvents === null) {
      // changeEventBuffer is of bounds -> we must re-execute over the database
      mustReExec = true;
    } else {
      rxQuery._latestChangeEvent = rxQuery.asRxQuery.collection._changeEventBuffer.counter;

      var runChangeEvents = rxQuery.asRxQuery.collection._changeEventBuffer.reduceByLastOfDoc(missedChangeEvents);

      var eventReduceResult = (0, _eventReduce.calculateNewResults)(rxQuery, runChangeEvents);

      if (eventReduceResult.runFullQueryAgain) {
        // could not calculate the new results, execute must be done
        mustReExec = true;
      } else if (eventReduceResult.changed) {
        // we got the new results, we do not have to re-execute, mustReExec stays false
        ret = true; // true because results changed

        rxQuery._setResultData(eventReduceResult.newResults);
      }
    }
  } // oh no we have to re-execute the whole query over the database


  if (mustReExec) {
    // counter can change while _execOverDatabase() is running so we save it here
    var latestAfter = rxQuery.collection._changeEventBuffer.counter;
    return rxQuery._execOverDatabase().then(function (newResultData) {
      rxQuery._latestChangeEvent = latestAfter;

      if (!(0, _fastDeepEqual["default"])(newResultData, rxQuery._resultsData)) {
        ret = true; // true because results changed

        rxQuery._setResultData(newResultData);
      }

      return ret;
    });
  }

  return ret; // true if results have changed
}

function isInstanceOf(obj) {
  return obj instanceof RxQueryBase;
}
//# sourceMappingURL=rx-query.js.map