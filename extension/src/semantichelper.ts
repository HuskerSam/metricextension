import { AnalyzerExtensionCommon } from './extensioncommon';
import { SemanticCommon } from './semanticcommon';
import MainPageApp from './mainpageapp';
import { TabulatorFull } from 'tabulator-tables';
import Split from 'split.js';

declare const chrome: any;
export default class SemanticHelper {
    app: MainPageApp;
    extCommon: AnalyzerExtensionCommon;
    semanticCommon: SemanticCommon;
    semantic_analyze_embedded_prompt_btn = document.querySelector('.semantic_analyze_embedded_prompt_btn') as HTMLButtonElement;
    semantic_query_textarea = document.querySelector('.semantic_query_textarea') as HTMLTextAreaElement;
    summary_details = document.querySelector('.summary_details') as HTMLDivElement;
    semantic_embedded_llm_response = document.querySelector('.semantic_embedded_llm_response') as HTMLDivElement;
    llm_prompt_template_select_preset = document.querySelector('.llm_prompt_template_select_preset') as HTMLSelectElement;
    llm_prompt_template_text_area = document.querySelector('.llm_prompt_template_text_area') as HTMLTextAreaElement;
    llm_document_template_text_area = document.querySelector('.llm_document_template_text_area') as HTMLTextAreaElement;
    uniqueDocsCheck = document.body.querySelector(".uniqueDocsCheck") as HTMLInputElement;
    semantic_top_k_input = document.body.querySelector(".semantic_top_k_input") as HTMLInputElement;
    semantic_include_k_input = document.body.querySelector(".semantic_include_k_input") as HTMLInputElement;
    semantic_context_k_input = document.body.querySelector(".semantic_context_k_input") as HTMLInputElement;
    dmtab_change_session_select = document.querySelector(".dmtab_change_session_select") as HTMLSelectElement;
    semantic_chunk_results_container = document.querySelector(".semantic_chunk_results_container") as HTMLDivElement;
    run_semantic_search_query_button = document.querySelector(".run_semantic_search_query_button") as HTMLButtonElement;
    filter_container = document.body.querySelector(".filter_container") as HTMLDivElement;
    dmtab_add_meta_filter_select = document.body.querySelector(".dmtab_add_meta_filter_select") as HTMLSelectElement;
    top_semantic_view_splitter = document.body.querySelector(".top_semantic_view_splitter") as HTMLDivElement;
    bottom_semantic_view_splitter = document.body.querySelector(".bottom_semantic_view_splitter") as HTMLDivElement;
    prompt_view_top_splitter = document.body.querySelector(".prompt_view_top_splitter") as HTMLDivElement;
    prompt_view_bottom_splitter = document.body.querySelector(".prompt_view_bottom_splitter") as HTMLDivElement;
    semantic_dropdown_menu = document.body.querySelector(".semantic_dropdown_menu") as HTMLDivElement;
    semantic_embedding_dropdown_menu = document.body.querySelector(".semantic_embedding_dropdown_menu") as HTMLDivElement;
    llm_prompt_template_reset_preset_button = document.body.querySelector(".llm_prompt_template_reset_preset_button") as HTMLButtonElement;
    semantic_display_monospace_checkbox = document.body.querySelector(".semantic_display_monospace_checkbox") as HTMLInputElement;
    view_embedded_prompt_toggle = document.body.querySelector(".view_embedded_prompt_toggle") as HTMLInputElement;
    viewSplitter: Split.Instance;
    promptSubSplitter: Split.Instance;
    chunksTabulator: TabulatorFull;
    lastRenderedChunkCache = "";
    metadataFilterCache = "";
    semanticDetailsCache = "";

