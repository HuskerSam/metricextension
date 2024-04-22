import { AnalyzerExtensionCommon } from './extensioncommon';
import { TabulatorFull } from 'tabulator-tables';
import Split from 'split.js';
declare const chrome: any;

export default class PromptHelper {
    extCommon = new AnalyzerExtensionCommon(chrome);
    viewSplitter: Split.Instance;
    wizard_input_prompt = document.querySelector('.wizard_input_prompt') as HTMLInputElement;
    add_prompt_modal = document.querySelector('.add_prompt_modal') as HTMLButtonElement;
    prompt_row_index = document.querySelector('.prompt_row_index') as HTMLInputElement;
    generate_metric_prompt = document.querySelector('.generate_metric_prompt') as HTMLButtonElement;
    test_metric_container = document.querySelector('.test_metric_container') as HTMLDivElement;
    test_modal = document.querySelector('.test_modal') as HTMLDivElement;
    create_prompt_tab = document.getElementById('create-prompt-tab') as HTMLButtonElement;
    prompt_id_input = document.querySelector('.prompt_id_input') as HTMLInputElement;
    prompt_description = document.querySelector('.prompt_description') as HTMLInputElement;
    prompt_type = document.querySelector('.prompt_type') as HTMLInputElement;
    prompt_template_text = document.querySelector('.prompt_template_text') as HTMLInputElement;
    user_prompt_library = document.querySelector('.user_prompt_library') as HTMLDivElement;
    save_to_library_button = document.querySelector('.save_to_library_button') as HTMLButtonElement;
    prompt_setname_input = document.querySelector('.prompt_setname_input') as HTMLInputElement;
    input_datalist_prompt_list = document.querySelector('#input_datalist_prompt_list') as HTMLDataListElement;
    importButton = document.querySelector('.prompt_list_import_rows') as HTMLButtonElement;
    fileInput = document.getElementById('prompt_list_file_input') as HTMLInputElement;
    prompt_list_editor = document.querySelector('.prompt_list_editor') as HTMLDivElement;
    exportButton = document.querySelector('.prompt_list_export_rows') as HTMLButtonElement;
    prompt_manager_lower_pane = document.querySelector('.prompt_manager_lower_pane') as HTMLDivElement;
    prompt_manager_upper_pane = document.querySelector('.prompt_manager_upper_pane') as HTMLDivElement;
    promptsTable: TabulatorFull;

    constructor() {
        this.viewSplitter = Split([this.prompt_manager_upper_pane, this.prompt_manager_lower_pane],
            {
                sizes: [50, 50],
                direction: 'vertical',
                minSize: 100, // min size of both panes
                gutterSize: 16,
            });

        this.promptsTable = new TabulatorFull(".prompt_list_editor", {
            layout: "fitDataStretch",
            movableRows: true,
            groupBy: "setName",
            resizableColumnGuide:true,
            selectableRows: 1,
            groupHeader: (value: any, count: number, data: any, group: any) => {
                return `
                <div class='inline-flex flex-1 justify-between'>
                    <span>${value} (${count} item)</span>
                    <button class='export_metric_set btn_icon' style='float:right;' data-setname='${value}'>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
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

        this.generate_metric_prompt.addEventListener('click', async () => {
            this.prompt_template_text.value = `generating prompt...`;
            let text = this.wizard_input_prompt.value;
            document.getElementById('wizard-prompt-tab')?.click();
            let newPrompt = '';
            if (this.prompt_type.value === 'metric') {
                newPrompt = await this.getMetricPromptForDescription(text);
            } else if (this.prompt_type.value === 'keywords') {
                newPrompt = await this.getKeywordPromptForDescription(text);
            } else if (this.prompt_type.value === 'shortsummary') {
                newPrompt = await this.getSummaryPromptForDescription(text);
            };
            this.prompt_template_text.value = newPrompt;
        });

        this.save_to_library_button.addEventListener('click', async () => {
            this.savePromptEditPopup();
            var myModalEl = document.getElementById('promptWizard');
            var modal = (<any>window).bootstrap.Modal.getInstance(myModalEl);
            modal.hide();
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
                await chrome.storage.local.set({ masterAnalysisList: promptTemplateList });
                this.hydrateAllPromptRows();
                this.fileInput.value = ''; // Reset the file input value
            };
            reader.readAsText(file);
        });
        this.initPromptTable();
        this.hydrateAllPromptRows();
    }
    initPromptTable() {
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
                let text = this.extCommon.query_source_text.value;
                (new (<any>window).bootstrap.Modal(this.test_modal)).show();
                (this.test_modal.querySelector('.modal-title') as any).innerHTML = `Testing Prompt: ${prompt.id}`;
                (this.test_metric_container as any).innerHTML = `<lottie-player src="media/lottie.json" background="transparent" speed="1"
                class="w-32 h-32 self-center" loop autoplay></lottie-player>`;
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
        this.promptsTable.on("rowSelected", (row: any) => {      
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
        });
        this.promptsTable.on("rowMoved", async (cell: any) => {
            this.savePromptTableData();
        });
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
        
        Here is an example of guidelines for scoring content based on political content:
        Label the following content 0-10, regarding its political content. 
        1: Barely Political - Mentions politics briefly, but doesn't go into details.
        2: Somewhat Political - Talks about political things, but stays neutral. Presents basic information without favoring one side.
        3: Moderately Political - Discusses political topics, but avoids strong opinions. Explains policies, figures, or events in a balanced way.
        4: Moderately Political (with Opinion) - Analyzes political issues with some personal viewpoint. Might slightly favor one side, but still mentions opposing views.
        5: More Political - Provides in-depth analysis of political issues with a clear perspective. Uses persuasive language to advocate for a specific viewpoint, but acknowledges other positions.
        6: Highly Political - Offers strong analysis of political issues with a clear stance. Uses persuasive language and arguments to promote a specific viewpoint.
        7: Very Political - Focuses heavily on controversial political themes and current events. May use strong emotions and persuasive language to spark debate. Considers some opposing viewpoints, but favors one heavily.
        8: Extremely Political - Centers on highly controversial political issues and current events. Uses strong emotions and potentially inflammatory language to provoke strong reactions. Presents a very narrow range of viewpoints.
        9: Exceedingly Political - Primarily promotes a specific political agenda. Uses highly charged language and potentially misleading information to influence opinion
        10: Pure Propaganda - Presents highly biased information to manipulate opinion. Uses extreme language and potentially false information to promote a specific political viewpoint.`;

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
    async getAnalysisSetNameList() {
        let html = '';
        let promptSetNames = await this.extCommon.getAnalysisSetNames();
        promptSetNames.forEach((setName) => {
            html += `<option>${setName}</option>`;
        });
        this.input_datalist_prompt_list.innerHTML = html;
    }
}