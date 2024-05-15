import { AnalyzerExtensionCommon } from './extensioncommon';
import { SemanticCommon } from './semanticcommon';
import MainPageApp from './mainpageapp';
import { TabulatorFull } from 'tabulator-tables';
import Mustache from 'mustache';
import Split from 'split.js';

declare const chrome: any;
export default class DataMillHelper {
    app: MainPageApp;
    extCommon: AnalyzerExtensionCommon;
    semanticCommon: SemanticCommon;
    promptUrl = `https://us-central1-promptplusai.cloudfunctions.net/lobbyApi/session/external/message`;
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
    dmtab_add_meta_filter_button = document.body.querySelector(".dmtab_add_meta_filter_button") as HTMLButtonElement;
    top_semantic_view_splitter = document.body.querySelector(".top_semantic_view_splitter") as HTMLDivElement;
    bottom_semantic_view_splitter = document.body.querySelector(".bottom_semantic_view_splitter") as HTMLDivElement;
    prompt_view_top_splitter = document.body.querySelector(".prompt_view_top_splitter") as HTMLDivElement;
    prompt_view_bottom_splitter = document.body.querySelector(".prompt_view_bottom_splitter") as HTMLDivElement;
    semantic_dropdown_menu = document.body.querySelector(".semantic_dropdown_menu") as HTMLDivElement;
    viewSplitter: Split.Instance;
    promptSubSplitter: Split.Instance;
    chunksTabulator: TabulatorFull;
    verboseDebugging = false;
    lastRenderedChunkCache = "";