    constructor(app: MainPageApp) {
        this.app = app;
        this.extCommon = app.extCommon;
        this.semanticCommon = app.semanticCommon;
        this.load();
        this.uniqueDocsCheck.addEventListener("input", async () => {
            await chrome.storage.local.set({ uniqueSemanticDocs: this.uniqueDocsCheck.checked });
        });
        this.run_semantic_search_query_button.addEventListener("click", async () => {
            if (await this.extCommon.testSessionKeys() === false) return;
            this.semantic_query_textarea.select();
            await this.runSemanticQuery();
        });
        this.dmtab_change_session_select.addEventListener("input", async () => {
            if (await this.extCommon.testSessionKeys() === false) return;
            const selectedValue = this.dmtab_change_session_select.value;
            await this.semanticCommon.selectSemanticSource(selectedValue, true);
        });

        this.dmtab_add_meta_filter_select.addEventListener("change", async () => {
            if (await this.extCommon.testSessionKeys() === false) return;
            this.addMetaFilter();
        });

        this.viewSplitter = Split([this.top_semantic_view_splitter, this.bottom_semantic_view_splitter], {
            sizes: [50, 50],
            direction: 'horizontal',
            gutterSize: 8,
        });

        this.promptSubSplitter = Split([this.prompt_view_top_splitter, this.prompt_view_bottom_splitter], {
            sizes: [50, 50],
            direction: 'vertical',
            gutterSize: 8,
        });

        this.semantic_analyze_embedded_prompt_btn.addEventListener("click", async () => {
            if (await this.extCommon.testSessionKeys() === false) return;
            this.semantic_query_textarea.select();
            await this.sendPromptToLLM()
        });
        this.semantic_query_textarea.addEventListener("keydown", async (e: any) => {
            if (e.key === "Enter" && e.shiftKey === false) {
                e.preventDefault();
                e.stopPropagation();
                this.semantic_query_textarea.select();
                await this.runSemanticQuery();
            }
        });
        this.semantic_query_textarea.addEventListener("input", async () => {
            const semanticQueryText = this.semantic_query_textarea.value.trim();
            await chrome.storage.local.set({ semanticQueryText });
        });
        this.semantic_top_k_input.addEventListener("input", async () => {
            const semanticTopK = Number(this.semantic_top_k_input.value.trim()) || 1;
            await chrome.storage.local.set({ semanticTopK });
        });
        this.semantic_include_k_input.addEventListener("input", async () => {
            const semanticIncludeK = Number(this.semantic_include_k_input.value.trim()) || 1;
            await chrome.storage.local.set({ semanticIncludeK });
        });
        this.semantic_context_k_input.addEventListener("input", async () => {
            const semanticContextK = Number(this.semantic_context_k_input.value.trim()) || 1;
            await chrome.storage.local.set({ semanticContextK });
        });
        this.llm_prompt_template_text_area.addEventListener("input", async () => {
            const semanticQueryMainPromptTemplate = this.llm_prompt_template_text_area.value.trim();
            await chrome.storage.local.set({ semanticQueryMainPromptTemplate });
        });
        this.llm_document_template_text_area.addEventListener("input", async () => {
            const semanticQueryDocumentPromptTemplate = this.llm_document_template_text_area.value.trim();
            await chrome.storage.local.set({ semanticQueryDocumentPromptTemplate });
        });
        this.llm_prompt_template_reset_preset_button.addEventListener("click", async () => {
            const defaultPromptsIndex = this.llm_prompt_template_select_preset.selectedIndex;

            const defaultPromptsNames = Object.keys(this.semanticCommon.semanticPromptTemplatesMap);
            const defaultPrompts = this.semanticCommon.semanticPromptTemplatesMap[defaultPromptsNames[defaultPromptsIndex]];
            await chrome.storage.local.set({ semanticQueryMainPromptTemplate: defaultPrompts.mainPrompt });
            await chrome.storage.local.set({ semanticQueryDocumentPromptTemplate: defaultPrompts.documentPrompt });
            this.llm_document_template_text_area.value = defaultPrompts.documentPrompt;
            this.llm_prompt_template_text_area.value = defaultPrompts.mainPrompt;
        });
        this.chunksTabulator = new TabulatorFull(".semantic_chunk_results_container", {
            layout: "fitDataStretch",
            movableRows: true,
            resizableColumnGuide: true,
            columns: [
                { title: "Id", field: "id", headerSort: false },
                {
                    title: "Title",
                    field: "title",
                    headerSort: false,
                },
            ],
        });

        this.chunksTabulator.on("rowSelected", async (cell: any) => this.scrapeChunkRows());
        this.chunksTabulator.on("rowSelectionChanged", async (cell: any) => this.scrapeChunkRows());
        this.chunksTabulator.on("rowMoved", async (cell: any) => this.scrapeChunkRows());

        this.semantic_dropdown_menu.addEventListener("click", (e: Event) => {
            e.stopPropagation();
        });
        this.semantic_embedding_dropdown_menu.addEventListener("click", (e: Event) => {
            e.stopPropagation();
        });
        this.semantic_display_monospace_checkbox.addEventListener("input", async () => {
            await chrome.storage.local.set({ semanticDisplayMonospace: this.semantic_display_monospace_checkbox.checked });
        });
        this.view_embedded_prompt_toggle.addEventListener("input", async () => this.toggleViewEmbeddedPrompt());
    }
    async load() {
        await this.initSemanticSessionList();

    }
    async paintData() {
        await this.extCommon.getFieldFromStorage(this.semantic_query_textarea, "semanticQueryText");
        await this.extCommon.getFieldFromStorage(this.semantic_top_k_input, "semanticTopK");
        await this.extCommon.getFieldFromStorage(this.semantic_include_k_input, "semanticIncludeK");
        await this.extCommon.getFieldFromStorage(this.semantic_context_k_input, "semanticContextK");
        await this.extCommon.getFieldFromStorage(this.llm_prompt_template_text_area, "semanticQueryMainPromptTemplate");
        await this.extCommon.getFieldFromStorage(this.llm_document_template_text_area, "semanticQueryDocumentPromptTemplate");

        this.renderFilters();
        this.renderSearchChunks();
        await this.semanticCommon.getPromptTemplates(); // this inits some defaults
        await this.paintSemanticDetails();
    }
    async paintSemanticDetails() {
        const uniqueSemanticDocs = await this.extCommon.getStorageField("uniqueSemanticDocs");
        const semanticViewEmbeddedPrompt = await this.extCommon.getStorageField("semanticViewEmbeddedPrompt");
        const embeddedHTMLDisplay = await this.semanticCommon.getEmbeddedPromptText(true);
        const llmResponse = await this.extCommon.getStorageField("semanticLLMQueryResultText");
        const semanticDisplayMonospace = await this.extCommon.getStorageField("semanticDisplayMonospace");
        const semantic_running = await this.extCommon.getStorageField('semantic_running');

        const newSemanticCache = JSON.stringify({
            uniqueSemanticDocs,
            semanticViewEmbeddedPrompt,
            embeddedHTMLDisplay,
            llmResponse,
            semanticDisplayMonospace,
            semantic_running
        });
        if (newSemanticCache === this.semanticDetailsCache) return;
        this.semanticDetailsCache = newSemanticCache;

        this.uniqueDocsCheck.checked = uniqueSemanticDocs === true;
        this.view_embedded_prompt_toggle.checked = semanticViewEmbeddedPrompt;
        if (semanticViewEmbeddedPrompt) {
            this.semantic_embedded_llm_response.innerHTML = embeddedHTMLDisplay;
        } else {
            this.semantic_embedded_llm_response.innerText = llmResponse;
        }

        if (semanticDisplayMonospace === true) {
            this.semantic_display_monospace_checkbox.checked = true;
            document.body.classList.add("semantic_display_monospace");
        } else {
            this.semantic_display_monospace_checkbox.checked = false;
            document.body.classList.remove("semantic_display_monospace");
        }

        if (semantic_running) {
            document.body.classList.add("semantic_running");
        } else {
            document.body.classList.remove("semantic_running");
        }
    }
    async toggleViewEmbeddedPrompt() {
        const semanticViewEmbeddedPrompt = await this.extCommon.getStorageField("semanticViewEmbeddedPrompt");
        await chrome.storage.local.set({ semanticViewEmbeddedPrompt: !semanticViewEmbeddedPrompt });
    }
    async scrapeChunkRows(updateCache = true) {
        const tableRows = this.chunksTabulator.getRows();
        tableRows.forEach((row: any) => {
            const data = row.getData();
            data.include = row.isSelected();
            row.update(data);
        });

        const semanticChunkRows = tableRows.map((row: any) => row.getData());
        if (updateCache) {
            this.setCacheString(semanticChunkRows);
        }
        await chrome.storage.local.set({
            semanticChunkRows,
        });
    }
    async renderFilters() {
        const selectedSemanticFilters = await this.semanticCommon.getSemanticFilters();
        const newSemanticCache = JSON.stringify(selectedSemanticFilters);
        if (newSemanticCache === this.metadataFilterCache) return;
        this.metadataFilterCache = newSemanticCache;

        this.filter_container.innerHTML = "";
        selectedSemanticFilters.forEach((filter: any, filterIndex: number) => {
            let filterDiv = document.createElement("div");
            filterDiv.classList.add("filter_chips");
            filterDiv.innerHTML = this.selectedFilterTemplate(filter, filterIndex);
            this.filter_container.appendChild(filterDiv);
        });
        this.filter_container.querySelectorAll(".delete-button").forEach((button: Element) => {
            (button as HTMLButtonElement).addEventListener("click", async () => {
                let filterIndex = Number(button.getAttribute("data-filterindex"));
                const selectedSemanticFilters = await this.semanticCommon.getSemanticFilters();
                selectedSemanticFilters.splice(filterIndex, 1);
                this.renderFilters();
                chrome.storage.local.set({ selectedSemanticFilters });
            });
        });
        this.filter_container.querySelectorAll(".filter-input-value").forEach((ele: Element) => {
            ele.addEventListener("input", async () => {
                let filterIndex = Number(ele.getAttribute("data-filterindex"));
                const selectedSemanticFilters = await this.semanticCommon.getSemanticFilters();
                selectedSemanticFilters[filterIndex].value = (ele as HTMLInputElement).value;
                chrome.storage.local.set({ selectedSemanticFilters });
            });
        });
        this.filter_container.querySelectorAll(".metafilter_operator").forEach((select: Element) => {
            select.addEventListener("input", async () => {
                let filterIndex = Number(select.getAttribute("data-filterindex"));
                const selectedSemanticFilters = await this.semanticCommon.getSemanticFilters();
                selectedSemanticFilters[filterIndex].operator = (select as any).value;
                chrome.storage.local.set({ selectedSemanticFilters });
            });
        });
    }
    async runSemanticQuery() {
        const message = await this.extCommon.getStorageField("semanticQueryText");
        if (!message || message.length < 3) {
            alert("please supply a message of at least 3 characters");
            return;
        }
        let isAlreadyRunning = await this.semanticCommon.setSemanticRunning();
        if (isAlreadyRunning && !confirm("A job is running, start a new one?")) return;
        this.lastRenderedChunkCache = "";
        await this.semanticCommon.semanticQuery();
    }
    setCacheString(semanticResults: any, other: any = {}) {
        const cacheString = JSON.stringify(semanticResults) + JSON.stringify(other);
        if (this.lastRenderedChunkCache === cacheString) return false;
        this.lastRenderedChunkCache = cacheString;
        return true;
    }
    async renderSearchChunks() {
        const semanticChunkRows = await this.extCommon.getStorageField("semanticChunkRows") || [];
        const semanticChunkColumns = (await this.extCommon.getStorageField("semanticChunkColumns")) || [];

        if (!this.setCacheString(semanticChunkRows)) return;

        await this.semanticCommon.fetchDocumentsLookup(semanticChunkRows.map((row: any) => row.id));
        this.chunksTabulator.setColumns(semanticChunkColumns);
        const semanticChunkData: any[] = [];
        semanticChunkRows.forEach((row: any) => {
            const dataCopy = Object.assign({}, row);
            semanticChunkData.push(dataCopy);
        });

        //cache the included state as tabulator will clear it
        await this.chunksTabulator.setData(semanticChunkData);
        const tableRows = this.chunksTabulator.getRows();
        tableRows.forEach((row: any, index: number) => {
            if (semanticChunkRows[index].include) {
                row.select();
            }
        });

        const metaFieldList: string[] = [];
        let selectHTML = "<option value='noaction'>Add Filter</option><option value=''>Custom</option>";
        const dontInclude = ["id", "title", "include", "text"];
        semanticChunkData.forEach((row: any) => {
            Object.keys(row).forEach((key) => {
                if (!metaFieldList.includes(key) && !dontInclude.includes(key)) {
                    metaFieldList.push(key);
                    selectHTML += `<option value="${key}">${key}</option>`;
                }
            });
        }); 
        this.dmtab_add_meta_filter_select.innerHTML = selectHTML;
    }
    async addMetaFilter() {
        let metaField = this.dmtab_add_meta_filter_select.value;
        if (metaField === "noaction") return;
        if (!metaField) {
            let newValue = prompt("Enter a metadata field name to filter on:");
            if (!newValue) return;
            metaField = newValue;
        }

        const selectedSemanticFilters = await this.semanticCommon.getSemanticFilters();
        selectedSemanticFilters.push({ metaField, value: "", operator: "$lte" });
        await chrome.storage.local.set({ selectedSemanticFilters });
    }
    selectedFilterTemplate(filter: any, filterIndex: number): string {
        const title = filter.metaField;
        const lessThan = filter.operator === "$lte" ? "selected" : "";
        const greaterThan = filter.operator === "$gte" ? "selected" : "";
        const numberEqual = filter.operator === "$e" ? "selected" : "";
        const stringEqual = filter.operator === "$se" ? "selected" : "";
        return `<div class="filter-header">
                   <span class="metric-filter-title">${title}</span>
                </div>
                <div class="flex flex-row gap-1">
                    <div>
                        <select class="metafilter_operator form-select-ts h-8 text-sm w-16" data-filterindex="${filterIndex}">
                            <option value="$lte" ${lessThan}>&#8804;</option>
                            <option value="$gte" ${greaterThan}>&#8805</option>
                            <option value="$e" ${numberEqual}># number</option>
                            <option value="$se" ${stringEqual}>$ string</option>
                        </select>
                    </div>
                    <div>
                        <input type="text" class="filter-input-value form-input-ts w-12 h-8 text-sm" value="${filter.value}" data-filterindex="${filterIndex}">
                    </div>
                </div>
                <button class="delete-button" data-filterindex="${filterIndex}">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                </button>`;
    }
    async initSemanticSessionList() {
        this.dmtab_change_session_select.innerHTML = "";
        let optionHtml = ``;
        let keys = Object.keys(this.semanticCommon.chunkSizeMetaDataMap);
        keys.forEach((key: string) => {
            optionHtml += `<option>${this.semanticCommon.chunkSizeMetaDataMap[key].title}</option>`;
        });
        this.dmtab_change_session_select.innerHTML = optionHtml;
        let selectedSemanticSource = await this.semanticCommon.getSelectedSemanticSource();
        this.dmtab_change_session_select.value = selectedSemanticSource;

        await this.semanticCommon.selectSemanticSource(selectedSemanticSource);
    }
    async sendPromptToLLM() {
        let isAlreadyRunning = await this.semanticCommon.setSemanticRunning();
        if (isAlreadyRunning && !confirm("A job is running, start a new one?")) return;
        await chrome.storage.local.set({
            semanticLLMQueryResultText: "running...",
        });

        const embeddedMessage = await this.semanticCommon.getEmbeddedPromptText();
        const result = await this.extCommon.processPromptUsingUnacogAPI(embeddedMessage);

        await chrome.storage.local.set({
            semantic_running: false,
            semanticLLMQueryResult: result,
            semanticLLMQueryResultText: result.resultMessage,
        });
    }
}