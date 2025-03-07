import {
    filterInMemoryFields,
    massageSelector
} from 'pouchdb-selector-core';
import { newRxError } from '../../rx-error';

import {
    pouchHash,
    pouchSwapPrimaryToId,
    POUCH_HASH_KEY,
    primarySwapPouchDbQuerySelector
} from './pouchdb-helper';
import type { DeterministicSortComparator, QueryMatcher } from 'event-reduce-js';
import { getSchemaByObjectPath } from '../../rx-schema-helper';
import type {
    MangoQuery,
    MangoQuerySortDirection,
    MangoQuerySortPart,
    PreparedQuery,
    RxDocumentWriteData,
    RxJsonSchema,
    RxStorageStatics
} from '../../types';
import { getPrimaryFieldOfPrimaryKey } from '../../rx-schema';

export const RxStoragePouchStatics: RxStorageStatics = {

    /**
     * create the same diggest as an attachment with that data
     * would have created by pouchdb internally.
     */
    hash(data: Buffer | Blob | string): Promise<string> {
        return pouchHash(data);
    },
    hashKey: POUCH_HASH_KEY,

    getSortComparator<RxDocType>(
        schema: RxJsonSchema<RxDocType>,
        query: MangoQuery<RxDocType>
    ): DeterministicSortComparator<RxDocType> {
        const primaryPath = getPrimaryFieldOfPrimaryKey(schema.primaryKey);
        const sortOptions: MangoQuerySortPart[] = query.sort ? (query.sort as any) : [{
            [primaryPath]: 'asc'
        }];
        const inMemoryFields = Object
            .keys(query.selector)
            .filter(key => !key.startsWith('$'));

        const fun: DeterministicSortComparator<RxDocType> = (a: RxDocType, b: RxDocType) => {
            /**
             * Sorting on two documents with the same primary is not allowed
             * because it might end up in a non-deterministic result.
             */
            if (a[primaryPath] === b[primaryPath]) {
                throw newRxError('SNH', { args: { a, b }, primaryPath: primaryPath as any });
            }

            // TODO use createFieldSorter
            // TODO make a performance test
            const rows = [a, b].map(doc => ({
                doc: pouchSwapPrimaryToId<RxDocType>(primaryPath, doc)
            }));
            const sortedRows: { doc: any }[] = filterInMemoryFields(
                rows,
                {
                    selector: {},
                    sort: sortOptions
                },
                inMemoryFields
            );
            if (sortedRows.length !== 2) {
                throw newRxError('SNH', {
                    query,
                    primaryPath: primaryPath as any,
                    args: {
                        rows,
                        sortedRows
                    }
                });
            }
            if (sortedRows[0].doc._id === rows[0].doc._id) {
                return -1;
            } else {
                return 1;
            }
        };
        return fun;
    },

    /**
     * @link https://github.com/pouchdb/pouchdb/blob/master/packages/node_modules/pouchdb-selector-core/src/matches-selector.js
     */
    getQueryMatcher<RxDocType>(
        schema: RxJsonSchema<RxDocType>,
        query: MangoQuery<RxDocType>
    ): QueryMatcher<RxDocumentWriteData<RxDocType>> {
        const primaryPath = getPrimaryFieldOfPrimaryKey(schema.primaryKey);
        const massagedSelector = massageSelector(query.selector);

        const fun: QueryMatcher<RxDocumentWriteData<RxDocType>> = (doc: RxDocType) => {
            const cloned = pouchSwapPrimaryToId(primaryPath, doc);
            const row = {
                doc: cloned
            };
            const rowsMatched = filterInMemoryFields(
                [row],
                { selector: massagedSelector },
                Object.keys(query.selector)
            );
            const ret = rowsMatched && rowsMatched.length === 1;
            return ret;
        };
        return fun;
    },


    /**
     * pouchdb has many bugs and strange behaviors
     * this functions takes a normal mango query
     * and transforms it to one that fits for pouchdb
     */
    prepareQuery<RxDocType>(
        schema: RxJsonSchema<RxDocType>,
        mutateableQuery: MangoQuery<RxDocType>
    ): PreparedQuery<RxDocType> {
        const primaryKey = getPrimaryFieldOfPrimaryKey(schema.primaryKey);
        const query = mutateableQuery;

        /**
         * because sort wont work on unused keys we have to workaround
         * so we add the key to the selector if necessary
         * @link https://github.com/nolanlawson/pouchdb-find/issues/204
         */
        if (query.sort) {
            query.sort.forEach(sortPart => {
                const key = Object.keys(sortPart)[0];
                const comparisonOperators = ['$gt', '$gte', '$lt', '$lte'];
                const keyUsed = query.selector[key] && Object.keys(query.selector[key]).some(op => comparisonOperators.includes(op)) || false;
                if (!keyUsed) {
                    const schemaObj = getSchemaByObjectPath(schema, key);
                    if (!schemaObj) {
                        throw newRxError('QU5', {
                            query,
                            key,
                            schema
                        });
                    }
                    if (!query.selector[key]) {
                        query.selector[key] = {};
                    }
                    switch (schemaObj.type) {
                        case 'number':
                        case 'integer':
                            // TODO change back to -Infinity when issue resolved
                            // @link https://github.com/pouchdb/pouchdb/issues/6454
                            // -Infinity does not work since pouchdb 6.2.0
                            query.selector[key].$gt = -9999999999999999999999999999;
                            break;
                        case 'string':
                            /**
                             * strings need an empty string, see
                             * @link https://github.com/pubkey/rxdb/issues/585
                             */
                            if (typeof query.selector[key] !== 'string') {
                                query.selector[key].$gt = '';
                            }
                            break;
                        default:
                            query.selector[key].$gt = null;
                            break;
                    }
                }
            });
        }

        // regex does not work over the primary key
        // TODO move this to dev mode
        if (query.selector[primaryKey as any] && query.selector[primaryKey as any].$regex) {
            throw newRxError('QU4', {
                path: primaryKey as any,
                query: mutateableQuery
            });
        }

        // primary-swap sorting
        if (query.sort) {
            const sortArray: MangoQuerySortPart<RxDocType>[] = query.sort.map(part => {
                const key = Object.keys(part)[0];
                const direction: MangoQuerySortDirection = Object.values(part)[0];
                const useKey = key === primaryKey ? '_id' : key;
                const newPart = { [useKey]: direction };
                return newPart as any;
            });
            query.sort = sortArray;
        }

        // strip empty selectors
        Object.entries(query.selector).forEach(([k, v]) => {
            if (
                typeof v === 'object' &&
                v !== null &&
                !Array.isArray(v) &&
                Object.keys((v as any)).length === 0
            ) {
                delete query.selector[k];
            }
        });

        query.selector = primarySwapPouchDbQuerySelector(query.selector, primaryKey);

        /**
         * To ensure a deterministic sorting,
         * we have to ensure the primary key is always part
         * of the sort query.

        * TODO This should be done but will not work with pouchdb
         * because it will throw
         * 'Cannot sort on field(s) "key" when using the default index'
         * So we likely have to modify the indexes so that this works. 
         */
        /*
        if (!mutateableQuery.sort) {
            mutateableQuery.sort = [{ [this.primaryPath]: 'asc' }] as any;
        } else {
            const isPrimaryInSort = mutateableQuery.sort
                .find(p => firstPropertyNameOfObject(p) === this.primaryPath);
            if (!isPrimaryInSort) {
                mutateableQuery.sort.push({ [this.primaryPath]: 'asc' } as any);
            }
        }
        */

        return query;
    }
};
