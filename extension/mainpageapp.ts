import { AnalyzerExtensionCommon } from './extensioncommon';
import { TabulatorFull } from 'tabulator-tables';
import SlimSelect from 'slim-select';
import Papa from 'papaparse';
import BulkHelper from './bulkhelper';
declare const chrome: any;

export default class MainPageApp {
    extCommon = new AnalyzerExtensionCommon(chrome);
    bulkHelper = new BulkHelper();
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
    historyEntryListItems: any = null;
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
    open_side_panel_from_main = document.querySelector('.open_side_panel_from_main') as HTMLButtonElement;
    lastTableEdit = new Date();
    runId = '';
    activeTab: any = null;
    chromeTabListener: any = null;
    itemsPerView = 5;
    baseHistoryIndex = 0;
    currentPageIndex = 0;

    constructor() {
        // helper constructors
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

        this.extCommon.initCommonDom();
        this.initEventHandlers();
        this.initPromptTable();
        this.hydrateAllPromptRows();

        // list for changes to local storage and update the UI
        chrome.storage.local.onChanged.addListener(() => {
            this.paintData();
        });
        this.paintData(true);
    }
    initEventHandlers() {
        this.open_side_panel_from_main.addEventListener('click', async () => {
            this.activeTab = await chrome.tabs.getCurrent();
            chrome.sidePanel.open({ tabId: this.activeTab.id });
        });
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
            await this.bulkHelper.runBulkAnalysis(rows);
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
        let entry = history[this.baseHistoryIndex];
        let entryHTML = `
        <div class="history_empty">
            <p class="history_empty_onboarding_message">
                No history found. <br><br>
                Select metric and provide text input to begin.
            </p>
        </div>
        `;
        // if history is empty
        if (entry) {
            let renderResult = this.renderHTMLForHistoryEntry(entry, this.baseHistoryIndex);
            entryHTML = renderResult.html;
            usageCreditTotal += renderResult.usageCreditTotal;
            this.entry_total_credit_usage.innerHTML = `<img src="media/logo16.png" alt="logo" style="position:relative;bottom:2px;">
                     Credits Used: ${Math.round(usageCreditTotal)}`;
            this.history_date.innerHTML = this.showGmailStyleDate(entry.runDate);
        }

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

        let paginationHtml = this.generatePagination(history.length);

        this.history_pagination.innerHTML = paginationHtml;
        this.historyEntryListItems = document.querySelectorAll('.history_pagination li a') as NodeListOf<HTMLLIElement>;
        this.historyEntryListItems.forEach((item: any) => {
            item.addEventListener('click', async (e: any) => {
                e.preventDefault();
                const index = Number(item.dataset.entryindex);
                if (index === -1) {
                    this.currentPageIndex = Math.max(this.currentPageIndex - 1, 0);
                } else if (index === -2) {
                    this.currentPageIndex = Math.min(this.currentPageIndex + 1, Math.ceil(history.length / this.itemsPerView) - 1);
                } else {
                    this.baseHistoryIndex = index;
                    this.currentPageIndex = Math.floor(this.baseHistoryIndex / this.itemsPerView);
                }
                this.renderHistoryDisplay();
            });
        });
    }
    renderHTMLForHistoryEntry(entry: any, historyIndex: number): {
        html: string;
        usageCreditTotal: number;
    } {
        let usageCreditTotal = 0;
        let resultHistory = entry.result;
        if (!resultHistory) resultHistory = entry.results[0];

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
    generatePagination(totalItems: number) {
        const currentEntryIndex = this.baseHistoryIndex;
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
    analysisHistoryLogRowTemplate(historyItem: any, index: number): string {
        return `
          url count: ${historyItem.urls.length} <br>
          run date: ${new Date(historyItem.runId).toLocaleString()} <br> 
          <button class="download_full_json btn" data-index="${index}">download full JSON</button>
          <button class="download_compact_csv btn" data-index="${index}">download compact CSV</button>
          <hr>
        `;
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
