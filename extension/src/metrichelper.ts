import { AnalyzerExtensionCommon } from './extensioncommon';
import { MetricCommon } from './metriccommon';
import MainPageApp from './mainpageapp';
import { TabulatorFull } from 'tabulator-tables';
import { exampleMetrics } from './examplemetrics';
import Split from 'split.js';
declare const chrome: any;

export default class MetricHelper {
    app: MainPageApp;
    extCommon: AnalyzerExtensionCommon;
    metricCommon: MetricCommon;
    leftrightSplitter: Split.Instance;
    metricCreateSplitter: Split.Instance;
    promptsTable: TabulatorFull;
    metricTemplateExamples = exampleMetrics();
    wizard_input_prompt = document.querySelector('.wizard_input_prompt') as HTMLInputElement;
    generate_metric_prompt = document.querySelector('.generate_metric_prompt') as HTMLButtonElement;
    test_metric_container = document.querySelector('.test_metric_container') as HTMLDivElement;
    test_modal = document.querySelector('.test_modal') as HTMLDivElement;
    create_prompt_tab = document.getElementById('create-prompt-tab') as HTMLButtonElement;
    prompt_id_input = document.querySelector('.prompt_id_input') as HTMLInputElement;
    metric_template_text = document.querySelector('.metric_template_text') as HTMLInputElement;
    user_prompt_library = document.querySelector('.user_prompt_library') as HTMLDivElement;
    prompt_setname_input = document.querySelector('.prompt_setname_input') as HTMLInputElement;
    prompthelper_tab_help_text = document.querySelector('.prompthelper_tab_help_text') as HTMLDivElement;
    promptTabs = document.querySelector('#promptTabs') as HTMLDivElement;
    input_datalist_prompt_list = document.querySelector('#input_datalist_prompt_list') as HTMLDataListElement;
    importButton = document.querySelector('.prompt_list_import_rows') as HTMLButtonElement;
    fileInput = document.getElementById('prompt_list_file_input') as HTMLInputElement;
    tabulator_prompt_list_manager = document.querySelector('.tabulator_prompt_list_manager') as HTMLDivElement;
    exportButton = document.querySelector('.prompt_list_export_rows') as HTMLButtonElement;
    prompt_manager_left_pane = document.querySelector('.prompt_manager_left_pane') as HTMLDivElement;
    prompt_manager_right_pane = document.querySelector('.prompt_manager_right_pane') as HTMLDivElement;
    prompt_helper_save_prompt_button = document.querySelector('.prompt_helper_save_prompt_button') as HTMLButtonElement;
    metric_format_type = document.querySelector('.metric_format_type') as HTMLSelectElement;
    example_template_type = document.querySelector('.example_template_type') as HTMLSelectElement;
    template_preview_container = document.querySelector('.template_preview_container') as HTMLDivElement;
    copy_metric_example_template_to_create = document.querySelector('.copy_metric_example_template_to_create') as HTMLButtonElement;
    example_metric_type = document.querySelector('.example_metric_type') as HTMLDivElement;
    lastRenderedPromptsList = "";

