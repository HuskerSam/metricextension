import { AnalyzerExtensionCommon } from './extensioncommon';
import { MetricCommon } from './metriccommon';
import MainPageApp from './mainpageapp';
import { TabulatorFull } from 'tabulator-tables';
import Split from 'split.js';
declare const chrome: any;

export default class PromptHelper {
    app: MainPageApp;
    extCommon: AnalyzerExtensionCommon;
    metricCommon: MetricCommon;
    leftrightSplitter: Split.Instance;
    wizard_input_prompt = document.querySelector('.wizard_input_prompt') as HTMLInputElement;
    prompt_row_index = document.querySelector('.prompt_row_index') as HTMLInputElement;
    generate_metric_prompt = document.querySelector('.generate_metric_prompt') as HTMLButtonElement;
    test_metric_container = document.querySelector('.test_metric_container') as HTMLDivElement;
    test_modal = document.querySelector('.test_modal') as HTMLDivElement;
    create_prompt_tab = document.getElementById('create-prompt-tab') as HTMLButtonElement;
    prompt_id_input = document.querySelector('.prompt_id_input') as HTMLInputElement;
    template_type = document.querySelector('.template_type') as HTMLInputElement;
    prompt_template_text = document.querySelector('.prompt_template_text') as HTMLInputElement;
    user_prompt_library = document.querySelector('.user_prompt_library') as HTMLDivElement;
    save_override_checkbox = document.querySelector('.save_override_checkbox') as HTMLInputElement;
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
    wizard_template_tab_input = document.querySelector('.wizard_template_tab_input') as HTMLInputElement;
    prompt_template_tab_input = document.querySelector('.prompt_template_tab_input') as HTMLInputElement;
    prompt_template_tab = document.querySelector('.prompt_template_tab') as HTMLDivElement;
    wizard_template_tab = document.querySelector('.wizard_template_tab') as HTMLDivElement;
    promptsTable: TabulatorFull;
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
       
        this.promptsTable = new TabulatorFull(".tabulator_prompt_list_manager", {
            layout: "fitDataStretch",
            movableRows: true,
            groupBy: "setName",
            resizableColumnGuide: true,
            selectableRows: 1,
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
            columns: [
                { title: "Id", field: "id", headerSort: false, width: 100 },
                {
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
                },
                {
                    title: "Type", field: "promptType",
                    headerSort: false,
                },
                //       { title: "Description", field: "description", headerSort: false, width: 100 },
                { title: "Prompt", field: "prompt", headerSort: false, width: 100 },

            ],
        });
        this.wizard_template_tab_input.addEventListener('click',
        async () => chrome.storage.local.set({ promptHelperPanelView: 'wizard' }));

        this.prompt_template_tab_input.addEventListener('click',
        async () => chrome.storage.local.set({ promptHelperPanelView: 'prompt' }));

        this.generate_metric_prompt.addEventListener('click', async () => {
            this.prompt_template_text.value = `generating prompt...`;
            let text = this.wizard_input_prompt.value;
            let newPrompt = '';
            this.wizard_template_tab_input.checked = true;
            if (this.template_type.value === 'metric') {
                newPrompt = await this.getMetricPromptForDescription(text);
            } else if (this.template_type.value === 'keywords') {
                newPrompt = await this.getKeywordPromptForDescription(text);
            } else if (this.template_type.value === 'shortsummary') {
                newPrompt = await this.getSummaryPromptForDescription(text);
            };
            this.prompt_template_text.value = newPrompt;
        });

        this.save_override_checkbox.addEventListener('click', (e: any) => {
            if (e.target.checked) {
                this.prompt_helper_save_prompt_button.innerText = 'Save Edit';
            } else {
                this.prompt_helper_save_prompt_button.innerText = 'Save New';
            }
        });

        this.prompt_helper_save_prompt_button.addEventListener('click', async () => {
             
            
            this.savePromptToLibrary();
        });

