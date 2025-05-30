import Papa from 'papaparse';
import { AnalyzerExtensionCommon } from './extensioncommon';
import { MetricCommon } from './metriccommon';
import MainPageApp from './mainpageapp';
import { TabulatorFull } from 'tabulator-tables';
import SlimSelect from 'slim-select';
import Split from 'split.js';
declare const chrome: any;
declare const bootstrap: any;

export default class BulkHelper {
    app: MainPageApp;
    extCommon: AnalyzerExtensionCommon;
    metricCommon: MetricCommon;
    bulkUrlListTabulator = new TabulatorFull(".bulk_url_list_tabulator", {
        layout: "fitColumns",
        movableRows: true,
        rowHeader: {
            headerSort: false,
            resizable: false,
            minWidth: 24,
            width: 24,
            rowHandle: true,
            formatter: "handle",
            frozen: true,
        },
        columns: [
            { title: "URL", field: "url", editor: "input", headerSort: false },
            {
                title: "Scrape",
                field: "scrape",
                headerSort: false,
                editor: "list",
                editorParams: {
                    values: {
                        "server scrape": "Server Scrape",
                        "browser scrape": "Browser Scrape",
                        "override content": "Override Content",
                    },
                },
                width: 120,
            },
            { title: "Options", field: "options", editor: "input", headerSort: false, width: 120, },
            { title: "Content", field: "content", editor: "textarea", headerSort: false, width: 120, },
            {
                title: "",
                field: "delete",
                headerSort: false,
                formatter: () => {
                    return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>`;
                },
                hozAlign: "center",
                width: 30,
            },
        ],
    });
    bulkResultsTabulator = new TabulatorFull(".bulk_analysis_results_tabulator", {
        layout: "fitColumns",
        resizableColumnFit: true,
        columns: [],
    });
    bulkUrlScrapeResultsTabulator = new TabulatorFull(".url_result_list", {
        layout: "fitColumns",
        selectableRange: true,
        rowHeader: {
            resizable: false,
            hozAlign: "center",
            formatter: "rownum",
            width: 40,
            headerSort: false,
        },
        clipboard: true,
        headerVisible: false,
        clipboardCopyRowRange: "range",
        clipboardPasteParser: "range",
        clipboardPasteAction: "range",
        clipboardCopyConfig: {
            rowHeaders: false, //do not include row headers in clipboard output
            columnHeaders: false, //do not include column headers in clipboard output
        },
        clipboardCopyStyled: false,
        columns: [
            { title: "URL", field: "url", headerSort: true },
        ],
    });
    top_bulk_view_splitter = document.querySelector('.top_bulk_view_splitter') as HTMLDivElement;
    bottom_bulk_view_splitter = document.querySelector('.bottom_bulk_view_splitter') as HTMLDivElement;
    viewSplitter = Split([this.top_bulk_view_splitter, this.bottom_bulk_view_splitter],
        {
            sizes: [50, 50],
            direction: 'vertical',
            minSize: 100, // min size of both panes
            gutterSize: 8,
        });
    bulkSelected = new SlimSelect({
        select: '.bulk_analysis_sets_select',
        settings: {
            showSearch: false,
            placeholderText: 'Select Analysis Set(s)',
            keepOrder: true,
            hideSelected: true,
            minSelected: 1,
            closeOnSelect: false,
        },
        events: {
            afterChange: async (newVal: any) => {
                let selectedBulkAnalysisSets: any[] = [];
                this.bulkSelected.render?.main.values.querySelectorAll('.ss-value')
                    .forEach((item: any) => {
                        selectedBulkAnalysisSets.push(item.innerText);
                    });
                if (selectedBulkAnalysisSets.length <= 1) {
                    this.bulk_analysis_sets_select.classList.add('slimselect_onevalue');
                } else {
                    this.bulk_analysis_sets_select.classList.remove('slimselect_onevalue');
                }
                await chrome.storage.local.set({ selectedBulkAnalysisSets });
            },
        },
    });
    bulk_analysis_sets_select = document.querySelector('.bulk_analysis_sets_select') as HTMLSelectElement;
    add_bulk_url_row = document.querySelector('.add_bulk_url_row') as HTMLAnchorElement;
    run_bulk_analysis_btn = document.querySelector('.run_bulk_analysis_btn') as HTMLButtonElement;
    download_url_list = document.querySelector('.download_url_list') as HTMLAnchorElement;
    upload_url_list = document.querySelector('.upload_url_list') as HTMLAnchorElement;
    url_file_input = document.getElementById('url_file_input') as HTMLInputElement;
    download_full_json = document.querySelector('.download_full_json') as HTMLButtonElement;
    download_compact_csv = document.querySelector('.download_compact_csv') as HTMLButtonElement;
    bulk_selected_last_run_date = document.querySelector('.bulk_selected_last_run_date') as HTMLDivElement;
    bulk_history_pagination = document.querySelector('.bulk_history_pagination') as HTMLDivElement;
    bulkHistoryEntryListItems = document.querySelectorAll('.bulk_history_pagination li a') as NodeListOf<HTMLLIElement>;
    clear_bulk_history = document.querySelector('.clear_bulk_history') as HTMLButtonElement;
    json_display_modal = document.querySelector('.json_display_modal') as HTMLDivElement;
    json_display_modal_content = document.querySelector('.json_display_modal_content') as HTMLDivElement;
    bulk_option_scrape_url = document.querySelector('.bulk_option_scrape_url') as HTMLInputElement;
    scrape_url_button = document.querySelector('.scrape_url_button') as HTMLButtonElement;
    bulk_modal_input_url = document.querySelector('.bulk_modal_input_url') as HTMLInputElement;
    overwrite_urls_button = document.querySelector('.overwrite_urls_button') as HTMLButtonElement;
    append_urls_button = document.querySelector('.append_urls_button') as HTMLButtonElement;
    bulk_url_modal_source_options = document.querySelector('.bulk_url_modal_source_options') as HTMLInputElement;
    url_results_selected = document.querySelector('.url_results_selected') as HTMLDivElement;
    bulkScrapeURLModal = document.querySelector('#bulkScrapeURLModal') as HTMLDivElement;
    bdModal = new bootstrap.Modal(this.bulkScrapeURLModal);
    lastSlimSelections = "";
    previousSlimOptions = "";
    lastRenderedUrlListCache = "";
    bulkHistoryCache = "";
    lastTableEdit = new Date("1900-01-01");
    itemsPerView = 5;
    bulkSelectedIndex = 0;
    currentPageIndex = 0;

    constructor(app: MainPageApp) {
        this.app = app;
        this.extCommon = app.extCommon;
        this.metricCommon = app.metricCommon;

        this.bulk_option_scrape_url.addEventListener('click', () => this.showBulkURLScrapeDialog());
        this.scrape_url_button.addEventListener('click', () => this.scrapeModalBulkUrl());

        this.bulkUrlListTabulator.on("cellClick", async (e: Event, cell: any) => {
            if (cell.getColumn().getField() === "delete") {
                this.lastTableEdit = new Date();
                let bulkUrlList = this.bulkUrlListTabulator.getData();
                let rowIndex = cell.getRow().getPosition();
                bulkUrlList.splice(rowIndex - 1, 1);
                this.bulkUrlListTabulator.setData(bulkUrlList);
                await chrome.storage.local.set({ bulkUrlList });
            }
        });
        this.bulkUrlListTabulator.on("rowMoved", async (row: any) => {
            this.lastTableEdit = new Date();
            let bulkUrlList = this.bulkUrlListTabulator.getData();
            await chrome.storage.local.set({ bulkUrlList });
        });
        this.bulkUrlListTabulator.on("cellEdited", async (cell: any) => {
            this.lastTableEdit = new Date();
            let bulkUrlList = this.bulkUrlListTabulator.getData();
            await chrome.storage.local.set({ bulkUrlList });
        });
        this.bulkUrlScrapeResultsTabulator.on("rangeChanged", async () => {
            let selectedRanges: any[] = (this.bulkUrlScrapeResultsTabulator as any).getRangesData();
            let urlsMap: any = {};
            selectedRanges.forEach((dataRows: any[]) => {
                dataRows.forEach((row: any) => {
                    if (row.url) urlsMap[row.url] = true;
                });
            });
            let urls = Object.keys(urlsMap);
            this.url_results_selected.innerText = urls.length + " URLs selected";
        });
        this.append_urls_button.addEventListener('click', async () => {
            let selectedRanges: any[] = (this.bulkUrlScrapeResultsTabulator as any).getRangesData();
            let urlsMap: any = {};
            selectedRanges.forEach((dataRows: any[]) => {
                dataRows.forEach((row: any) => {
                    if (row.url) urlsMap[row.url] = true;
                });
            });
            let urls = Object.keys(urlsMap);
            let bulkUrlList = this.bulkUrlListTabulator.getData();
            if (bulkUrlList.length === 0) {
                alert("No URLs to append to");
                return;
            }
            urls.forEach((url: string) => {
                bulkUrlList.push({ url, scrape: "server scrape", options: "", content: "" });
            });
            this.bulkUrlListTabulator.setData(bulkUrlList);
            chrome.storage.local.set({ bulkUrlList });

            this.bulk_modal_input_url.value = "";
            this.bdModal.hide();
        });
        this.overwrite_urls_button.addEventListener('click', async () => {
            let selectedRanges: any[] = (this.bulkUrlScrapeResultsTabulator as any).getRangesData();
            let urlsMap: any = {};
            selectedRanges.forEach((dataRows: any[]) => {
                dataRows.forEach((row: any) => {
                    if (row.url) urlsMap[row.url] = true;
                });
            });
            let urls = Object.keys(urlsMap);
            let bulkUrlList: any[] = [];
            urls.forEach((url: string) => {
                bulkUrlList.push({ url, scrape: "server scrape", options: "", content: "" });
            });
            this.bulkUrlListTabulator.setData(bulkUrlList);
            chrome.storage.local.set({ bulkUrlList });

            this.bulk_modal_input_url.value = "";
            this.bdModal.hide();
        });
        this.add_bulk_url_row.addEventListener('click', async (e) => {
            this.lastTableEdit = new Date();
            let bulkUrlList = this.bulkUrlListTabulator.getData();
            bulkUrlList.push({ url: "", scrape: "server scrape", options: "", content: "" });
            this.bulkUrlListTabulator.setData(bulkUrlList);
            await chrome.storage.local.set({ bulkUrlList });
            e.preventDefault();
        });
        this.run_bulk_analysis_btn.addEventListener('click', async () => {
            if (await this.extCommon.testSessionKeys() === false) return;
            let emptyRows = await this.checkForEmptyRows();
            if (emptyRows) {
                if (confirm("Empty rows detected. Do you want to remove them and continue?") === true) {
                    await this.trimEmptyRows();
                } else {
                    alert("Empty rows detected. Please remove them before running analysis");
                    return;
                }
            }
            let validUrls = true;
            let bulkUrlList = this.bulkUrlListTabulator.getData();
            let invalidUrlList = '';
            bulkUrlList.forEach((row: any) => {
                let url = row.url;
                let urlRegex = new RegExp("^(http|https)://", "i");
                if (!urlRegex.test(url)) {
                    validUrls = false;
                    invalidUrlList += url + "\n";
                }
            });
            if (!validUrls) {
                alert("Invalid URLs detected. Please correct them before running analysis\n" + invalidUrlList);
                return;
            }

            let rows = this.bulkUrlListTabulator.getData();
            await this.metricCommon.runBulkAnalysis(rows);
        });
        this.download_url_list.addEventListener('click', async (e) => {
            if (this.bulkUrlListTabulator.getData().length === 0) {
                alert("No data to download");
                return;
            }
            const rows: any[] = this.bulkUrlListTabulator.getData();
            rows.forEach((row: any) => {
                delete row.delete;
            });
            let csv = Papa.unparse(rows);
            let blob = new Blob([csv], { type: "text/csv" });
            let url = URL.createObjectURL(blob);
            let a = document.createElement('a');
            document.body.appendChild(a);
            a.href = url;
            a.download = "bulk_url_list.csv";
            a.click();
            document.body.removeChild(a);
            e.preventDefault();
        });
        this.upload_url_list.addEventListener('click', async () => {
            this.url_file_input.click();
        });
        this.url_file_input.addEventListener('change', async () => {
            if (!this.url_file_input.files || (this.url_file_input.files as any).length === 0) {
                return;
            }
            let file = (this.url_file_input.files as any)[0];
            let reader = new FileReader();
            reader.onload = async () => {
                let text = reader.result as string;
                let existingUrlList = this.bulkUrlListTabulator.getData();
                let bulkUrlList = Papa.parse(text, { header: true }).data;
                bulkUrlList.forEach((row: any) => {
                    if (!row.scrape) row.scrape = "server scrape";
                    existingUrlList.push(row);
                });
                this.bulkUrlListTabulator.setData(existingUrlList);
                await chrome.storage.local.set({ bulkUrlList: existingUrlList });
                this.url_file_input.value = "";
            };
            reader.readAsText(file);
        });
        this.download_full_json.addEventListener('click', async () => {
            const bulkHistory = await this.extCommon.getStorageField('bulkHistory') || [];
            let historyItem = bulkHistory[this.bulkSelectedIndex];
            let a = document.createElement('a');
            document.body.appendChild(a);
            a.href = historyItem.analysisResultPath;
            a.target = "_blank";
            a.click();
            document.body.removeChild(a);
        });
        this.download_compact_csv.addEventListener('click', async () => {
            const bulkHistory = await this.extCommon.getStorageField('bulkHistory') || [];
            let historyItem = bulkHistory[this.bulkSelectedIndex];
            let a = document.createElement('a');
            document.body.appendChild(a);
            a.href = historyItem.compactResultPath;
            a.target = "_blank";
            a.click();
            document.body.removeChild(a);
        });
        this.clear_bulk_history.addEventListener('click', async () => {
            if (confirm("Are you sure you want to clear the history?") === true) {
                await chrome.storage.local.set({ bulkHistory: [] });
                this.paintAnalysisHistory();
            }
        });
        this.bulk_url_modal_source_options.addEventListener("input", async () => {
            const optionsMap = AnalyzerExtensionCommon.processOptions(this.bulk_url_modal_source_options.value);
            if (optionsMap.url && this.bulk_modal_input_url.value.trim() === "") {
                this.bulk_modal_input_url.value = optionsMap.url;
            }
        });
    }
    async paint() {
        this.paintAnalysisHistory();

        //only continue if debounce timer is up
        if (this.lastTableEdit.getTime() > new Date().getTime() - 1000) {
            return;
        }
        const allUrls: any[] = await this.extCommon.getStorageField('bulkUrlList') || [];
        if (this.setURLListCacheString(allUrls)) {
            this.bulkUrlListTabulator.setData(allUrls);
        }

        const setNames = await this.metricCommon.getAnalysisSetNames();
        let html = "";
        setNames.forEach((setName) => {
            html += `<option value="${setName}">${setName}</option>`;
        });
        let selectedBulkAnalysisSets = await chrome.storage.local.get("selectedBulkAnalysisSets");
        let slimOptions: any[] = [];
        setNames.forEach((setName) => {
            slimOptions.push({ text: setName, value: setName });
        });
        const slimOptionsString = JSON.stringify(slimOptions);
        let dataChange = false;
        if (this.previousSlimOptions !== slimOptionsString) {
            dataChange = true;
            this.bulkSelected.setData(slimOptions);
            this.previousSlimOptions = slimOptionsString;
        }

        if (selectedBulkAnalysisSets && selectedBulkAnalysisSets.selectedBulkAnalysisSets) {
            let setCache = JSON.stringify(selectedBulkAnalysisSets.selectedBulkAnalysisSets);
            if (setCache !== this.lastSlimSelections || dataChange) {
                this.lastSlimSelections = setCache;

                this.bulkSelected.setSelected(selectedBulkAnalysisSets.selectedBulkAnalysisSets);
                let domSelections = this.bulkSelected.render?.main.values.querySelectorAll('.ss-value') as NodeListOf<Element>;
                let indexMap: any = {};
                domSelections.forEach((item: any, index: any) => {
                    indexMap[item.innerText] = index;
                });
                let setOrder = selectedBulkAnalysisSets.selectedBulkAnalysisSets;
                setOrder.forEach((setName: any, index: any) => {
                    let domIndex = indexMap[setName];
                    if (domSelections[domIndex]) {
                        this.bulkSelected.render?.main.values.appendChild(domSelections[domIndex]);
                    }
                });
            }
        }
        if (this.bulkSelected.getSelected().length === 0) {
            this.bulkSelected.setSelected([setNames[0]]);
        }
    }
    /** returns true if cache changed */
    setURLListCacheString(tableRows: any, other: any = {}) {
        const cacheString = JSON.stringify(tableRows) + JSON.stringify(other);
        if (this.lastRenderedUrlListCache === cacheString) return false;
        this.lastRenderedUrlListCache = cacheString;
        return true;
    }
    async checkForEmptyRows() {
        let bulkUrlList = this.bulkUrlListTabulator.getData();
        let emptyRows = bulkUrlList.filter((row: any) => {
            return row.url.trim() === "";
        });
        if (emptyRows.length > 0) {
            return true;
        }
        return false
    }
    async showBulkURLScrapeDialog() {
        this.bulk_modal_input_url.value = "";
        this.bdModal.show();
    }
    async scrapeModalBulkUrl() {
        if (await this.extCommon.testSessionKeys() === false) return;
        let url = this.bulk_modal_input_url.value;
        if (!url) {
            alert("Please enter a URL to scrape");
            return;
        }
        this.bulkUrlScrapeResultsTabulator.setData([{
            url: "Loading " + url + " ...",
        }]);
        let options = this.bulk_url_modal_source_options.value;
        let scrapeResult = await this.metricCommon.serverScrapeUrl(url, options);
        let urlList = scrapeResult.text.split("\n");
        let urlMap: any = {};
        let uniqueUrlList: string[] = [];
        urlList.forEach((url: string) => {
            if (url && !urlMap[url]) {
                urlMap[url] = true;
                uniqueUrlList.push(url);
            }
        });
        let results: any[] = [];
        uniqueUrlList.forEach((url: string, index: number) => {
            results.push({ url, rowIndex: index });
        });
        this.bulkUrlScrapeResultsTabulator.setData(results);
    }
    async trimEmptyRows() {
        let bulkUrlList = this.bulkUrlListTabulator.getData();
        bulkUrlList = bulkUrlList.filter((row: any) => {
            return row.url.trim() !== "";
        });
        this.bulkUrlListTabulator.setData(bulkUrlList);
        await chrome.storage.local.set({ bulkUrlList });
    }
    async paintAnalysisHistory() {
        const bulkHistory = await this.extCommon.getStorageField('bulkHistory') || [];
        const bulkRunning = await this.extCommon.getStorageField('bulk_running');
        const newCache = JSON.stringify({
            bulkHistory,
            bulkRunning,
            selectedIndex: this.bulkSelectedIndex,
            pageIndex: this.currentPageIndex,
        });
        if (newCache === this.bulkHistoryCache) return;
        this.bulkHistoryCache = newCache;
        let paginationHtml = this.extCommon
            .generatePagination(bulkHistory.length, this.bulkSelectedIndex, this.itemsPerView, this.currentPageIndex);

        if (bulkRunning) {
            document.body.classList.add("extension_bulk_running");
            document.body.classList.remove("extension_not_bulk_running");
        } else {
            document.body.classList.remove("extension_bulk_running");
            document.body.classList.add("extension_not_bulk_running");
        }

        let bulkHistoryItem = bulkHistory[this.bulkSelectedIndex];
        if (bulkHistoryItem) {
            this.paintSelectedHistoryEntry(bulkHistoryItem);
            document.body.classList.add("bulk_history_item_selected");
            document.body.classList.remove("no_bulk_history_item_selected");
        } else {
            document.body.classList.add("no_bulk_history_item_selected");
            document.body.classList.remove("bulk_history_item_selected");
            this.bulk_selected_last_run_date.innerText = "No selected entry";
        }
        this.bulk_history_pagination.innerHTML = paginationHtml;

        this.bulkHistoryEntryListItems = document.querySelectorAll('.bulk_history_pagination li a') as NodeListOf<HTMLLIElement>;
        this.bulkHistoryEntryListItems.forEach((item: any) => {
            item.addEventListener('click', async (e: any) => {
                e.preventDefault();
                const newIndex = Number(item.dataset.entryindex);

                const eventResult: any = this.extCommon
                    .handlePaginationClick(newIndex, bulkHistory.length,
                        this.bulkSelectedIndex, this.itemsPerView, this.currentPageIndex);
                this.bulkSelectedIndex = eventResult.selectedIndex;
                this.currentPageIndex = eventResult.pageIndex;
                this.paintAnalysisHistory();
            });
        });

    }
    async paintSelectedHistoryEntry(bulkHistoryItem: any) {
        this.bulk_selected_last_run_date.innerText = AnalyzerExtensionCommon.showGmailStyleDate(bulkHistoryItem.runId);
        let csvFetchResult = await fetch(bulkHistoryItem.compactResultPath);
        let csvText = await csvFetchResult.text();
        let csvData = Papa.parse(csvText, { header: true }).data;
        let columns: any[] = [];
        if (csvData.length > 0) {
            columns = Object.keys(csvData[0] as any);
        }
        let tabulatorColumns: any[] = [];
        columns.forEach((column) => {
            const title = column.split("_")[0];
            tabulatorColumns.push({ title, field: column, resizable: true, });
        });
        this.bulkResultsTabulator.setColumns(tabulatorColumns);
        this.bulkResultsTabulator.setData(csvData);

        this.json_display_modal_content.innerText = "Loading...";
        let jsonFetchResult = await fetch(bulkHistoryItem.analysisResultPath);
        let jsonText = await jsonFetchResult.text();
        jsonText = JSON.stringify(JSON.parse(jsonText), null, 2);
        this.json_display_modal_content.innerHTML = this.highlightElement(jsonText);
    }
    highlightElement(obj: any) {
        if (typeof obj !== 'string') {
            obj = JSON.stringify(obj, undefined, 2);
        }
        let json: string = obj;
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            var cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    }
}