    constructor(app: MainPageApp) {
        this.app = app;
        this.extCommon = app.extCommon;
        this.metricCommon = app.metricCommon;
        this.leftrightSplitter = Split([this.prompt_manager_left_pane, this.prompt_manager_right_pane],
            {
                sizes: [50, 50],
                direction: 'horizontal',
                gutterSize: 8,
            });
        this.metricCreateSplitter = Split([".metric_prompt_create_upper_panel", ".metric_prompt_create_lower_panel"],
            {
                sizes: [50, 50],
                direction: 'vertical',
                gutterSize: 8,
            });

        this.promptsTable = new TabulatorFull(".tabulator_prompt_list_manager", {
            layout: "fitDataStretch",
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
            groupBy: "setName",
            resizableColumnGuide: true,
            headerVisible: false,
            groupHeader: (value: any, count: number, data: any, group: any) => {
                return `
                <div class='inline-flex flex-1 justify-between items-center'>
                    <span>${value} (${count} item)</span>
                    <button class='export_metric_set btn_icon' style='float:right;' data-setname='${value}'>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                        </svg>
                    </button>
                </div>`;
            },
            columns: [{
                title: "Name",
                field: "name",
                headerSort: false,
                editor: "input",
                width: 100
            }, {
                title: "",
                field: "delete",
                headerSort: false,
                formatter: () => {
                    return `
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      `;
                },
                hozAlign: "center",
                width: 30,
            }, {
                title: "Metric Type",
                field: "metricType",
                editor: "list",
                editorParams: {
                    values: {
                        "score 0 - 10": "score 0 - 10",
                        "text": "text",
                        "json": "json",
                    },
                },
                headerSort: false,
            }, {
                title: "Template",
                field: "template",
                editor: "textarea",
                headerSort: false,
                width: 100,
            },
            ],
        });

        this.generate_metric_prompt.addEventListener('click', () => this.generateMetric());
        this.prompt_helper_save_prompt_button.addEventListener('click', () => this.addMetric());

        this.exportButton.addEventListener('click', async () => {
            let promptTemplateList = this.promptsTable.getData();
            let blob = new Blob([JSON.stringify(promptTemplateList)], { type: "application/json" });
            let url = URL.createObjectURL(blob);
            let a = document.createElement('a');
            a.href = url;
            a.download = 'allprompts.json';
            a.click();
            URL.revokeObjectURL(url);
        });

        this.importButton.addEventListener('click', () => {
            document.getElementById('prompt_list_file_input')?.click();
        });

        this.fileInput.addEventListener('change', async (e: any) => {
            let file = e.target.files[0];
            let reader = new FileReader();
            reader.onload = async (e: any) => {
                let promptTemplateList = JSON.parse(e.target.result);
                let existingPrompts = this.promptsTable.getData();
                promptTemplateList = existingPrompts.concat(promptTemplateList);
                await chrome.storage.local.set({ masterAnalysisList: promptTemplateList });
                this.fileInput.value = ''; // Reset the file input value
            };
            reader.readAsText(file);
        });

        let exampleOptionHTML = "";
        this.metricTemplateExamples.forEach((example, index) => {
            exampleOptionHTML += `<option>${example.title}</option>`;
        });
        this.example_template_type.innerHTML = exampleOptionHTML;
        this.example_template_type.selectedIndex = 0;
        this.example_template_type.addEventListener('change', () => {
            this.updateExampleTemplateSelection();
        });
        this.updateExampleTemplateSelection();

        this.copy_metric_example_template_to_create.addEventListener('click', () => {
            const t = this.getExampleMetric().template;
            this.metric_template_text.value = t;
            this.metric_format_type.value = this.getExampleMetric().metricType;
        });

        let metricTypeOptionHTML = "";
        this.metricCommon.metricTypes.forEach((type) => {
            metricTypeOptionHTML += `<option>${type}</option>`;
        });
        this.metric_format_type.innerHTML = metricTypeOptionHTML;
        this.metric_format_type.selectedIndex = 0;

        this.initPromptTable();
        this.paint();
    }
    async paint() {
        const allMetrics = await this.metricCommon.getAnalysisPrompts();
        if (this.setCacheString(allMetrics)) this.promptsTable.setData(allMetrics);

        this.populateAnalysisSetNameList();
    }
    getExampleMetric() {
        return this.metricTemplateExamples[this.example_template_type.selectedIndex];
    }
    updateExampleTemplateSelection() {
        this.template_preview_container.innerText = this.getExampleMetric().template;
        this.example_metric_type.innerText = this.getExampleMetric().metricType;
    }
    initPromptTable() {
        this.promptsTable.on("renderComplete", () => {
            this.tabulator_prompt_list_manager.querySelectorAll('.export_metric_set').forEach((button: any) => {
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
        });
        this.promptsTable.on("rowMoved", async (cell: any) => {
            this.savePromptTableData();
        });
        this.promptsTable.on("cellEdited", async (cell: any) => {
            this.savePromptTableData();
        });
    }
    setCacheString(allPrompts: any, other: any = {}) {
        const cacheString = JSON.stringify(allPrompts) + JSON.stringify(other);
        if (this.lastRenderedPromptsList === cacheString) return false;
        this.lastRenderedPromptsList = cacheString;
        return true;
    }
    async generateMetric() {
        const template = this.metricTemplateExamples[this.example_template_type.selectedIndex].template;
        const query = this.wizard_input_prompt.value;
        if (!template || !query) {
            alert('Please fill out the prompt and select a template.');
            return;
        }
        const newMetricTemplate = await this.metricCommon.generateMetricTemplate(template, query);
        this.metric_template_text.value = newMetricTemplate;
    }
    async savePromptTableData() {
        let masterAnalysisList = this.promptsTable.getData();
        chrome.storage.local.set({ masterAnalysisList });
    }
    async addMetric() {
        const name = this.prompt_id_input.value.trim();
        const metricType = this.metric_format_type.value;
        const template = this.metric_template_text.value.trim();
        const setName = this.prompt_setname_input.value.trim();
        if (!name || !template || !setName) {
            alert('Please fill out template, set name and name.');
            return;
        }
        const metric = { name, metricType, template, setName };
        this.promptsTable.addRow(metric);
        const metricList = this.promptsTable.getData();
        this.setCacheString(metricList);
        await chrome.storage.local.set({ masterAnalysisList: metricList });
    }
    async populateAnalysisSetNameList() {
        let html = '';
        let promptSetNames = await this.metricCommon.getAnalysisSetNames();
        promptSetNames.forEach((setName) => {
            html += `<option>${setName}</option>`;
        });
        this.input_datalist_prompt_list.innerHTML = html;
    }
}