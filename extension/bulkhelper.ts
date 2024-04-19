import Papa from 'papaparse';
import { AnalyzerExtensionCommon } from './extensioncommon';
import { TabulatorFull } from 'tabulator-tables';
import SlimSelect from 'slim-select';
declare const chrome: any;

export default class BulkHelper {
    extCommon = new AnalyzerExtensionCommon(chrome);
    activeTabsBeingScraped: any = [];
    bulk_url_list_tabulator: TabulatorFull;
    bulkSelected: SlimSelect;
    itemsPerView = 5;
    bulkSelectedIndex = 0;
    currentPageIndex = 0;
    bulk_analysis_sets_select: any = document.querySelector('.bulk_analysis_sets_select');
    add_bulk_url_row = document.querySelector('.add_bulk_url_row') as HTMLButtonElement;
    run_bulk_analysis_btn = document.querySelector('.run_bulk_analysis_btn') as HTMLButtonElement;
    bulk_analysis_results_history = document.querySelector('.bulk_analysis_results_history') as HTMLDivElement;
    download_url_list = document.querySelector('.download_url_list') as HTMLButtonElement;
    upload_url_list = document.querySelector('.upload_url_list') as HTMLButtonElement;
    url_file_input = document.getElementById('url_file_input') as HTMLInputElement;
    download_full_json = document.querySelector('.download_full_json') as HTMLButtonElement;
    download_compact_csv = document.querySelector('.download_compact_csv') as HTMLButtonElement;
    bulk_selected_last_run_date = document.querySelector('.bulk_selected_last_run_date') as HTMLDivElement;
    bulk_history_pagination = document.querySelector('.bulk_history_pagination') as HTMLDivElement;
    bulkHistoryEntryListItems = document.querySelectorAll('.bulk_history_pagination li a') as NodeListOf<HTMLLIElement>;
    previousSlimOptions = "";
    lastTableEdit = new Date();


