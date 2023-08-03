(class FormulaPro {

    getFilterKey(jaql) {
        return `${jaql.dim} | ${jaql.level}`
    }

    getActiveFilterMap(query) {
        const filterValueMap = new Map();
        query.query.metadata.filter(metadata => metadata.panel === 'scope' && !metadata.jaql.filter.hasOwnProperty('by')).forEach(metadata => {
            filterValueMap.set(this.getFilterKey(metadata.jaql), metadata.jaql);
        });
        return filterValueMap;
    }

    getDashboardFilterMap() {
        const filterValueMap = new Map();
        prism.activeDashboard.filters.$$items.forEach(metadata => {
            if (metadata.hasOwnProperty('levels')) {
                metadata.levels.forEach(jaql => {
                    filterValueMap.set(this.getFilterKey(jaql), jaql);
                });
            } else {
                filterValueMap.set(this.getFilterKey(metadata.jaql), metadata.jaql);
            }
        });
        return filterValueMap;
    }

    initialize () {
        dashboard.on('widgetbeforequery',(widget, query) => {
            const activeFilterMap = this.getActiveFilterMap(query);
            const dashboardFilterMap = this.getDashboardFilterMap();
            query.query.metadata.filter(metadata => metadata.wpanel === 'series' || (metadata.jaql && metadata.jaql.type === 'measure')).forEach(metadata => {
                for (let [contextKey, context] of Object.entries(metadata.jaql.context)) {
                    if (!(contextKey.startsWith('[') && !contextKey.endsWith('['))) {
                        continue;
                    }
                    if (context.title.startsWith('@')) {
                        const funcName = '__' + context.title.split('@')[1].split('(')[0];
                        if (typeof this[funcName] === 'function') {
                            this[funcName](activeFilterMap, dashboardFilterMap, context);
                        }
                    }
                }
            });


            query.query.metadata.filter(metadata => metadata.panel === 'scope' && metadata.jaql.filter.hasOwnProperty('by')).forEach(metadata => {
                for (let [contextKey, context] of Object.entries(metadata.jaql.filter.by.context)) {
                    if (!(contextKey.startsWith('[') && !contextKey.endsWith('['))){
                        continue;
                    }

                    if (context.title.startsWith('@')) {
                        const funcName = '__' + context.title.split('@')[1].split('(')[0];
                        if (typeof this[funcName] === 'function') {
                            this[funcName](activeFilterMap, dashboardFilterMap, context);
                        }
                    }

                }
            });

        });
    }

    calculateDateTimeRange(dt, func_level, filter_level) {
        const startDatetime = new Date(dt + 'Z');
        const endDatetime = new Date(dt + 'Z');

        startDatetime.setUTCHours(0, 0, 0, 0);
        endDatetime.setUTCHours(23, 59, 59, 999);

        if (func_level === 'years') {
            startDatetime.setUTCMonth(0, 1);
        } else if (func_level === 'quarters') {
            const quarterMonth = Math.floor(startDatetime.getUTCMonth() / 3) * 3;
            startDatetime.setUTCMonth(quarterMonth, 1);
        } else if (func_level === 'months') {
            startDatetime.setUTCDate(1);
        }

        if (filter_level === 'years') {
            endDatetime.setUTCMonth(11, 31);
            endDatetime.setUTCHours(23, 59, 59, 999);
        } else if (filter_level === 'quarters') {
            const quarterMonth = Math.floor(endDatetime.getUTCMonth() / 3) * 3 + 2;
            endDatetime.setUTCMonth(quarterMonth + 1, 0);
            endDatetime.setUTCHours(23, 59, 59, 999);
        } else if (filter_level === 'months') {
            endDatetime.setUTCMonth(endDatetime.getUTCMonth() + 1, 0);
            endDatetime.setUTCHours(23, 59, 59, 999);
        } else if (filter_level === 'days') {
            endDatetime.setUTCHours(23, 59, 59, 999);
        }

        return {
            start_datetime: startDatetime.toISOString().slice(0, 19).replace('T', ' '),
            end_datetime: endDatetime.toISOString().slice(0, 19).replace('T', ' ')
        };
    }

    getMostDetailedDateFilter(filterValueMap, context) {
        for (let dateLevel of ['days', 'months', 'quarters', 'years']) {
            const filterKey = `${context.dim} | ${dateLevel}`
            if (filterValueMap.has(filterKey) && filterValueMap.get(filterKey).filter.hasOwnProperty('members')) {
                return filterValueMap.get(filterKey);
            }
        }
        return null;
    }

    XTD(activeFilterMap, dashboardFilterMap, context, funcDTLevel) {
        if (context.datatype !== 'datetime') {
            return;
        }

        const srcFilterItem = this.getMostDetailedDateFilter(activeFilterMap, context) || this.getMostDetailedDateFilter(dashboardFilterMap, context);
        if (srcFilterItem && srcFilterItem.filter.members.length === 1) {
            const dateRange = this.calculateDateTimeRange(srcFilterItem.filter.members[0], funcDTLevel, srcFilterItem.level);
            context.level = 'days';
            context.filter = {
                from: dateRange.start_datetime,
                to: dateRange.end_datetime,
            }
        }
    }

    __YTD(activeFilterMap, dashboardFilterMap, context) {
        this.XTD(activeFilterMap, dashboardFilterMap, context, 'years');
    }

    __QTD(activeFilterMap, dashboardFilterMap, context) {
        this.XTD(activeFilterMap, dashboardFilterMap, context, 'quarters');
    }

    __MTD(activeFilterMap, dashboardFilterMap, context) {
        this.XTD(activeFilterMap, dashboardFilterMap, context, 'months');
    }

})
