// This script is using to get actual quarter or year data range, given a day and level
// example:
// given 2023-04-01 and level is quarter, will return 2023-04-01 - 2023-06-30
// given 2022-10-01 and level is year, will return 2022-01-01 - 2022-12-31
//
// add a func to get whole year with offset
// example:
// given 2022-10-01 and level is year and offset is -1, will return 2021-01-01 - 2021-12-31

// add another func to get whole year but till today
// example: current date is 2023-09-12
// given 2023-10-01, level is year and specify `isTillToday` is true, will return 2023-01-01 - 2023-09-12
// given 2024-10-01, level is year and specify `isTillToday` is true, will return 2024-01-01 - 2023-12-31 to not display data

(class WholeQuarterOrYearDataRange {
    getFilterKey(jaql) {
        return `${jaql.dim} | ${jaql.level}`
    }

    getActiveFilterMap(query) {
        const filterValueMap = new Map();
        query.query.metadata.filter(metadata => metadata.panel === 'scope' && !metadata.jaql.filter.hasOwnProperty('by')).forEach(metadata => {
            if (metadata.jaql.filter.filter === undefined) {
                filterValueMap.set(this.getFilterKey(metadata.jaql), metadata.jaql);
            }
        });
        return filterValueMap;
    }

    getDashboardFilterMap() {
        const filterValueMap = new Map();
        prism.activeDashboard.filters.$$items.forEach(metadata => {
            if (metadata.hasOwnProperty('levels')) {
                metadata.levels.forEach(jaql => {
                    if (jaql.filter.filter === undefined) {
                        filterValueMap.set(this.getFilterKey(jaql), jaql);
                    }
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
                // use to filter the left widget values
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
                // use to filter the right widget filters
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

    compareDateInUtcTimeZone(firstDate, secondDate) {
        const first = new Date(firstDate.toUTCString());
        const second = new Date(secondDate.toUTCString());
        return first > second;
    }

    calculateDateTimeRange(dt, func_level, filter_level, offset, isTillToday) {
        const startDatetime = new Date(dt + 'Z');
        let endDatetime = new Date(dt + 'Z');

        startDatetime.setUTCHours(0, 0, 0, 0);
        endDatetime.setUTCHours(23, 59, 59, 999);

        this.calculateDateRangeWithOffset(func_level, startDatetime, endDatetime, filter_level, offset);

        const now = new Date();
        if (isTillToday && this.compareDateInUtcTimeZone(endDatetime, now)) {
            endDatetime.setUTCFullYear(now.getUTCFullYear());
            endDatetime.setUTCMonth(now.getUTCMonth(), now.getUTCDate()-1);
        }
        if (isTillToday && this.compareDateInUtcTimeZone(startDatetime, now)) {
            endDatetime.setTime(0);
        }

        console.log('startDatetime: ', startDatetime)
        console.log('endDatetime: ', endDatetime)

        return {
            start_datetime: startDatetime.toISOString().slice(0, 19).replace('T', ' '),
            end_datetime: endDatetime.toISOString().slice(0, 19).replace('T', ' ')
        };
    }

    calculateDateRangeWithOffset(func_level, startDatetime, endDatetime, filter_level, offset) {

        if (this.isYearFunction(func_level)) {
            startDatetime.setUTCFullYear(startDatetime.getUTCFullYear() + offset);
            startDatetime.setUTCMonth(0, 1);
            endDatetime.setUTCFullYear(endDatetime.getUTCFullYear() + offset);
            endDatetime.setUTCMonth(11, 31);
            return;
        }

        if (this.isQuarterFunction(func_level)) {
            const quarterStartMonth = Math.floor(startDatetime.getUTCMonth() / 3) * 3;
            startDatetime.setUTCMonth(quarterStartMonth, 1);

            const quarterEndMonth = Math.floor(endDatetime.getUTCMonth() / 3) * 3 + 2;
            endDatetime.setUTCMonth(quarterEndMonth + 1, 0);

            if (filter_level === 'years') {
                endDatetime.setTime(0);
            }
            return;
        }

    }

    isQuarterFunction(func_level) {
        return func_level === 'quarters';
    }

    isYearFunction(func_level) {
        return func_level === 'years';
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

    WholeDataRange(activeFilterMap, dashboardFilterMap, context, funcDTLevel, offset = 0, isTillToday = false) {
        if (context.datatype !== 'datetime') {
            return;
        }

        const srcFilterItem = this.getMostDetailedDateFilter(activeFilterMap, context) || this.getMostDetailedDateFilter(dashboardFilterMap, context);
        if (srcFilterItem && srcFilterItem.filter.members.length === 1) {
            const dateRange = this.calculateDateTimeRange(srcFilterItem.filter.members[0], funcDTLevel, srcFilterItem.level, offset, isTillToday);
            context.level = 'days';
            context.filter = {
                from: dateRange.start_datetime,
                to: dateRange.end_datetime,
            }
        }
    }

    __WHOLE_YEAR(activeFilterMap, dashboardFilterMap, context) {
        this.WholeDataRange(activeFilterMap, dashboardFilterMap, context, 'years');
    }

    __WHOLE_QUARTER(activeFilterMap, dashboardFilterMap, context) {
        this.WholeDataRange(activeFilterMap, dashboardFilterMap, context, 'quarters');
    }

    __WHOLE_YEAR_WITH_OFFSET(activeFilterMap, dashboardFilterMap, context) {
        const offset = parseInt(context.title.split('@')[1].split('(')[1].slice(0, -1));
        this.WholeDataRange(activeFilterMap, dashboardFilterMap, context, 'years', offset, false);
    }

    __WHOLE_YEAR_TILL_TODAY(activeFilterMap, dashboardFilterMap, context) {
        this.WholeDataRange(activeFilterMap, dashboardFilterMap, context, 'years', 0, true);
    }
})
