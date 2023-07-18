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

    initialize() {
        dashboard.on('widgetbeforequery', (widget, query) => {
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

        });
    }

    calculateDateTimeRange(dt, func_level, filter_level, ...offsetParams) {
        const selectedDate = new Date(dt + 'Z');
        const startDatetime = new Date(dt + 'Z');
        const endDatetime = new Date(dt + 'Z');
        const offset = offsetParams.flat();

        startDatetime.setUTCHours(0, 0, 0, 0);
        endDatetime.setUTCHours(23, 59, 59, 999);

        this.calculateDateRangeBeforeOffset(func_level, filter_level, startDatetime, endDatetime);
        if (endDatetime.getTime() !== 0) {
            this.calculateDateRangeAfterOffset(offset, startDatetime, endDatetime, filter_level, func_level, selectedDate);
        }

        console.log('startDatetime: ', startDatetime)
        console.log('endDatetime: ', endDatetime)

        return {
            start_datetime: startDatetime.toISOString().slice(0, 19).replace('T', ' '),
            end_datetime: endDatetime.toISOString().slice(0, 19).replace('T', ' ')
        };
    }

    calculateDateRangeBeforeOffset(func_level, filter_level, startDatetime, endDatetime) {
        // start date only determined by function_level
        if (func_level === 'years') {
            startDatetime.setUTCMonth(0, 1);
        } else if (func_level === 'quarters') {
            const quarterMonth = Math.floor(startDatetime.getUTCMonth() / 3) * 3;
            startDatetime.setUTCMonth(quarterMonth, 1);
        } else if (func_level === 'months') {
            startDatetime.setUTCDate(1);
        }

        // function_level should be larger than or equal to filter_level
        // when rule above is satisfied, end date only determined by filter_level
        if (filter_level === 'years') {
            if (func_level === 'years') {
                endDatetime.setUTCMonth(11, 31);
                endDatetime.setUTCHours(23, 59, 59, 999);
            } else endDatetime.setTime(0);
        } else if (filter_level === 'quarters') {
            if (func_level === 'years' || func_level === 'quarters') {
                const quarterMonth = Math.floor(endDatetime.getUTCMonth() / 3) * 3 + 2;
                endDatetime.setUTCMonth(quarterMonth + 1, 0);
                endDatetime.setUTCHours(23, 59, 59, 999);
            } else endDatetime.setTime(0);
        } else if (filter_level === 'months') {
            endDatetime.setUTCMonth(endDatetime.getUTCMonth() + 1, 0);
            endDatetime.setUTCHours(23, 59, 59, 999);
        } else if (filter_level === 'days') {
            endDatetime.setUTCHours(23, 59, 59, 999);
        }
    }

    calculateDateRangeAfterOffset(offset, startDatetime, endDatetime, filter_level, func_level, selectedDate) {
        // offset_level should be larger than or equal to filter_level
        const offsetLevel = offset[0].trim();
        const offsetValue = parseInt(offset[1].trim());

        console.log('offsetLevel: ', offsetLevel);
        console.log('offsetValue: ', offsetValue);

        if (offsetLevel === 'year') {
            startDatetime.setUTCFullYear(startDatetime.getUTCFullYear() + offsetValue);
            endDatetime.setUTCFullYear(endDatetime.getUTCFullYear() + offsetValue);
        } else if (offsetLevel === 'quarter') {
            if (filter_level === 'quarters' || filter_level === 'months' || filter_level === 'days') {
                endDatetime.setUTCMonth(endDatetime.getUTCMonth() + offsetValue * 3 + 1, 0);
                if (func_level === 'years') {
                    // startDate = dateAfterOffset's year's first day
                    selectedDate.setUTCMonth(selectedDate.getUTCMonth() + offsetValue * 3);
                    startDatetime.setUTCFullYear(selectedDate.getUTCFullYear(), 0, 1);
                } else {
                    startDatetime.setUTCMonth(startDatetime.getUTCMonth() + offsetValue * 3);
                }
            }
        } else if (offsetLevel === 'month') {
            if (filter_level === 'months' || filter_level === 'days') {
                endDatetime.setUTCMonth(endDatetime.getUTCMonth() + offsetValue + 1, 0);
                if (func_level === 'years') {
                    // startDate = dateAfterOffset's year's first day
                    selectedDate.setUTCMonth(selectedDate.getUTCMonth() + offsetValue);
                    startDatetime.setUTCFullYear(selectedDate.getUTCFullYear(), 0, 1);
                } else if (func_level === 'quarters') {
                    // startDate = dateAfterOffset's quarter's first day
                    selectedDate.setUTCMonth(selectedDate.getUTCMonth() + offsetValue);
                    startDatetime.setUTCFullYear(selectedDate.getUTCFullYear(), Math.floor((selectedDate.getUTCMonth() / 3)) * 3, 1);
                } else {
                    startDatetime.setUTCMonth(startDatetime.getUTCMonth() + offsetValue);
                }
            }
        } else if (offsetLevel === 'day') {
            if (filter_level === 'days') {
                endDatetime.setUTCDate(endDatetime.getUTCDate() + offsetValue);
                if (func_level === 'years') {
                    // startDate = dateAfterOffset's year's first day
                    selectedDate.setUTCDate(selectedDate.getUTCDate() + offsetValue);
                    startDatetime.setUTCFullYear(selectedDate.getUTCFullYear(), 0, 1);
                } else if (func_level === 'quarters') {
                    // startDate = dateAfterOffset's quarter's first day
                    selectedDate.setUTCDate(selectedDate.getUTCDate() + offsetValue);
                    startDatetime.setUTCFullYear(selectedDate.getUTCFullYear(), Math.floor((selectedDate.getUTCMonth() / 3)) * 3, 1);
                } else if (func_level === 'months') {
                    // startDate = dateAfterOffset's month's first day
                    selectedDate.setUTCDate(selectedDate.getUTCDate() + offsetValue);
                    startDatetime.setUTCFullYear(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), 1);
                }
            }
        }
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

        const offsetParams = context.title.split('@')[1].split('(')[1].slice(0, -1).split(",");

        const srcFilterItem = this.getMostDetailedDateFilter(activeFilterMap, context) || this.getMostDetailedDateFilter(dashboardFilterMap, context);
        if (srcFilterItem && srcFilterItem.filter.members.length === 1) {
            const dateRange = offsetParams.length === 2 ? this.calculateDateTimeRange(srcFilterItem.filter.members[0], funcDTLevel, srcFilterItem.level, offsetParams) : this.calculateDateTimeRange(srcFilterItem.filter.members[0], funcDTLevel, srcFilterItem.level);
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
