import { AnalyzerExtensionCommon } from './extensioncommon';
import { TabulatorFull } from 'tabulator-tables';
import SlimSelect from 'slim-select';
import Papa from 'papaparse';
declare const chrome: any;

export default class MainPageApp {
    extCommon = new AnalyzerExtensionCommon(chrome);
    api_token_input = document.querySelector('.api_token_input') as HTMLInputElement;
    session_id_input = document.querySelector('.session_id_input') as HTMLInputElement;
    importButton = document.querySelector('.import_rows') as HTMLButtonElement;
    fileInput = document.getElementById('file_input') as HTMLInputElement;
    exportButton = document.querySelector('.export_rows') as HTMLButtonElement;
    clearStorageButton = document.querySelector('.reset_chrome_storage') as HTMLButtonElement;
    wizard_input_prompt = document.querySelector('.wizard_input_prompt') as HTMLInputElement;
    add_prompt_modal = document.querySelector('.add_prompt_modal') as HTMLButtonElement;
    prompt_row_index = document.querySelector('.prompt_row_index') as HTMLInputElement;
    generate_metric_prompt = document.querySelector('.generate_metric_prompt') as HTMLButtonElement;
    show_test_prompt_modal = document.querySelector('.show_test_prompt_modal') as HTMLButtonElement;
    test_metric_container = document.querySelector('.test_metric_container') as HTMLDivElement;
    session_anchor_label = document.querySelector('.session_anchor_label') as HTMLDivElement;
    session_anchor = document.querySelector('.session_anchor') as HTMLAnchorElement;
    create_prompt_tab = document.getElementById('create-prompt-tab') as HTMLButtonElement;
    prompt_id_input = document.querySelector('.prompt_id_input') as HTMLInputElement;
    prompt_description = document.querySelector('.prompt_description') as HTMLInputElement;
    prompt_type = document.querySelector('.prompt_type') as HTMLInputElement;
    prompt_template_text = document.querySelector('.prompt_template_text') as HTMLInputElement;
    user_prompt_library = document.querySelector('.user_prompt_library') as HTMLDivElement;
    save_to_library_button = document.querySelector('.save_to_library_button') as HTMLButtonElement;
    prompt_setname_input = document.querySelector('.prompt_setname_input') as HTMLInputElement;
    input_datalist_prompt_list = document.querySelector('#input_datalist_prompt_list') as HTMLDataListElement;
    query_source_text = document.querySelector('.query_source_text') as HTMLTextAreaElement;
    run_analysis_btn = document.querySelector('.run_analysis_btn') as HTMLButtonElement;
    copy_to_clipboard_btn = document.querySelector('.copy_to_clipboard_btn') as HTMLButtonElement;
    export_history = document.querySelector('.export_history') as HTMLButtonElement;
    clear_history = document.querySelector('.clear_history') as HTMLButtonElement;
    history_range_amount_select = document.querySelector('.history_range_amount_select') as HTMLSelectElement;
    promptsTable: any;
    prompt_list_editor = document.querySelector('.prompt_list_editor') as HTMLDivElement;
    entry_total_credit_usage = document.querySelector('.entry_total_credit_usage') as HTMLDivElement;
    history_pagination = document.querySelector('.history_pagination') as HTMLDivElement;
    historyDisplay = document.querySelector('.history_display') as HTMLDivElement;
    history_date = document.querySelector('.history_date') as HTMLDivElement;
    manage_history_configuration = document.querySelector('.manage_history_configuration') as HTMLButtonElement;
    previousSlimOptions = "";
    bulk_analysis_sets_select: any = document.querySelector('.bulk_analysis_sets_select');
    bulkSelected: SlimSelect;
    bulk_url_list_tabulator: TabulatorFull;
    add_bulk_url_row = document.querySelector('.add_bulk_url_row') as HTMLButtonElement;
    run_bulk_analysis_btn = document.querySelector('.run_bulk_analysis_btn') as HTMLButtonElement;
    bulk_analysis_results_history = document.querySelector('.bulk_analysis_results_history') as HTMLDivElement;
    download_url_list = document.querySelector('.download_url_list') as HTMLButtonElement;
    upload_url_list = document.querySelector('.upload_url_list') as HTMLButtonElement;
    url_file_input = document.getElementById('url_file_input') as HTMLInputElement;
    enable_browser_scraping_btn = document.querySelector('.enable_browser_scraping_btn') as HTMLButtonElement;
    lastTableEdit = new Date();
    runId = '';
    activeTab: any = null;
    chromeTabListener: any = null;
    activeTabsBeingScraped: any = [];
    currentPage = 1;
    itemsPerPage = 1;

