// This script is using to get actual quarter or year data range, given a day and level
// example:
// given 2023-04-01 and level is quarter, will return 2023-04-01 - 2023-06-30
// given 2022-10-01 and level is year, will return 2022-01-01 - 2022-12-31

(class WholeQuarterOrYearDataRange {

    initialize() {
        dashboard.on('widgetbeforequery', (widget, query) => {
            query.query.metadata.filter(metadata => metadata.wpanel === 'series' || (metadata.jaql && metadata.jaql.type === 'measure')).forEach(metadata => {
                for (let [contextKey, context] of Object.entries(metadata.jaql.context)) {
                    if (!(contextKey.startsWith('[') && !contextKey.endsWith('['))) {
                        continue;
                    }
                    if (context.title.startsWith('@')) {
                        const funcName = '__' + context.title.split('@')[1].split('(')[0];
                        if (typeof this[funcName] === 'function') {
                            this[funcName](context);
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

    calculateDateTimeRange(dt, func_level) {
        const startDatetime = new Date(dt + 'Z');
        const endDatetime = new Date(dt + 'Z');

        startDatetime.setUTCHours(0, 0, 0, 0);
        endDatetime.setUTCHours(23, 59, 59, 999);

        this.calculateDateRangeBeforeOffset(func_level, startDatetime, endDatetime);

        console.log('startDatetime: ', startDatetime)
        console.log('endDatetime: ', endDatetime)

        return {
            start_datetime: startDatetime.toISOString().slice(0, 19).replace('T', ' '),
            end_datetime: endDatetime.toISOString().slice(0, 19).replace('T', ' ')
        };
    }

    calculateDateRangeBeforeOffset(func_level, startDatetime, endDatetime) {
        if (this.isYTDFunction(func_level)) {
            startDatetime.setUTCMonth(0, 1);
            endDatetime.setUTCMonth(11, 31);
            endDatetime.setUTCHours(23, 59, 59, 999);
        } else if (this.isQTDFunction(func_level)) {
            const quarterStartMonth = Math.floor(startDatetime.getUTCMonth() / 3) * 3;
            startDatetime.setUTCMonth(quarterStartMonth, 1);

            const quarterEndMonth = Math.floor(endDatetime.getUTCMonth() / 3) * 3 + 2;
            endDatetime.setUTCMonth(quarterEndMonth + 1, 0);
            endDatetime.setUTCHours(23, 59, 59, 999);
        }

    }

    isQTDFunction(func_level) {
        return func_level === 'quarters';
    }

    isYTDFunction(func_level) {
        return func_level === 'years';
    }

    WholeDataRange(context, funcDTLevel) {
        if (context.datatype !== 'datetime') {
            return;
        }

        if (srcFilterItem && srcFilterItem.filter.members.length === 1) {
            const dateRange = this.calculateDateTimeRange(srcFilterItem.filter.members[0], funcDTLevel);
            context.level = 'days';
            context.filter = {
                from: dateRange.start_datetime,
                to: dateRange.end_datetime,
            }
        }
    }

    __WHOLE_YEAR(activeFilterMap, dashboardFilterMap, context) {
        this.WholeDataRange(context, 'years');
    }

    __WHOLE_QUARTER(activeFilterMap, dashboardFilterMap, context) {
        this.WholeDataRange(context, 'quarters');
    }

})