    constructor() {
        this.bulk_url_list_tabulator = new TabulatorFull(".bulk_url_list_tabulator", {
            layout: "fitColumns",
            movableRows: true,
            rowHeader: { headerSort: false, resizable: false, minWidth: 30, width: 30, rowHandle: true, formatter: "handle" },
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
                        return `<i class="material-icons-outlined">delete</i>`;
                    },
                    hozAlign: "center",
                    width: 30,
                },
            ],
        });
        this.bulkSelected = new SlimSelect({
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
                afterChange: async (newVal) => {
                    let selectedBulkAnalysisSets: any[] = [];
                    this.bulkSelected.render.main.values.querySelectorAll('.ss-value')
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

        // for detecting in browser scraping completion
        chrome.tabs.onUpdated.addListener(
            (tabId: number, changeInfo: any, tab: any) => {
                if (this.activeTabsBeingScraped[tabId] && changeInfo.status === "complete") {
                    this.activeTabsBeingScraped[tabId]();
                }
            }
        );


        this.bulk_url_list_tabulator.on("cellClick", async (e: Event, cell: any) => {
            if (cell.getColumn().getField() === "delete") {
                this.lastTableEdit = new Date();
                let bulkUrlList = this.bulk_url_list_tabulator.getData();
                let rowIndex = cell.getRow().getPosition();
                bulkUrlList.splice(rowIndex - 1, 1);
                this.bulk_url_list_tabulator.setData(bulkUrlList);
                await chrome.storage.local.set({ bulkUrlList });
            }
        });

        this.bulk_url_list_tabulator.on("rowMoved", async (row: any) => {
            this.lastTableEdit = new Date();
            let bulkUrlList = this.bulk_url_list_tabulator.getData();
            await chrome.storage.local.set({ bulkUrlList });
        });

        this.bulk_url_list_tabulator.on("cellEdited", async (cell: any) => {
            this.lastTableEdit = new Date();
            let bulkUrlList = this.bulk_url_list_tabulator.getData();
            await chrome.storage.local.set({ bulkUrlList });
        });

        this.add_bulk_url_row.addEventListener('click', async () => {
            this.lastTableEdit = new Date();
            let bulkUrlList = this.bulk_url_list_tabulator.getData();
            bulkUrlList.push({ url: "", scrape: "server scrape", options: "", content: "" });
            this.bulk_url_list_tabulator.setData(bulkUrlList);
            await chrome.storage.local.set({ bulkUrlList });
        });

        this.run_bulk_analysis_btn.addEventListener('click', async () => {
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
            let bulkUrlList = this.bulk_url_list_tabulator.getData();
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

            let rows = this.bulk_url_list_tabulator.getData();
            await this.runBulkAnalysis(rows);
        });

        this.download_url_list.addEventListener('click', async () => {
            if (this.bulk_url_list_tabulator.getData().length === 0) {
                alert("No data to download");
                return;
            }
            const rows: any[] = this.bulk_url_list_tabulator.getData();
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
        });

        this.upload_url_list.addEventListener('click', async () => {
            this.url_file_input.click();
        });

        this.url_file_input.addEventListener('change', async () => {
            let file = (this.url_file_input.files as any)[0];
            let reader = new FileReader();
            reader.onload = async () => {
                let text = reader.result as string;
                let bulkUrlList = Papa.parse(text, { header: true }).data;
                this.bulk_url_list_tabulator.setData(bulkUrlList);
                await chrome.storage.local.set({ bulkUrlList });
                this.url_file_input.value = "";
            };
            reader.readAsText(file);
        });

        this.upload_url_list.addEventListener('click', async () => {
            this.url_file_input.click();
        });

        this.url_file_input.addEventListener('change', async () => {
            let file = (this.url_file_input.files as any)[0];
            let reader = new FileReader();
            reader.onload = async () => {
                let text = reader.result as string;
                let bulkUrlList = Papa.parse(text, { header: true }).data;
                this.bulk_url_list_tabulator.setData(bulkUrlList);
                await chrome.storage.local.set({ bulkUrlList });
                this.url_file_input.value = "";
            };
            reader.readAsText(file);
        });

        this.download_full_json.addEventListener('click', async () => {
            let bulkHistory = await chrome.storage.local.get('bulkHistory');
            bulkHistory = bulkHistory.bulkHistory || [];
            let historyItem = bulkHistory[this.bulkSelectedIndex];
            let a = document.createElement('a');
            document.body.appendChild(a);
            a.href = historyItem.analysisResultPath;
            a.click();
            document.body.removeChild(a);
        });

        this.download_compact_csv.addEventListener('click', async () => {
            let bulkHistory = await chrome.storage.local.get('bulkHistory');
            bulkHistory = bulkHistory.bulkHistory || [];
            let historyItem = bulkHistory[this.bulkSelectedIndex];
            let a = document.createElement('a');
            document.body.appendChild(a);
            a.href = historyItem.compactResultPath;
            a.click();
            document.body.removeChild(a);
        });
    }

    async checkForEmptyRows() {
        let bulkUrlList = this.bulk_url_list_tabulator.getData();
        let emptyRows = bulkUrlList.filter((row: any) => {
            return row.url.trim() === "";
        });
        if (emptyRows.length > 0) {
            return true;
        }
        return false
    }
    async trimEmptyRows() {
        let bulkUrlList = this.bulk_url_list_tabulator.getData();
        bulkUrlList = bulkUrlList.filter((row: any) => {
            return row.url.trim() !== "";
        });
        this.bulk_url_list_tabulator.setData(bulkUrlList);
        await chrome.storage.local.set({ bulkUrlList });
    }

    async detectTabLoaded(tabId: number) {
        return new Promise((resolve, reject) => {
            this.activeTabsBeingScraped[tabId] = resolve;
        });
    }
    async scrapeTabPage(url: any, tabId: string) {
        return new Promise(async (resolve, reject) => {

            let tab = await chrome.tabs.create({
                url
            });

            chrome.tabs.update(tabId, { active: true })

            await this.detectTabLoaded(tab.id);
            setTimeout(async () => {
                try {
                    let scrapes = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => {
                            return document.body.innerText;
                        },
                    });
                    const updatedTab = await chrome.tabs.get(tab.id);
                    scrapes.title = updatedTab.title;
                    await chrome.tabs.remove(tab.id);
                    resolve(scrapes);
                } catch (e) {
                    resolve("");
                }
            }, 3000);
        });
    }
    async scrapeBulkUrl(bulkUrl: any, defaultTabId: string) {
        let scrape = bulkUrl.scrape;
        let url = bulkUrl.url || "";
        let options = bulkUrl.options || "";
        if (scrape === "server scrape") {
            const result = await this.scrapeUrlServerSide(url, options);
            if (result.success) {
                return {
                    text: result.result.text,
                    title: result.result.title,
                };
            }
            return {
                text: "No text found in page",
                title: "",
            };
        } else if (scrape === "browser scrape") {
            return this.scrapeTabPage(url, defaultTabId);
        } else if (scrape === "override content") {
            return {
                text: bulkUrl.content,
                url,
                title: "",
            };
        } else {
            return {
                text: "No text found in page",
                title: "",
                url
            };
        }
    }
    async scrapeUrlServerSide(url: string, options: string) {
        const result = await this.extCommon.scrapeURLUsingAPI(url, options);
        result.url = url;
        return result;
    }
    async runBulkAnalysis(rows: any[]) {
        let browserScrape = false;
        rows.forEach((row: any) => {
            if (row.scrape === "browser scrape") {
                browserScrape = true;
            }
        });
        if (browserScrape) {
            if (confirm("Browser scraping is enabled. This will open tabs in your browser to scrape the pages. Do you want to continue?") === false) {
                return;
            }
            await this.enabledBrowserScrapePermissions();
        }

        document.body.classList.add("extension_running");
        document.body.classList.remove("extension_not_running");
        const runId = new Date().toISOString();
        let urls: string[] = [];
        let promises: any[] = [];
        const activeTab = await chrome.tabs.getCurrent();
        rows.forEach((row: any) => {
            urls.push(row.url);
            promises.push(this.scrapeBulkUrl(row, activeTab.id));
        });

        let results = await Promise.all(promises);
        let analysisPromises: any[] = [];
        results.forEach((result: any, index: number) => {
            let text = "";
            if (result && result.text) text = result.text;
            if (result && result.length > 0 && result[0].text) text = result[0].text;
            if (!text) {
                analysisPromises.push(async () => {
                    return {
                        text: "No text found in page",
                        url: urls[index],
                        results: [],
                        runDate: new Date().toISOString(),
                        title: "",
                    };
                });
            } else {
                analysisPromises.push(this.extCommon.runAnalysisPrompts(text, urls[index], null, "selectedBulkAnalysisSets", false, result.title));
            }

        });
        let analysisResults = await Promise.all(analysisPromises);
        const fullCloudUploadResult = await this.extCommon.writeCloudDataUsingUnacogAPI(runId + ".json", analysisResults);

        let compactData: any[] = [];
        analysisResults.forEach((urlResult: any) => {
            let compactResult: any = {};
            compactResult.url = urlResult.url;
            compactResult.title = urlResult.title;

            const results = urlResult.results;
            if (results) {
                results.forEach((metricResult: any) => {
                    const fieldName = metricResult.prompt.id + "_" + metricResult.prompt.setName;
                    if (metricResult.prompt.promptType === "metric") {
                        let metric = 0;
                        try {
                            let json = JSON.parse(metricResult.result.resultMessage);
                            metric = json.contentRating;
                        } catch (e) {
                            metric = -1;
                        }
                        compactResult[fieldName] = metric;
                    } else {
                        compactResult[fieldName] = metricResult.result.resultMessage;
                    }
                });
            } else {
                compactResult["No Results"] = "No Results";
            }

            compactData.push(compactResult);
        });

        if (compactData.length > 0) {
            const firstRow = compactData[0];
            const allFields: any = {};
            compactData.forEach((row: any) => {
                Object.keys(row).forEach((field) => {
                    allFields[field] = true;
                });
            });
            const fieldNames = Object.keys(allFields);
            fieldNames.forEach((fieldName) => {
                if (!firstRow[fieldName]) {
                    firstRow[fieldName] = "";
                }
            });
        }

        const csv = Papa.unparse(compactData);
        const compactResult = await this.extCommon.writeCloudDataUsingUnacogAPI(runId, csv, "text/csv", "csv");
        document.body.classList.remove("extension_running");
        document.body.classList.add("extension_not_running");

        let bulkHistory = await chrome.storage.local.get('bulkHistory');
        let bulkHistoryRangeLimit = await chrome.storage.local.get('bulkHistoryRangeLimit');
        bulkHistoryRangeLimit = Number(bulkHistoryRangeLimit.bulkHistoryRangeLimit) || 100;
        bulkHistory = bulkHistory.bulkHistory || [];
        bulkHistory.unshift({
            runId,
            urls,
            compactResultPath: compactResult.publicStorageUrlPath,
            analysisResultPath: fullCloudUploadResult.publicStorageUrlPath,
        });
        bulkHistory = bulkHistory.slice(0, bulkHistoryRangeLimit);
        await chrome.storage.local.set({ bulkHistory });
    }
    async enabledBrowserScrapePermissions() {
        // Permissions must be requested from inside a user gesture, like a button's
        // click handler.
        await chrome.permissions.request({
            permissions: ["tabs"],
            origins: ["https://*/*",
                "http://*/*"]
        }, (granted: any) => {
            if (!granted) {
                alert("Browser scraping permission denied. You can enable it from the extension settings page");
            }
        });
    }

    async paintAnalysisHistory() {
        let bulkHistory = await chrome.storage.local.get('bulkHistory');
        bulkHistory = bulkHistory.bulkHistory || [];

        let bulkHistoryItem = bulkHistory[this.bulkSelectedIndex];
        if (bulkHistoryItem) {
            this.bulk_selected_last_run_date.innerHTML = this.extCommon.showGmailStyleDate(bulkHistoryItem.runId);
            
        } else {
            this.bulk_selected_last_run_date.innerHTML = "No selected entry";
        }
        let paginationHtml = this.generateBulkPagination(bulkHistory.length);
        this.bulk_history_pagination.innerHTML = paginationHtml;

        this.bulkHistoryEntryListItems = document.querySelectorAll('.bulk_history_pagination li a') as NodeListOf<HTMLLIElement>;
        this.bulkHistoryEntryListItems.forEach((item: any) => {
            item.addEventListener('click', async (e: any) => {
                e.preventDefault();
                const index = Number(item.dataset.entryindex);
                if (index === -1) {
                    this.currentPageIndex = Math.max(this.currentPageIndex - 1, 0);
                } else if (index === -2) {
                    this.currentPageIndex = Math.min(this.currentPageIndex + 1, Math.ceil(bulkHistory.length / this.itemsPerView) - 1);
                } else {
                    this.bulkSelectedIndex = index;
                    this.currentPageIndex = Math.floor(this.bulkSelectedIndex / this.itemsPerView);
                }
                this.paintAnalysisHistory();
            });
        });

    }
    generateBulkPagination(totalItems: number) {
        const currentEntryIndex = this.bulkSelectedIndex;
        const totalPages = Math.ceil(totalItems / this.itemsPerView);


        let paginationHtml = '';

        paginationHtml = '<ul class="pagination pagination-sm mb-0">';

        paginationHtml += `<li class="page-item ${this.currentPageIndex === 0 ? 'buttondisabled' : ''}">
            <a class="page-link" href="#" aria-label="Previous" data-entryindex="-1">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>`;
        const startIndex = this.currentPageIndex * this.itemsPerView;
        const endIndex = Math.min((this.currentPageIndex + 1) * this.itemsPerView, totalItems);
        for (let i = startIndex; i < endIndex; i++) {
            paginationHtml += `<li class="page-item ${currentEntryIndex === i ? 'selected' : ''}">
            <a class="page-link" href="#" data-entryindex="${i}">
                <span aria-hidden="true">${i + 1}</span>
            </a>
        </li>`;
        }
        paginationHtml += `<li class="page-item ${this.currentPageIndex === totalPages - 1 ? 'buttondisabled' : ''}">
            <a class="page-link" href="#" aria-label="Next" data-entryindex="-2">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>`;

        paginationHtml += '</ul>';

        return paginationHtml;
    }
    async paintBulkURLList(forceUpdate = false) {
        //only continue if debounce timer is up
        if (this.lastTableEdit.getTime() > new Date().getTime() - 1000 && !forceUpdate) {
            return;
        }
        let allUrls: any[] = [];
        let rawData = await chrome.storage.local.get('bulkUrlList');
        if (rawData && rawData.bulkUrlList && Object.keys(rawData.bulkUrlList).length > 0) {
            allUrls = rawData.bulkUrlList;
        }

        this.bulk_url_list_tabulator.setData(allUrls);

        let running = await chrome.storage.local.get('running');
        if (running && running.running) {
            document.body.classList.add("extension_running");
            document.body.classList.remove("extension_not_running");
        } else {
            document.body.classList.remove("extension_running");
            document.body.classList.add("extension_not_running");
        }

        const setNames = await this.extCommon.getAnalysisSetNames();
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
        if (this.previousSlimOptions !== slimOptionsString) {
            this.bulkSelected.setData(slimOptions);
            this.previousSlimOptions = slimOptionsString;
        }

        if (selectedBulkAnalysisSets && selectedBulkAnalysisSets.selectedBulkAnalysisSets) {
            this.bulkSelected.setSelected(selectedBulkAnalysisSets.selectedBulkAnalysisSets);
            let domSelections = this.bulkSelected.render.main.values.querySelectorAll('.ss-value');
            let indexMap: any = {};
            domSelections.forEach((item: any, index: any) => {
                indexMap[item.innerText] = index;
            });
            let setOrder = selectedBulkAnalysisSets.selectedBulkAnalysisSets;
            setOrder.forEach((setName: any, index: any) => {
                let domIndex = indexMap[setName];
                if (domSelections[domIndex]) {
                    this.bulkSelected.render.main.values.appendChild(domSelections[domIndex]);
                }
            });
        }
        if (this.bulkSelected.getSelected().length === 0) {
            this.bulkSelected.setSelected([setNames[0]]);
        }
    }
}