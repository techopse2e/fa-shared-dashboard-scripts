(class Jaql {
    constructor() {
        this.reset()
    }

    getJaqlReqUrl(query) {
        this.dataSource = query.query.datasource;
        this.jaqlReqUrl = `${window.location.protocol}//${window.location.host}/api/datasources/${encodeURIComponent(query.query.datasource.title)}/jaql`;
    }

    reset() {
        this.baseMetadata = null;
        this.formulaType = null;
        this.dataSource = null;
        this.metadata = [];
        this.metadataList = [];
        this.metadataListInfo = {};
        this.resultConfig = [];
        this.categoryNumber = 0;
        this.rawDataColumns = 0;
        this.widgetRawDataPromise = null;
    }

    getBaseMetadata(query) {
        this.baseMetadata = query.query.metadata.filter(element => {
            if (!element.jaql.hasOwnProperty('formula') && !element.jaql.hasOwnProperty('agg')) {
                if (!element.jaql.hasOwnProperty('filter')) {
                    this.categoryNumber++;
                    this.rawDataColumns++;
                }
                return true;
            }
            return false;
        });
    }

    getMetadataList(query) {
        let formulas = query.query.metadata.filter(element => element.jaql.hasOwnProperty('formula') || element.jaql.hasOwnProperty('agg'));
        let columnNumber = [];
        formulas.forEach(formula => {
            columnNumber.push(1);
            this.rawDataColumns++;
            this.resultConfig.push({
                title: formula.jaql.title,
                color: formula.format.color.color,
                type: formula.singleSeriesType || 'column',
            });
            this.metadataList.push([...this.baseMetadata, formula]);
        });
        this.metadataListInfo.columnNumber = columnNumber;
    }

    addFormulas(formulaConfigs, metadata) {
        metadata.push(...this.baseMetadata);
        for (let formulaConfig of formulaConfigs) {
            this.addFormula(formulaConfig, metadata);
            this.resultConfig.push({
                title: formulaConfig.title,
                color: formulaConfig.color,
                type: formulaConfig.singleSeriesType || 'column',
            });
        }
    }

    initialize({widgetMetadataFunc=null, processresultCallback=null}={}) {
        widget.on('beforequery',async (widget, query) => {

            this.reset();
            this.getJaqlReqUrl(query);
            this.getBaseMetadata(query);

            if(widgetMetadataFunc === null) {
                this.getMetadataList(query);
                this.formulaType = 'formulaGroups';
                this.widgetRawDataPromise = this.getWidgetData();
                return;
            }

            let formulaInfo = widgetMetadataFunc(this);
            if (formulaInfo.hasOwnProperty('formulas')) {
                this.formulaType = 'formulas';
                this.addFormulas(formulaInfo.formulas, this.metadata);
            } else if (formulaInfo.hasOwnProperty('formulaGroups')) {
                this.formulaType = 'formulaGroups';
                let columnNumber = [];
                for (let formulaConfigs of formulaInfo.formulaGroups) {
                    let metadata = [];
                    this.addFormulas(formulaConfigs, metadata);
                    columnNumber.push(formulaConfigs.length);
                    this.metadataList.push(metadata);
                }
                this.metadataListInfo.columnNumber = columnNumber;
            }
            this.widgetRawDataPromise = this.getWidgetData();
        });

        widget.on('processresult', async (widget, event) => {
            await this.generateResultSeries(event);
            if (processresultCallback !== null) {
                processresultCallback(widget, event);
            }
        });
    }

    async generateResultSeries(event) {
        let mask = null;
        if (event.result.series.length > 0) {
            mask = event.result.series[0].mask;
        }
        let rawData = await this.widgetRawDataPromise;
        let series = Array();
        let categories = [];
        if (rawData.length === 0) {
            return series;
        }
        for (let rowIndex=0; rowIndex < rawData.length; rowIndex++) {
            categories.push(rawData[rowIndex][this.categoryNumber - 1].text);
        }
        for (let columnIndex=this.categoryNumber; columnIndex < this.rawDataColumns; columnIndex++){
            let arr = [];
            for (let rowIndex=0; rowIndex < rawData.length; rowIndex++) {
                arr.push({
                    color: null,
                    marker: {states: {select: {enabled: true, fillColor: null, fillOpacity: 0.3, lineColor: null}}, enabled: true},
                    queryResultIndex: rowIndex,
                    selected: false,
                    selectionData: Object. fromEntries(new Map([...Array(this.categoryNumber).keys()].map((i) => [i, rawData[rowIndex][i].data]))),
                    y: rawData[rowIndex][columnIndex].data === 'N\\A' ? null : rawData[rowIndex][columnIndex].data
                });
            }
            series.push({
                color: this.resultConfig[columnIndex - this.categoryNumber].color,
                data: arr,
                name: this.resultConfig[columnIndex - this.categoryNumber].title,
                mask: mask,
                type: this.resultConfig[columnIndex - this.categoryNumber].type,
            });
        }
        event.result.xAxis.categories = categories;
        event.result.series = series;
        event.rawResult.values = rawData;
    }

    generateFormulaId(){
        let str = '[';
        let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let charactersLength = characters.length;
        for ( let i = 0; i < 5; i++ ) {
            str += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        str += ']';
        return str;
    }

    async getFilterValues(table, column, sort='asc', datasource=null) {
        if (this.jaqlReqUrl === null) {
            if (datasource === null) {
                throw 'datasource need to be specified'
            }
            this.jaqlReqUrl = `${window.location.protocol}//${window.location.host}/api/datasources/${encodeURIComponent(datasource)}/jaql`;
        }
        return await this.getWidgetData([{ dim: `[${table}.${column}]`, sort: sort }]).map(x => x[0]);
    }

    addFormula(formulaConfig, metadata) {
        let formulaStr = formulaConfig.formula;
        let context = {};
        for (let key in formulaConfig.columns) {
            let formulaId = this.generateFormulaId();
            formulaStr = formulaStr.replace(`[${key}]`, formulaId);
            if (formulaConfig.columns[key].length === 3) {
                let [table, column, datatype] = formulaConfig.columns[key];
                context[formulaId] = {table: table, column: column, dim: `[${table}.${column}]`, datatype: datatype, title: column}
            } else if (formulaConfig.columns[key].length === 4) {
                let [table, column, datatype, filter] = formulaConfig.columns[key];
                context[formulaId] = {table: table, column: column, dim: `[${table}.${column}]`, datatype: datatype, title: column, filter: filter}
            } else {
                throw `Invalid formula config column length: ${formulaConfig.columns[key].length}`;
            }
        }
        metadata.push({
            jaql: {
                formula : formulaStr,
                context: context,
                title: '',
                type: "measure"
            }
        });
        this.rawDataColumns++;
    }

    async getWidgetData(metadata=null) {
        if (metadata !== null || this.formulaType === 'formulas') {
            return await this.getJaqlData(metadata === null ? this.metadata : metadata);
        } else if (this.formulaType === 'formulaGroups') {
            let rawDataList = await Promise.all(this.metadataList.map(metadata => this.getJaqlData(metadata)));
            let finalRawData = [...new Map(rawDataList.map(rawData => {
                return rawData.map(row => [row.slice(0, this.categoryNumber).map(cell => cell.text).join(' | '), row.slice(0, this.categoryNumber)])
            }).flat()).entries()].sort((a, b) => a[1][0].data > b[1][0].data ? 1 : -1);
            rawDataList.forEach((rawData, index) => {
                let rawDataMap = new Map(rawData.map(row => [row.slice(0, this.categoryNumber).map(cell => cell.text).join(' | '), row.slice(this.categoryNumber)]));
                let columnNumber = this.metadataListInfo.columnNumber[index];
                finalRawData.forEach(keyValue => {
                    let [key, value] = keyValue;
                    if (!rawDataMap.has(key)) {
                        value.push(...[...Array(columnNumber).keys()].map(_ => ({data:"N\\A", text:"N\\A"})));
                    } else {
                        value.push(...rawDataMap.get(key));
                    }
                });
            });
            return finalRawData.map(value => value[1]);
        } else {
            throw `invalid formulaType: ${this.formulaType}`
        }
    }

    async getJaqlData(metadata) {
        let options = {
            headers: {
                'content-type': 'application/json;charset=UTF-8',
            },
            method: 'POST',
            url: this.jaqlReqUrl,
            data: JSON.stringify({datasource: this.dataSource, metadata: metadata}),
            contentType: 'application/json',
            async: true
        };
        return new Promise(function (resolve, reject) {
            $.ajax(options).done(data => resolve(data.values)).fail(reject);
        });
    }
})