    constructor(app: MainPageApp) {
        this.app = app;
        this.extCommon = app.extCommon;
        this.semanticCommon = app.semanticCommon;
        this.load();
        this.uniqueDocsCheck.addEventListener("input", async () => {
            await chrome.storage.local.set({ uniqueSemanticDocs: this.uniqueDocsCheck.checked });
        });
        this.run_semantic_search_query_button.addEventListener("click", async () => {
            this.semantic_query_textarea.select();
            await this.runSemanticQuery();
        });
        this.dmtab_change_session_select.addEventListener("input", async () => {
            const selectedValue = this.dmtab_change_session_select.value;
            await this.semanticCommon.selectSemanticSource(selectedValue, true);
        });

        this.dmtab_add_meta_filter_button.addEventListener("click", () => {
            this.addMetaFilter();
        });

        this.viewSplitter = Split([this.top_semantic_view_splitter, this.bottom_semantic_view_splitter], {
            sizes: [50, 50],
            direction: 'horizontal',
            gutterSize: 16,
        });

        this.promptSubSplitter = Split([this.prompt_view_top_splitter, this.prompt_view_bottom_splitter], {
            sizes: [50, 50],
            direction: 'vertical',
            gutterSize: 16,
        });

        this.semantic_analyze_embedded_prompt_btn.addEventListener("click", async () => {
            this.semantic_query_textarea.select();
            await this.sendPromptToLLM()
        });
        this.llm_prompt_template_select_preset.addEventListener("input", async () => {
            const selectedSemanticPromptTemplate = this.llm_prompt_template_select_preset.value;
            await chrome.storage.local.set({ selectedSemanticPromptTemplate });
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
        this.chunksTabulator.on("rowMoved", async (cell: any) => this.scrapeChunkRows());

        this.semantic_dropdown_menu.addEventListener("click", (e: Event) => {
            e.stopPropagation();
        });
    }
    async load() {
        await this.initSemanticSessionList();

        const uniqueSemanticDocs = await this.extCommon.getStorageField("uniqueSemanticDocs");
        this.uniqueDocsCheck.checked = uniqueSemanticDocs === true;
    }
    async paintData() {
        this.renderFilters();
        this.renderSearchChunks();

        const selectedSemanticPromptTemplate = (await this.extCommon.getStorageField("selectedSemanticPromptTemplate")) || "Answer with Doc Summary";
        const promptTemplate = this.semanticCommon.semanticPromptTemplatesMap[selectedSemanticPromptTemplate];

        this.llm_prompt_template_text_area.value = promptTemplate?.mainPrompt;
        this.llm_document_template_text_area.value = promptTemplate?.documentPrompt;
        this.llm_prompt_template_select_preset.value = selectedSemanticPromptTemplate;
        const llmResponse = await this.extCommon.getStorageField("semanticLLMQueryResultText");
        this.semantic_embedded_llm_response.innerText = llmResponse;

        await this.extCommon.getFieldFromStorage(this.semantic_query_textarea, "semanticQueryText");
        await this.extCommon.getFieldFromStorage(this.semantic_top_k_input, "semanticTopK");
        await this.extCommon.getFieldFromStorage(this.semantic_include_k_input, "semanticIncludeK");
        await this.extCommon.getFieldFromStorage(this.semantic_context_k_input, "semanticContextK");

        const semantic_running = await chrome.storage.local.get('semantic_running');
        if (semantic_running && semantic_running.semantic_running) {
            document.body.classList.add("semantic_running");
        } else {
            document.body.classList.remove("semantic_running");
        }
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
        this.filter_container.innerHTML = "";
        const selectedSemanticFilters = await this.semanticCommon.getSemanticFilters();
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
        this.filter_container.querySelectorAll(".filter-input-value").forEach((ele: Element) => {
            ele.addEventListener("input", async () => {
                let filterIndex = Number(ele.getAttribute("data-filterindex"));
                const selectedSemanticFilters = await this.semanticCommon.getSemanticFilters();
                selectedSemanticFilters[filterIndex].value = (ele as HTMLInputElement).value;
                chrome.storage.local.set({ selectedSemanticFilters });
            });
        });
        this.filter_container.querySelectorAll(".filter-select select").forEach((select: Element) => {
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
    }
    async addMetaFilter(metaField = "") {
        if (!metaField) {
            let newValue = prompt("Enter a metric name");
            if (!newValue) return;
            metaField = newValue;
        }

        const selectedSemanticFilters = await this.semanticCommon.getSemanticFilters();
        selectedSemanticFilters.push({ metaField, value: "", operator: "$se" });
        await chrome.storage.local.set({ selectedSemanticFilters });
    }
    selectedFilterTemplate(filter: any, filterIndex: number): string {
        const title = filter.metaField;
        const lessThan = filter.operator === "$lte" ? "selected" : "";
        const greaterThan = filter.operator === "$gte" ? "selected" : "";
        const numberEqual = filter.operation === "$e" ? "selected" : "";
        const stringEqual = filter.operation === "$se" ? "selected" : "";
        return `<div class="filter-header">
                   <span class="metric-filter-title">${title}</span>
                </div>
                <div class="flex flex-row gap-1">
                    <div>
                        <select class="form-select-ts h-8 text-sm w-16" data-filterindex="${filterIndex}">
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
    escapeHTML(str: string): string {
        if (!str) str = "";
        return str.replace(/[&<>'"]/g,
            (match) => {
                switch (match) {
                    case "&": return "&amp;";
                    case "<": return "&lt;";
                    case ">": return "&gt;";
                    case "'": return "&#39;";
                    case "\"": return "&quot;";
                }

                return match;
            });
    }
    async sendPromptToLLM() {
        let isAlreadyRunning = await this.semanticCommon.setSemanticRunning();
        if (isAlreadyRunning && !confirm("A job is running, start a new one?")) return;
        await chrome.storage.local.set({
            semanticLLMQueryResultText: "running...",
        });

        const embeddedMessage = await this.getEmbeddedPromptText();
        const result = await this.extCommon.processPromptUsingUnacogAPI(embeddedMessage);

        await chrome.storage.local.set({
            semantic_running: false,
            semanticLLMQueryResult: result,
            semanticLLMQueryResultText: result.resultMessage,
        });
    }
    getSmallToBig(matchId: string, contextK: number): string {
        const lookUpIndex = this.semanticCommon.lookUpKeys.indexOf(matchId);
        let firstIndex = lookUpIndex - Math.floor(contextK / 2);
        let lastIndex = lookUpIndex + Math.ceil(contextK / 2);
        if (firstIndex < 0) firstIndex = 0;
        if (lastIndex > this.semanticCommon.lookUpKeys.length - 1) lastIndex = this.semanticCommon.lookUpKeys.length - 1;
        const parts = matchId.split("_");
        const docID = parts[0];
        let text = "";
        for (let i = firstIndex; i <= lastIndex; i++) {
            const chunkKey = this.semanticCommon.lookUpKeys[i];
            if (!chunkKey) continue;
            if (chunkKey.indexOf(docID) === 0) {
                if (this.semanticCommon.lookupData[chunkKey]) {
                    text = this.annexChunkWithoutOverlap(text, this.semanticCommon.lookupData[chunkKey]);
                }
            }
        }
        return text;
    }
    annexChunkWithoutOverlap(text: string, chunkText: string, searchDepth = 500): string {
        let startPos = -1;
        const l = Math.min(chunkText.length - 1, searchDepth);
        for (let nextPos = 1; nextPos < l; nextPos++) {
            const existingOverlap = text.slice(-1 * nextPos);
            const nextOverlap = chunkText.slice(0, nextPos);
            if (existingOverlap === nextOverlap) {
                startPos = nextPos;
                // break;
            }
        }
        if (startPos > 0) {
            if (this.verboseDebugging)
                console.log("overlap", chunkText.slice(0, startPos), startPos);
            return text + chunkText.slice(startPos) + " ";
        }
        if (this.verboseDebugging)
            console.log("no overlap");
        return text + chunkText + " ";
    }
    async buildChunkEmbedText(message: string, semanticChunkRows: any[]): Promise<string> {
        const selectedSemanticPromptTemplate = await this.extCommon.getStorageField("selectedSemanticPromptTemplate") || "Answer with Doc Summary";
        const promptTemplate = this.semanticCommon.semanticPromptTemplatesMap[selectedSemanticPromptTemplate];
        let documentsEmbedText = "";
        const contextK = Number(await this.extCommon.getStorageField("semanticContextK")) || 1;

        const includedRows = semanticChunkRows.filter((row: any) => row.include);
        await this.semanticCommon.fetchDocumentsLookup(includedRows.map((row: any) => row.id));
        includedRows.forEach((row: any, index: number) => {
            const merge = Object.assign({}, row);
            merge.text = this.getSmallToBig(row.id, contextK);
            merge.prompt = message;
            if (!merge.text) {
                console.log("missing merge", row.id, this.semanticCommon.lookupData)
                merge.text = "";
            }
            merge.text = merge.text.replaceAll("\n", " ");
            documentsEmbedText += Mustache.render(promptTemplate.documentPrompt, merge);
        });

        await chrome.storage.local.set({
            documentsEmbedText,
        });

        return documentsEmbedText;
    }
    async getEmbeddedPromptText(): Promise<string> {
        const message = await this.extCommon.getStorageField("semanticQueryText") || "";
        if (!message) {
            console.log("getEmbeddedPromptText: no message found in storage");
        }
        const semanticChunkRows = await this.extCommon.getStorageField("semanticChunkRows") || [];
        let documentsEmbedText = await this.buildChunkEmbedText(message, semanticChunkRows);
        const selectedSemanticPromptTemplate = await this.extCommon.getStorageField("selectedSemanticPromptTemplate") || "Answer with Doc Summary";
        const promptTemplate = this.semanticCommon.semanticPromptTemplatesMap[selectedSemanticPromptTemplate];
        const mainMerge = {
            documents: documentsEmbedText,
            prompt: message,
        };
        const promptT = promptTemplate.mainPrompt;
        const mainPrompt = Mustache.render(promptT, mainMerge);
        return mainPrompt;
    }
}