# Custom Build

By default, if you import RxDB into your javascript, a full batteries-included build will be imported. This has the advantage that you don't have to choose which things you need and which not. The disadvantage is the build-size. Often you don't need most of the functionality and you could save a lot of bandwidth by cherry-picking only the things you really need. For this, RxDB supports custom builds.

## Core

The core-module is the part of RxDB which is always needed to provide basic functionality. If you need a custom build, you start with the core and then add all modules that you need.

```javascript
import {
    createRxDatabase,
    addRxPlugin
    /* ... */
} from 'rxdb/plugins/core';
```


## PouchDB storage

To call `createRxDatabase` you have to specify the storage engine which is used to store documents and run queries.
The pouchdb plugin contains everything needed to use [PouchDB](https://github.com/pouchdb/pouchdb) as underlaying storage engine. PouchDB itself works on so called `adapter` that determine where the data is stored.

```javascript
import { 
    addPouchPlugin,
    getRxStoragePouch,
    checkAdapter
} from 'rxdb/plugins/pouchdb';
addRxPlugin(RxDBAdapterCheckPlugin);

// Add pouchdb specific plugins (non RxDB plugins)
// Here we add the idb adapter that stores data inside of IndexedDB.
addPouchPlugin(require('pouchdb-adapter-idb'));

// with that you can create a database with the pouchdb storage engine
const db = await createRxDatabase({
    name: 'heroesdb',
    // use pouchdb with the indexeddb-adapter as storage engine.
    storage: getRxStoragePouch('idb'),
    password: 'myLongAndStupidPassword'
});

// In the pouchdb plugin also there is the method to check if a given pouchdb-adapter works
await checkAdapter('leveldb'); // > boolean
```

## LokiJS storage

Another storage implementation that uses [LokiJS](https://github.com/techfort/LokiJS) to handle the data. [See here for more information about the LokiJS storage.](./rx-storage-lokijs.md).

## Worker storage

A wrapper that can be used to move the Storage inside of a WebWorker (in browsers) or a Worker Thread (in node.js). [See here for more information about the Worker storage.](./rx-storage-worker.md).

## required modules

Some parts of RxDB are not in the core, but are required. This means they must always be overwrite by at least one plugin.

### validate

The validation-module does the schema-validation when you insert or update a `RxDocument`. When no validation plugin is used, any document data can be safed but there might be undefined behavior when saving data that does not comply to the schema.
In dev-mode you should always use a validation plugin. In production you might not use a schema validation to save performance and reduce the bundle size.

This one is using [is-my-json-valid](https://www.npmjs.com/package/is-my-json-valid) but you can also use your own validator instead. To import the default validation-module, do this:

```javascript
import { RxDBValidatePlugin } from 'rxdb/plugins/validate';
addRxPlugin(RxDBValidatePlugin);
```

### ajv-validate

Another validation-module that does the schema-validation. This one is using [ajv](https://github.com/epoberezkin/ajv) as validator which is a bit faster. Better compliant to the jsonschema-standart but also has a bigger build-size.

```javascript
import { RxDBAjvValidatePlugin } from 'rxdb/plugins/ajv-validate';
addRxPlugin(RxDBAjvValidatePlugin);
```

### validate-z-schema

Both `is-my-json-valid` and `ajv-validate` use `eval()` to perform validation which might not be wanted when `'unsafe-eval'` is not allowed in Content Security Policies. This one is using [z-schema](https://github.com/zaggino/z-schema) as validator which doesn't use `eval`.

```javascript
import { RxDBValidateZSchemaPlugin } from 'rxdb/plugins/validate-z-schema';
addRxPlugin(RxDBValidateZSchemaPlugin);
```

## optional modules

Some modules are optional and only needed if you use their functionality.

### dev-mode

This plugin add many additional check and validations to RxDB and also the extendes error messages.
These checks increase your build size and decrease the performance.
Therefore this plugin should **always** be used in development but **never** in production.


```javascript
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
addRxPlugin(RxDBDevModePlugin);
```

### query-builder

Adds the [query-builder](./rx-query.md)-functionality to RxDB which allows you to run queries like `myCollection.find().where('x').eq(5)`

```javascript
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
addRxPlugin(RxDBQueryBuilderPlugin);
```

### migration

Adds the [data-migration](./data-migration.md)-functionality to RxDB which allows you to migrate documents when the schema changes.

```javascript
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration';
addRxPlugin(RxDBMigrationPlugin);
```

### replication-couchdb

Adds the [CouchDB replication](./replication-couchdb.md)-functionality to RxDB which allows you to replicate the database with a CouchDB compliant endpoint.

```javascript
import { RxDBReplicationCouchDBPlugin } from 'rxdb/plugins/replication-couchdb';
addRxPlugin(RxDBReplicationCouchDBPlugin);
```

### replication-graphql
Allows you to do a replication with a GraphQL endpoint.

See: [Replication with GraphQL](./replication-graphql.md)

```js
import { RxDBReplicationGraphQLPlugin } from 'rxdb/plugins/replication-graphql';
addRxPlugin(RxDBReplicationGraphQLPlugin);
```

### replication
Contains replication primitives to build a custom replication.

See: [Replication Primitives](./replication.md)

```js
import { replicateRxCollection } from 'rxdb/plugins/replication';

const replicationState = await replicateRxCollection({
    collection: myRxCollection,
    /* ... */
});

```


### attachments

Adds the [attachments](./rx-attachment.md)-functionality to RxDB.

```javascript
import { RxDBAttachmentsPlugin } from 'rxdb/plugins/attachments';
addRxPlugin(RxDBAttachmentsPlugin);
```

### in-memory

Adds the [in-memory-replication](./in-memory.md) to the collections.

```javascript
import { RxDBInMemoryPlugin } from 'rxdb/plugins/in-memory';
addRxPlugin(RxDBInMemoryPlugin);
```

### local-documents

Adds the [local-documents](./rx-local-document.md) to the collections and databases.

```javascript
import { RxDBLocalDocumentsPlugin } from 'rxdb/plugins/local-documents';
addRxPlugin(RxDBLocalDocumentsPlugin);
```

### json-dump

Adds the [json import/export](./rx-database.md#dump)-functionality to RxDB.

```javascript
import { RxDBJsonDumpPlugin } from 'rxdb/plugins/json-dump';
addRxPlugin(RxDBJsonDumpPlugin);
```

### backup

Adds the [filesystem backup](./backup.md)-functionality to RxDB.

```javascript
import { RxDBBackupPlugin } from 'rxdb/plugins/backup';
addRxPlugin(RxDBBackupPlugin);
```

### key-compression

The keycompressor-module is needed when you have keyCompression enabled. This is done by default so make sure that you set [disableKeyCompression](./rx-schema.md#disablekeycompression) to `true` when you do not have this module.

```javascript
import { RxDBKeyCompressionPlugin } from 'rxdb/plugins/key-compression';
addRxPlugin(RxDBKeyCompressionPlugin);
```

### leader-election

The leaderelection-module is needed when want to use the leaderelection.

```javascript
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
addRxPlugin(RxDBLeaderElectionPlugin);
```

### encryption

The encryption-module is using `crypto-js` and is only needed when you create your RxDB-Database with a [password](./rx-database.md#password-optional).

```javascript
import { RxDBEncryptionPlugin } from 'rxdb/plugins/encryption';
addRxPlugin(RxDBEncryptionPlugin);
```

### update

The update-module is only required when you use [RxDocument.update](./rx-document.md#update) or [RxQuery.update](./rx-query.md#update).

```javascript
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
addRxPlugin(RxDBUpdatePlugin);
```

### server
Spawns a couchdb-compatible server from a RxDatabase. Use this to replicate data from your electron-node to the browser-window. Or to fast setup a dev-environment.

See: [Tutorial: Using the RxDB Server-Plugin](./tutorials/server.md)

**Do never** expose this server to the internet, use a couchdb-instance at production.

```js
// run 'npm install express-pouchdb' before you use this plugin

// This plugin is not included into the default RxDB-build. You have to manually add it.
import { RxDBServerPlugin } from 'rxdb/plugins/server';
addRxPlugin(RxDBServerPlugin);
```



## Third Party Plugins

* [rxdb-utils](https://github.com/rafamel/rxdb-utils) Additional features for RxDB like models, timestamps, default values, view and more.
* [rxdb-hooks](https://github.com/cvara/rxdb-hooks) A set of hooks to integrate RxDB into react applications. 


--------------------------------------------------------------------------------

If you are new to RxDB, you should continue [here](./plugins.md)