    constructor() {
        // helper constructors
        this.bulk_url_list_tabulator = new TabulatorFull(".bulk_url_list_tabulator", {
            layout: "fitColumns",
            movableRows: true,
            rowHeader: { headerSort: false, resizable: false, minWidth: 30, width: 30, rowHandle: true, formatter: "handle" },
            columns: [
                { title: "URL", field: "url", editor: "input", headerSort: false },
                {
                    title: "Options",
                    field: "options",
                    headerSort: false,
                    editor: "list",
                    editorParams: {
                        values: {
                            "server scrape": "Server Scrape",
                            "browser scrape": "Browser Scrape",
                        },
                    },
                    width: 120,
                }, {
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

        this.extCommon.initCommonDom();
        this.initEventHandlers();
        this.initPromptTable();
        this.hydrateAllPromptRows();

        // for detecting in browser scraping completion
        chrome.tabs.onUpdated.addListener(
            (tabId: number, changeInfo: any, tab: any) => {
                console.log(tabId, changeInfo, tab);
                if (this.activeTabsBeingScraped[tabId] && changeInfo.status === "complete") {
                    console.log("Tab loaded", tabId);
                    this.activeTabsBeingScraped[tabId]();
                }
            }
        );

        // list for changes to local storage and update the UI
        chrome.storage.local.onChanged.addListener(() => {
            this.paintData();
        });
        this.paintData(true);
    }
    initEventHandlers() {
        this.api_token_input.addEventListener('input', async (e) => {
            let apiToken = this.api_token_input.value;
            chrome.storage.local.set({ apiToken });
        });
        this.session_id_input.addEventListener('input', async (e) => {
            let sessionId = this.session_id_input.value;
            chrome.storage.local.set({ sessionId });
        });
        this.importButton.addEventListener('click', () => {
            document.getElementById('file_input')?.click();
        });

        this.fileInput.addEventListener('change', async (e: any) => {
            let file = e.target.files[0];
            let reader = new FileReader();
            reader.onload = async (e: any) => {
                let promptTemplateList = JSON.parse(e.target.result);
                let existingPrompts = await this.promptsTable.getData();
                promptTemplateList = existingPrompts.concat(promptTemplateList);
                await chrome.storage.local.set({ masterAnalysisList: promptTemplateList });
                this.hydrateAllPromptRows();
                this.fileInput.value = ''; // Reset the file input value
            };
            reader.readAsText(file);
        });

        this.history_pagination.addEventListener('click', async (e: any) => {
            let target = e.target;
            if (target.tagName === 'A') {
                this.currentPage = Number(target.textContent);
                this.renderHistoryDisplay();
            }
        });

        this.history_range_amount_select.addEventListener('click', async (e) => {
            let amount = this.history_range_amount_select.value;
            chrome.storage.local.set({ historyRangeLimit: amount });
        });

        this.exportButton.addEventListener('click', async () => {
            let promptTemplateList = await this.promptsTable.getData();
            let blob = new Blob([JSON.stringify(promptTemplateList)], { type: "application/json" });
            let url = URL.createObjectURL(blob);
            let a = document.createElement('a');
            a.href = url;
            a.download = 'allprompts.json';
            a.click();
            URL.revokeObjectURL(url);
        });

        this.clearStorageButton.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all data? This will clear your session key. If you have custom prompts, download first.')) {
                await chrome.storage.local.clear();
                location.reload();
            }
        });

        this.clear_history.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all history?')) {
                await chrome.storage.local.set({ history: [] });
                this.renderHistoryDisplay();
            }
        });

        this.export_history.addEventListener('click', async () => {
            let history = await chrome.storage.local.get('history');
            history = history.history || [];
            let blob = new Blob([JSON.stringify(history)], { type: "application/json" });
            let url = URL.createObjectURL(blob);
            let a = document.createElement('a');
            document.body.appendChild(a);
            a.href = url;
            a.download = 'history.json';
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        });

        this.run_analysis_btn.addEventListener('click', async () => {
            let text = this.query_source_text.value;
            let result: any = await this.extCommon.runAnalysisPrompts(text, 'Manual');
            let html = '';
            for (let promptResult of result.results) {
                html += this.extCommon.getHTMLforPromptResult(promptResult);
            }
        });

        this.copy_to_clipboard_btn.addEventListener('click', async () => {
            let text = this.query_source_text.value;
            navigator.clipboard.writeText(text);
        });

        this.add_prompt_modal.addEventListener('click', async () => {
            this.prompt_setname_input.value = '';
            this.prompt_id_input.value = '';
            this.prompt_description.value = '';
            this.prompt_type.value = '';
            this.prompt_template_text.value = '';
            this.prompt_row_index.value = '-1';
            this.wizard_input_prompt.value = '';
            this.prompt_id_input.focus();
            this.getAnalysisSetNameList();
        });

        this.manage_history_configuration.addEventListener('click', async () => {
            document.getElementById('history-tab')?.click();
        });

        this.generate_metric_prompt.addEventListener('click', async () => {
            this.prompt_template_text.value = `generating prompt...`;
            let text = this.wizard_input_prompt.value;
            document.getElementById('wizard-prompt-tab')?.click();
            let newPrompt = '';
            if (this.prompt_type.value === 'metric') {
                newPrompt = await this.extCommon.getMetricPromptForDescription(text);
            } else if (this.prompt_type.value === 'keywords') {
                newPrompt = await this.extCommon.getKeywordPromptForDescription(text);
            } else if (this.prompt_type.value === 'shortsummary') {
                newPrompt = await this.extCommon.getSummaryPromptForDescription(text);
                console.log('shortSummary', newPrompt);
            };
            this.prompt_template_text.value = newPrompt;
        });

        this.save_to_library_button.addEventListener('click', async () => {
            this.savePromptEditPopup();
            var myModalEl = document.getElementById('promptWizard');
            var modal = (<any>window).bootstrap.Modal.getInstance(myModalEl);
            modal.hide();
        });

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
            bulkUrlList.push({ url: "", options: "server scrape"});
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
            await this.runBulkAnalysis();
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

        this.enable_browser_scraping_btn.addEventListener('click', async () => {
            // Permissions must be requested from inside a user gesture, like a button's
            // click handler.
            chrome.permissions.request({
                permissions: ["activeTab", "tabs"],
                origins: ["https://*/*",
                    "http://*/*"]
            }, (granted: any) => {
                // The callback argument will be true if the user granted the permissions.
                if (granted) {
                    alert("Browser scraping enabled. You can now scrape pages using the browser scraping feature");
                } else {
                    alert("Browser scraping permission denied. You can enable it from the extension settings page");
                }
            });
        });
    }
    async hydrateAllPromptRows() {
        let allPrompts = await this.extCommon.getAnalysisPrompts();
        this.promptsTable.setData(allPrompts);
    }
    async savePromptEditPopup() {
        let promptId = this.prompt_id_input.value.trim();
        let promptDescription = this.prompt_description.value.trim();
        let promptSuggestion = this.wizard_input_prompt.value.trim();
        let promptType = this.prompt_type.value;
        let promptTemplate = this.prompt_template_text.value.trim();
        let setName = this.prompt_setname_input.value.trim();
        if (!promptId || !promptType || !promptTemplate || !setName) {
            alert('Please fill out all fields to add a prompt to the library.');
            document.getElementById('wizard-config-tab')?.click();
            return;
        }
        let prompt = { id: promptId, description: promptDescription, promptType: promptType, prompt: promptTemplate, setName, promptSuggestion };
        let promptTemplateList = await this.promptsTable.getData();
        let existingIndex = Number(this.prompt_row_index.value) - 1;
        if (existingIndex >= 0) {
            promptTemplateList[existingIndex] = prompt;
        } else {
            promptTemplateList.push(prompt);
        }

        await chrome.storage.local.set({ masterAnalysisList: promptTemplateList });
        this.hydrateAllPromptRows();
    }
    initPromptTable() {
        this.promptsTable = new TabulatorFull(".prompt_list_editor", {
            layout: "fitDataStretch",
            movableRows: true,
            groupBy: "setName",
            //            groupStartOpen: [false],
            groupHeader: (value: any, count: number, data: any, group: any) => {
                console.log("bbb", value, group);
                return value + `<span style='margin-left:10px'>(${count} item)</span><button class='export_metric_set btn' style='float:right;' data-setname='${value}'><i class="material-icons-outlined">download</i> </button>`;
            },
            columns: [
                { title: "Id", field: "id", headerSort: false, width: 100 },
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
                {
                    title: "",
                    field: "clone",
                    headerSort: false,
                    formatter: () => {
                        return `<i class="material-icons-outlined">copy_content</i>`;
                    },
                    hozAlign: "center",
                    width: 30,
                },
                {
                    title: "",
                    field: "edit",
                    headerSort: false,
                    formatter: () => {
                        return `<i class="material-icons-outlined">edit</i>`;
                    },
                    hozAlign: "center",
                    width: 30,
                },
                {
                    title: "",
                    field: "testone",
                    headerSort: false,
                    formatter: () => {
                        return `<i class="material-icons-outlined">bolt</i>`;
                    },
                    hozAlign: "center",
                    width: 30,
                },
                {
                    title: "Type", field: "promptType",
                    headerSort: false,
                },
                //       { title: "Description", field: "description", headerSort: false, width: 100 },
                { title: "Prompt", field: "prompt", headerSort: false, width: 100 },

            ],
        });
        this.promptsTable.on("renderComplete", () => {
            this.prompt_list_editor.querySelectorAll('.export_metric_set').forEach((button: any) => {
                if (!button.headerConfigured) {
                    button.headerConfigured = true;
                    button.addEventListener('click', async (e: any) => {
                        let setName = button.dataset.setname;
                        let promptTemplateList = await this.promptsTable.getData();
                        let setPrompts = promptTemplateList.filter((prompt: any) => prompt.setName === setName);
                        let blob = new Blob([JSON.stringify(setPrompts)], { type: "application/json" });
                        let url = URL.createObjectURL(blob);
                        let a = document.createElement('a');
                        a.href = url;
                        a.download = `${setName}_prompts.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                    });
                }
            });
        });
        this.promptsTable.on("cellClick", async (e: Event, cell: any) => {
            if (cell.getColumn().getField() === "delete") {
                if (this.promptsTable.getDataCount() <= 1) {
                    alert('You must have at least one prompt in the library.');
                } else {
                    if (confirm('Are you sure you want to delete this row?')) {
                        this.promptsTable.deleteRow(cell.getRow());
                        this.savePromptTableData();
                    }
                }
            }
            if (cell.getColumn().getField() === "testone") {
                const row = cell.getRow();
                const prompt = row.getData();
                let text = this.query_source_text.value;
                let result: any = await this.extCommon.runAnalysisPrompts(text, 'Manual', prompt);
                let promptResult = result.results[0];
                let promptId = promptResult.prompt.id;
                let promptTemplate = promptResult.prompt.prompt;
                let promptType = promptResult.prompt.promptType;
                let promptHtml = this.extCommon.getHTMLforPromptResult(promptResult);
                let html = `
                <div class="prompt_result">
                    <div class="prompt_header">
                        <span class="prompt_id">${promptId}</span>
                        <span class="prompt_type">${promptType}</span>
                    </div>
                    <div class="prompt_content">
                        <div class="prompt_text">${promptTemplate}</div>
                        <div class="result_content">${promptHtml}</div>
                    </div>
                </div>
                `;
                this.test_metric_container.innerHTML = html;
                this.show_test_prompt_modal.click();
            }
            if (cell.getColumn().getField() === "edit") {
                const row = cell.getRow();
                const prompt = row.getData();
                this.add_prompt_modal.click();
                this.prompt_id_input.value = prompt.id;
                this.prompt_description.value = prompt.description;
                this.prompt_type.value = prompt.promptType;
                this.prompt_template_text.value = prompt.prompt;
                this.prompt_setname_input.value = prompt.setName;
                this.wizard_input_prompt.value = prompt.promptSuggestion;
                let rowIndex = row.getPosition();
                this.prompt_row_index.value = rowIndex;
                this.getAnalysisSetNameList();
            }
            if (cell.getColumn().getField() === "clone") {
                const row = cell.getRow();
                const prompt = row.getData();
                let promptTemplateList = await this.promptsTable.getData();
                promptTemplateList.push(prompt);
                await chrome.storage.local.set({ masterAnalysisList: promptTemplateList });
                this.hydrateAllPromptRows();
            }
        });

        this.promptsTable.on("rowMoved", async (cell: any) => {
            this.savePromptTableData();
        });
    }
    async getAnalysisSetNameList() {
        let html = '';
        let promptSetNames = await this.extCommon.getAnalysisSetNames();
        promptSetNames.forEach((setName) => {
            html += `<option>${setName}</option>`;
        });
        this.input_datalist_prompt_list.innerHTML = html;
    }
    async savePromptTableData() {
        let masterAnalysisList = await this.promptsTable.getData();
        chrome.storage.local.set({ masterAnalysisList });
    }
    async renderSettingsTab() {
        let sessionConfig = await chrome.storage.local.get('sessionId');
        if (sessionConfig && sessionConfig.sessionId) {
            (<any>document.querySelector('.no_session_key')).style.display = 'none';
            this.session_anchor_label.innerHTML = 'Use link to visit Unacog Session: ';
            this.session_anchor.innerHTML = `Visit Session ${sessionConfig.sessionId}`;
            this.session_anchor.href = `https://unacog.com/session/${sessionConfig.sessionId}`;
            document.querySelector('#api-config-tab i')?.classList.remove('api-key-warning');
        } else {
            (<any>document.querySelector('.no_session_key')).style.display = 'block';
            this.session_anchor_label.innerHTML = 'Visit Unacog:';
            this.session_anchor.innerHTML = `Get Started`;
            this.session_anchor.href = `https://unacog.com/klyde`;
            (<any>document.querySelector('#api-config-tab i')).classList.add('api-key-warning');
        }

        let sessionId = await chrome.storage.local.get('sessionId');
        sessionId = sessionId.sessionId || '';
        this.session_id_input.value = sessionId;

        let apiToken = await chrome.storage.local.get('apiToken');
        apiToken = apiToken.apiToken || '';
        this.api_token_input.value = apiToken;
    }
    async renderHistoryDisplay() {
        let historyRangeLimit = await chrome.storage.local.get('historyRangeLimit');
        historyRangeLimit = historyRangeLimit.historyRangeLimit || 10;
        this.history_range_amount_select.value = historyRangeLimit;

        let history = await chrome.storage.local.get('history');
        history = history.history || [];

        let usageCreditTotal = 0;
        let entry = history[this.currentPage - 1];
        if (!entry) {
            return;
        }

        let renderResult = this.renderHTMLForHistoryEntry(entry, this.currentPage - 1);
        let entryHTML = renderResult.html;
        usageCreditTotal += renderResult.usageCreditTotal;
        this.entry_total_credit_usage.innerHTML = `<img src="media/logo16.png" alt="logo" style="position:relative;bottom:2px;">
                 Credits Used: ${Math.round(usageCreditTotal)}`;
        this.history_date.innerHTML = this.showGmailStyleDate(entry.runDate);

        this.historyDisplay.innerHTML = entryHTML;

        this.historyDisplay.querySelectorAll('.export_history_entry').forEach((button: any) => {
            button.addEventListener('click', async (e: any) => {
                let index = e.target.dataset.index;
                let entry = history[index];
                let blob = new Blob([JSON.stringify(entry)], { type: "application/json" });
                let url = URL.createObjectURL(blob);
                let a = document.createElement('a');
                document.body.appendChild(a);
                a.href = url;
                a.download = `history_entry_${index}.json`;
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            });
        });

        let paginationHtml = this.generatePagination(history.length, this.itemsPerPage, this.currentPage);
        this.history_pagination.innerHTML = paginationHtml;
    }
    renderHTMLForHistoryEntry(entry: any, historyIndex: number): {
        html: string;
        usageCreditTotal: number;
    } {
        let usageCreditTotal = 0;
        let resultHistory = entry.result;
        if (!resultHistory) resultHistory = entry.results[0];

        let uniqueSetNames: any = {};
        entry.results.forEach((result: any) => {
            uniqueSetNames[result.prompt.setName] = true;
        });
        uniqueSetNames = Object.keys(uniqueSetNames);
        let setNames = uniqueSetNames.join(', ');
        let html = `
        <div class="history_entry_header">
        <div class="history_text">${this.truncateText(entry.text, 500)}</div>
        <div class="history_header">
            <span class="url_display">(${this.truncateText(entry.url, 100)})</span>
            <button class="export_history_entry btn_menu_action" data-index="${historyIndex}">
                <i class="material-icons-outlined small_icon">download</i>
            </button>
        </div>
        </div>
            <div class="history_results">`;
        let allResults = entry.results;
        let setBasedResults: any = {};
        allResults.forEach((result: any) => {
            if (!setBasedResults[result.prompt.setName]) {
                setBasedResults[result.prompt.setName] = [];
            }
            setBasedResults[result.prompt.setName].push(result);
        });
        const setNamesArray = Object.keys(setBasedResults);
        setNamesArray.forEach((setName: any) => {
            html += `<h6 class="">${setName}</h6>`;
            let promptSetResults = setBasedResults[setName];
            promptSetResults.forEach((result: any) => {
                usageCreditTotal += result.result.promptResult.ticketResults.usage_credits;
            });

            for (let result of promptSetResults) {
                html += this.extCommon.getHTMLforPromptResult(result);
            }
        });
        html += `</div>`;
        return {
            html,
            usageCreditTotal,
        };
    }
    generatePagination(totalItems: number, itemsPerPage: number, currentPage: number, pagesBeforeAfter: number = 9) {
        let totalPages = Math.ceil(totalItems / itemsPerPage);
        let paginationHtml = '';

        if (totalPages <= 1) {
            return paginationHtml;
        }

        paginationHtml = '<ul class="pagination pagination-sm mb-0">';

        for (let i = 1; i <= totalPages; i++) {
            if (
                i === 1 ||
                i === totalPages ||
                (i >= currentPage - pagesBeforeAfter && i <= currentPage + pagesBeforeAfter)
            ) {
                paginationHtml += `
                    <li class="page-item ${i === currentPage ? 'active' : ''}">
                        <a class="page-link" href="#">${i}</a>
                    </li>
                `;
            } else if (i === 2 || i === totalPages - 1) {
                paginationHtml += `
                    <li class="page-item disabled">
                        <a class="page-link" href="#">...</a>
                    </li>
                `;
            }
        }

        paginationHtml += '</ul>';

        return paginationHtml;
    }
    truncateText(text: any, maxLength: any) {
        if (!text) return '';
        if (text.length <= maxLength) {
            return text;
        }
        return text.slice(0, maxLength) + '...';
    }
    formatAMPM(date: any) {
        let hours = date.getHours();
        let minutes = date.getMinutes();
        const ampm = hours >= 12 ? "pm" : "am";
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? "0" + minutes : minutes;
        return hours + ":" + minutes + " " + ampm;
    }
    showGmailStyleDate(ISOdate: any, amFormat = false) {
        let date = new Date(ISOdate);
        if (Date.now() - date.getTime() < 24 * 60 * 60 * 1000) {
            if (amFormat) return this.formatAMPM(date);

            let result = this.formatAMPM(date);
            return result;
        }

        return date.toLocaleDateString("en-us", {
            month: "short",
            day: "numeric",
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
    async scrapeBulkUrl(bulkUrl: any) {
        let options = bulkUrl.options;
        let url = bulkUrl.url;
        if (options === "server scrape") {
            const result = await this.scrapeUrlServerSide(url);
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
        } else {
            return this.scrapeTabPage(url);
        }
    }
    async scrapeUrlServerSide(url: string, options = "") {
        const result = await this.extCommon.scrapeURLUsingAPI(url, options);
        console.log("scrapeUrlServerSide", result); 
        return result;
    }
    async runBulkAnalysis() {
        document.body.classList.add("extension_running");
        document.body.classList.remove("extension_not_running");
        this.runId = new Date().toISOString();
        let rows = this.bulk_url_list_tabulator.getData();
        let urls: string[] = [];
        let promises: any[] = [];
        // cache the active tab
        this.activeTab = await chrome.tabs.getCurrent();
        rows.forEach((row: any) => {
            promises.push(this.scrapeBulkUrl(row));
        });

        let results = await Promise.all(promises);
        let analysisPromises: any[] = [];
        results.forEach((result: any, index: number) => {
            let text = "";
            if (result && result.text) text = result.text;
            if (result && result.length > 0 && result[0].text) text = result[0].text;
            if (!text) {
                console.log("invalid", result);
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
                console.log("valid", result);
                analysisPromises.push(this.extCommon.runAnalysisPrompts(text, urls[index], null, "selectedBulkAnalysisSets", false, result.title));
            }

        });
        let analysisResults = await Promise.all(analysisPromises);
        const fullCloudUploadResult = await this.extCommon.writeCloudDataUsingUnacogAPI(this.runId + ".json", analysisResults);

        let compactData: any[] = [];
        analysisResults.forEach((urlResult: any) => {
            let compactResult: any = {};
            compactResult.url = urlResult.url;
            compactResult.title = urlResult.title;

            const results = urlResult.results;
            if (results) {
                results.forEach((metricResult: any) => {
                    const fieldName = metricResult.prompt.id + "_" + metricResult.prompt.setName;
                    console.log(fieldName, metricResult.result);
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
        const compactResult = await this.extCommon.writeCloudDataUsingUnacogAPI(this.runId, csv, "text/csv", "csv");
        document.body.classList.remove("extension_running");
        document.body.classList.add("extension_not_running");

        let bulkHistory = await chrome.storage.local.get('bulkHistory');
        let bulkHistoryRangeLimit = await chrome.storage.local.get('bulkHistoryRangeLimit');
        bulkHistoryRangeLimit = Number(bulkHistoryRangeLimit.bulkHistoryRangeLimit) || 100;
        bulkHistory = bulkHistory.bulkHistory || [];
        bulkHistory.unshift({
            runId: this.runId,
            urls,
            compactResultPath: compactResult.publicStorageUrlPath,
            analysisResultPath: fullCloudUploadResult.publicStorageUrlPath,
        });
        bulkHistory = bulkHistory.slice(0, bulkHistoryRangeLimit);
        await chrome.storage.local.set({ bulkHistory });
    }
    async scrapeTabPage(url: any) {
        return new Promise(async (resolve, reject) => {

            let tab = await chrome.tabs.create({
                url
            });

            chrome.tabs.update(this.activeTab.id, { active: true })


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
    async detectTabLoaded(tabId: number) {
        return new Promise((resolve, reject) => {
            this.activeTabsBeingScraped[tabId] = resolve;
        });
    }
    analysisHistoryLogRowTemplate(historyItem: any, index: number): string {
        return `
          url count: ${historyItem.urls.length} <br>
          run date: ${new Date(historyItem.runId).toLocaleString()} <br> 
          <button class="download_full_json btn" data-index="${index}">download full JSON</button>
          <button class="download_compact_csv btn" data-index="${index}">download compact CSV</button>
          <hr>
        `;
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
    async paintData(forceUpdate = false) {
        await this.extCommon.paintAnalysisTab();
        this.renderSettingsTab();
        this.renderHistoryDisplay();
        this.paintAnalysisHistory();

        await this.paintBulkURLList(forceUpdate);
    }
    async paintAnalysisHistory() {
        let bulkHistory = await chrome.storage.local.get('bulkHistory');
        bulkHistory = bulkHistory.bulkHistory || [];
        let html = "";
        bulkHistory.forEach((historyItem: any, index: number) => {
            html += this.analysisHistoryLogRowTemplate(historyItem, index);
        });
        this.bulk_analysis_results_history.innerHTML = html;
        this.bulk_analysis_results_history.querySelectorAll('.download_full_json').forEach((item: any) => {
            item.addEventListener('click', async () => {
                let index = item.getAttribute('data-index');
                let bulkHistory = await chrome.storage.local.get('bulkHistory');
                bulkHistory = bulkHistory.bulkHistory || [];
                let historyItem = bulkHistory[index];
                let a = document.createElement('a');
                document.body.appendChild(a);
                a.href = historyItem.analysisResultPath;
                a.click();
                document.body.removeChild(a);
            });
        });
        this.bulk_analysis_results_history.querySelectorAll('.download_compact_csv').forEach((item: any) => {
            item.addEventListener('click', async () => {
                let index = item.getAttribute('data-index');
                let bulkHistory = await chrome.storage.local.get('bulkHistory');
                bulkHistory = bulkHistory.bulkHistory || [];
                let historyItem = bulkHistory[index];
                let a = document.createElement('a');
                document.body.appendChild(a);
                a.href = historyItem.compactResultPath;
                a.click();
                document.body.removeChild(a);
            });
        });
    }
}