        this.promptTabs.addEventListener('click', (e: any) => {
            if (this.prompt_template_tab_input.checked === true) {
                this.prompthelper_tab_help_text.innerText = `Klyde uses prompts to help you analyze content. You can create your own prompts or import them from a file.`;
                } else if (this.wizard_template_tab_input.checked === true) {
                this.prompthelper_tab_help_text.innerText = `Use Klyde to help you generate prompts for content analysis.`;
            }
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

        this.importButton.addEventListener('click', () => {
            document.getElementById('prompt_list_file_input')?.click();
        });

        this.fileInput.addEventListener('change', async (e: any) => {
            let file = e.target.files[0];
            let reader = new FileReader();
            reader.onload = async (e: any) => {
                let promptTemplateList = JSON.parse(e.target.result);
                let existingPrompts = await this.promptsTable.getData();
                promptTemplateList = existingPrompts.concat(promptTemplateList);
                promptTemplateList = this.metricCommon.processPromptRows(promptTemplateList);
                await chrome.storage.local.set({ masterAnalysisList: promptTemplateList });
                this.hydrateAllPromptRows();
                this.fileInput.value = ''; // Reset the file input value
            };
            reader.readAsText(file);
        });
        this.initPromptTable();
        this.paintPromptTab();
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
        this.promptsTable.on("rowSelected", (row: any) => {
            const prompt = row.getData();
            this.prompt_id_input.value = prompt.id;
            this.template_type.value = prompt.promptType;
            this.prompt_template_text.value = prompt.prompt;
            this.prompt_setname_input.value = prompt.setName;
            this.wizard_input_prompt.value = prompt.promptSuggestion;
            let rowIndex = row.getPosition();
            this.prompt_row_index.value = rowIndex;
            this.getAnalysisSetNameList();
        });
        this.promptsTable.on("rowMoved", async (cell: any) => {
            this.savePromptTableData();
        });
    }
    async paintPromptTab() {
        this.hydrateAllPromptRows();
        let value = await this.extCommon.getStorageField("promptHelperPanelView") as string;
        if (value === 'prompt') {
            this.wizard_template_tab_input.classList.remove('active');
            this.prompt_template_tab_input.classList.add('active');
            this.prompt_template_tab_input.checked = true;
            this.wizard_template_tab.style.display = 'none';
            this.prompt_template_tab.style.display = '';
        } else {
            this.wizard_template_tab_input.classList.add('active');
            this.prompt_template_tab_input.classList.remove('active');
            this.wizard_template_tab_input.checked = true;
            this.wizard_template_tab.style.display = '';
            this.prompt_template_tab.style.display = 'none';
        }
    }
    setCacheString(allPrompts: any, other: any = {}) {
        const cacheString = JSON.stringify(allPrompts) + JSON.stringify(other);
        if (this.lastRenderedPromptsList === cacheString) return false;
        this.lastRenderedPromptsList = cacheString;
        return true;
    }
    async getSummaryPromptForDescription(description: string): Promise<string> {
        const newPromptAgent = `Please help me form a concise set of guidenlines for summarizing content based on the following description: ${description}`;
        let newPromptContent = (await this.extCommon.processPromptUsingUnacogAPI(newPromptAgent)).resultMessage;
        newPromptContent += `
      This summary should be no longer than 50 or more words. Use the following format to answer:
      Summary: [summary of content]
      Here is the content to analyze:
      {{query}}`;
        return newPromptContent;
    }
    async getKeywordPromptForDescription(description: string): Promise<string> {
        const newPromptAgent = `Please help form a concise set guidelines for keywords using following description: ${description}
        `;

        let newPromptContent = (await this.extCommon.processPromptUsingUnacogAPI(newPromptAgent)).resultMessage;
        newPromptContent += `Use the following format to answer, include up to 5: Keywords: [keyword1], [keyword2], [keyword3], ...
        Here is the content to analyze:
        {{query}}
        `;
        return newPromptContent;
    }
    async getMetricPromptForDescription(description: string): Promise<string> {
        const newPromptAgent = `Please help form a new concise set guidelines for scoring content.
        I would like one based on the following description: ${description}
        
        Here is an example of guidelines for scoring content containing propaganda for a web scraped article:
        Evaluate the provided web scraped article for linguistic indicators suggestive of propaganda rather than objective truth. Rely on research-backed linguistic markers while recognizing the limitations of text-based assessments. Specifically, consider:

        A. Defining Variable - Indicators of Propaganda 
        1. Loaded Language
            Description: Use of emotionally charged words to influence the reader.
            Indicators:  
                - Exaggerated or hyperbolic language.
                - Words that evoke strong positive or negative emotions.
    
        2. One-sided Argumentation  
            Description: Presenting only one perspective while ignoring or discrediting opposing views.
            Indicators:
                - Lack of balanced perspective or acknowledgment of counterarguments.
                - Dismissive or demeaning references to opposing viewpoints.
    
        3. Unverifiable Claims
            Description: Assertions made without supporting evidence or sources.
            Indicators:  
                - Statements presented as facts without citations or references.
                - Use of vague terms like "studies show" or "experts say" without specifics.
    
        4. Appeal to Fear or Anger
            Description: Attempts to provoke fear or anger to persuade the reader.
            Indicators:
                - Language that stokes anxiety, outrage or a sense of threat.
                - Portraying situations as dire to create a sense of urgency.
    
        5. Bandwagon Appeal
            Description: Suggesting an idea is valid because many people believe it.
            Indicators:  
                - References to the popularity of an idea as a substitute for evidence.
                - Encouraging conformity to a viewpoint to avoid being in the minority.
    
        6. Ad Hominem Attacks
            Description: Attacking the character of a person rather than engaging their arguments.
            Indicators:
                - Personal insults or disparaging remarks about individuals.
                - Dismissing ideas based on attacks on those proposing them.
    
        B. Scoring 
        a. Rating
            Scale:
                1-2 (Very Mild or Non-existent indicators): Propaganda indicators are either very mild or do not exist. If an indicator is non-existent within the article, score 1.
                3-4 (Low Indicators): Occasional use of propaganda techniques, but the article mostly presents information objectively. 
                5-7 (Moderate Indicators): Several instances of propaganda indicators, suggesting a clear bias and intent to persuade.
                8-10 (High Indicators): Pervasive use of propaganda techniques, with little to no attempt at objectivity or balanced reporting.
    
        b. Assigning Weight
            Weights:
            Loaded Language (20%): Emotionally charged language is a potent tool for swaying readers and a strong indicator of propaganda.
    
            One-sided Argumentation (20%): Failing to present a balanced perspective suggests an intent to promote a specific viewpoint rather than inform.
            
            Unverifiable Claims (15%): A lack of supporting evidence or sources raises questions about the credibility of the information presented.
            
            Appeal to Fear or Anger (15%): Provoking strong emotions can cloud judgment and is a common tactic in propaganda.
            
            Bandwagon Appeal (15%): Appealing to popularity rather than evidence is a weak argument and often used in propaganda.
            
            Ad Hominem Attacks (15%): Attacking individuals rather than engaging with their ideas is a diversionary tactic that undermines objectivity.
            
                After weighting, round to the nearest whole number and return that value in JSON 'score' response.
        
                After scoring, provide a comprehensive breakdown of the factors contributing to the score. Highlight the key passages or patterns that were particularly influential in the decision.`;

        let newPromptContent = (await this.extCommon.processPromptUsingUnacogAPI(newPromptAgent)).resultMessage;
        newPromptContent += ` 
        Please respond with json and only json in this format:
        {
          "contentRating": 0
        }
        
        Here is the content to analyze:
        {{query}}`;
        return newPromptContent;
    }
    async savePromptTableData() {
        let masterAnalysisList = await this.promptsTable.getData();
        chrome.storage.local.set({ masterAnalysisList });
    }
    async hydrateAllPromptRows() {
        const allPrompts = await this.metricCommon.getAnalysisPrompts();
        if (!this.setCacheString(allPrompts)) return;

        this.promptsTable.setData(allPrompts);
    }
    async savePromptToLibrary() {
        let promptId = this.prompt_id_input.value.trim();
        let promptSuggestion = this.wizard_input_prompt.value.trim();
        let templateType = this.template_type.value;
        let promptTemplate = this.prompt_template_text.value.trim();
        let setName = this.prompt_setname_input.value.trim();
        if (!promptId || !templateType || !promptTemplate || !setName) {
            alert('Please fill out all fields to add a prompt to the library.');
            return;
        }
        let promptType = "text";
        if (templateType === 'metric') promptType = "metric";
        if (templateType === 'json') promptType = "json";
        let prompt = { id: promptId, templateType, promptType, prompt: promptTemplate, setName, promptSuggestion };
        let promptTemplateList = await this.promptsTable.getData();
        const existingIndex = Number(this.prompt_row_index.value) - 1;
        if (this.save_override_checkbox.checked) {
            promptTemplateList[existingIndex] = prompt;
            const selectedRow = this.promptsTable.getRows()[existingIndex];
            selectedRow.update(prompt);
            selectedRow.select();
        } else {
            promptTemplateList.push(prompt);
        }

        promptTemplateList = this.metricCommon.processPromptRows(promptTemplateList);
        this.setCacheString(promptTemplateList);
        await chrome.storage.local.set({ masterAnalysisList: promptTemplateList });
    }
    async getAnalysisSetNameList() {
        let html = '';
        let promptSetNames = await this.metricCommon.getAnalysisSetNames();
        promptSetNames.forEach((setName) => {
            html += `<option>${setName}</option>`;
        });
        this.input_datalist_prompt_list.innerHTML = html;
    }
}