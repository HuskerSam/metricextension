import { AnalyzerExtensionCommon } from './extensioncommon';
import MainPageApp from './mainpageapp';
import Mustache from 'mustache';
import Split from 'split.js';

declare const chrome: any;
export default class DataMillHelper {
    app: MainPageApp;
    extCommon: AnalyzerExtensionCommon;
    promptUrl = `https://us-central1-promptplusai.cloudfunctions.net/lobbyApi/session/external/message`;
    semantic_analyze_embedded_prompt_btn = document.querySelector('.semantic_analyze_embedded_prompt_btn') as HTMLButtonElement;
    semantic_query_textarea = document.querySelector('.semantic_query_textarea') as HTMLTextAreaElement;
    summary_details = document.querySelector('.summary_details') as HTMLDivElement;
    semantic_embedded_llm_response = document.querySelector('.semantic_embedded_llm_response') as HTMLDivElement;
    llm_prompt_template_select_preset = document.querySelector('.llm_prompt_template_select_preset') as HTMLSelectElement;
    llm_prompt_template_text_area = document.querySelector('.llm_prompt_template_text_area') as HTMLTextAreaElement;
    llm_document_template_text_area = document.querySelector('.llm_document_template_text_area') as HTMLTextAreaElement;
    llm_embedding_type_select = document.querySelector('.llm_embedding_type_select') as HTMLSelectElement;
    uniqueDocsCheck = document.body.querySelector(".uniqueDocsCheck") as HTMLInputElement;
    verboseDebugging = false;
    dmtab_change_session_select = document.querySelector(".dmtab_change_session_select") as HTMLSelectElement;
    semantic_full_augmented_response = document.querySelector(".semantic_full_augmented_response") as HTMLDivElement;
    run_semantic_search_query_button = document.querySelector(".run_semantic_search_query_button") as HTMLButtonElement;
    filter_container = document.body.querySelector(".filter_container") as HTMLDivElement;
    dmtab_add_meta_filter_button = document.body.querySelector(".dmtab_add_meta_filter_button") as HTMLButtonElement;
    top_semantic_view_splitter = document.body.querySelector(".top_semantic_view_splitter") as HTMLDivElement;
    bottom_semantic_view_splitter = document.body.querySelector(".bottom_semantic_view_splitter") as HTMLDivElement;
    viewSplitter: Split.Instance;
    runningQuery = false;

    constructor(app: MainPageApp) {
        this.app = app;
        this.extCommon = app.extCommon;
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
            await this.extCommon.selectSemanticSource(selectedValue, true);
        });
        this.llm_embedding_type_select.addEventListener("input", async () => {
            const selectedValue = this.llm_embedding_type_select.value;
            await chrome.storage.local.set({ selectedEmbeddingType: selectedValue });
        });

        this.dmtab_add_meta_filter_button.addEventListener("click", () => {
            this.addMetaFilter();
        });

        this.viewSplitter = Split([this.top_semantic_view_splitter, this.bottom_semantic_view_splitter],
            {
                sizes: [50, 50],
                direction: 'horizontal',
                gutterSize: 16,
            });

        this.semantic_analyze_embedded_prompt_btn.addEventListener("click", async () => {
            this.semantic_query_textarea.select();
            await this.analyzePrompt()
        });
        this.llm_prompt_template_select_preset.addEventListener("input", async () => {
            const selectedSemanticPromptTemplate = this.llm_prompt_template_select_preset.value;
            await chrome.storage.local.set({ selectedSemanticPromptTemplate });
            this.paintPromptTemplateView();
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
            let semanticQueryText = this.semantic_query_textarea.value.trim();
            await chrome.storage.local.set({ semanticQueryText });
        });
    }
    async load() {
        await this.extCommon.initDatamillSessionList();
        await this.initSemanticSessionList();

        const uniqueSemanticDocs = await this.extCommon.getStorageField("uniqueSemanticDocs");
        this.uniqueDocsCheck.checked = uniqueSemanticDocs === true;
    }
    async paintData() {
        this.renderFilters();
        let result = await this.extCommon.getStorageField("semanticResults");
        await this.renderSearchChunks(result);

        this.paintPromptTemplateView();

        let selectedEmbeddingType = await this.extCommon.getStorageField("selectedEmbeddingType");
        if (selectedEmbeddingType) {
            this.llm_embedding_type_select.value = selectedEmbeddingType;
        }
        await this.extCommon.getFieldFromStorage(this.semantic_query_textarea, "semanticQueryText");

        const semantic_running = await chrome.storage.local.get('semantic_running');
        if (semantic_running && semantic_running.semantic_running) {
            document.body.classList.add("semantic_running");
        } else {
            document.body.classList.remove("semantic_running");
        }
    }
    renderFilters() {
        this.filter_container.innerHTML = "";
        this.extCommon.selectedSemanticMetaFilters.forEach((filter: any, filterIndex: number) => {
            let filterDiv = document.createElement("div");
            filterDiv.classList.add("filter_chips");
            filterDiv.innerHTML = this.selectedFilterTemplate(filter, filterIndex);
            this.filter_container.appendChild(filterDiv);
        });
        this.filter_container.querySelectorAll(".delete-button").forEach((button) => {
            (button as HTMLButtonElement).addEventListener("click", () => {
                let filterIndex = Number(button.getAttribute("data-filterindex"));
                this.extCommon.selectedSemanticMetaFilters.splice(filterIndex, 1);
                this.renderFilters();
                this.saveSelectFilters();
            });
        });
        this.filter_container.querySelectorAll(".filter-input-value").forEach((ele: Element) => {
            ele.addEventListener("input", () => {
                let filterIndex = Number(ele.getAttribute("data-filterindex"));
                this.extCommon.selectedSemanticMetaFilters[filterIndex].value = (ele as HTMLInputElement).value;
            });
        });
        this.filter_container.querySelectorAll(".filter-input-value").forEach((ele: Element) => {
            ele.addEventListener("input", () => {
                let filterIndex = Number(ele.getAttribute("data-filterindex"));
                this.extCommon.selectedSemanticMetaFilters[filterIndex].value = (ele as HTMLInputElement).value;
            });
        });
        this.filter_container.querySelectorAll(".filter-select select").forEach((select: Element) => {
            select.addEventListener("input", () => {
                let filterIndex = Number(select.getAttribute("data-filterindex"));
                this.extCommon.selectedSemanticMetaFilters[filterIndex].operator = (select as any).value;
                this.saveSelectFilters();
            });
        });
    }
    async saveSelectFilters() {
        await chrome.storage.local.set({ "selectedSemanticFilters": this.extCommon.selectedSemanticMetaFilters });
    }
    async runSemanticQuery() {
        const message = await this.extCommon.getStorageField("semanticQueryText");
        if (!message || message.length < 3) {
            alert("please supply a message of at least 3 characters");
            return;
        }
        let isAlreadyRunning = await this.extCommon.getStorageField("semanticQueryRunning");
        if (isAlreadyRunning) {
            alert("already running");
            return;
        }
        await this.extCommon.lookupDocumentChunks();
    }
    semanticChunkResultCardHTML(match: any, includeInfo: any): string {
        let matchedClass = includeInfo ? "matched" : "not-matched";
        let checkboxChecked = includeInfo ? "checked" : "";
        let similarityScore = `<span class="similarity_score_badge mb-2">${(match.score * 100).toFixed()}%</span>`;
        let metaString = `<div class="meta_field_row border-b border-b-slate-300 text-nowrap p-1">
        <span class="meta_field_col_name font-semibold text-sm mr-2 w-28 overflow-hidden inline-block">$ Id</span>
        <span class="meta_field_col_value text-sm">${match.id}</span>
        </div>`;
        let metaFields = Object.keys(match.metadata);
        let url = match.metadata.url || "";
        if (url) {
            url = `
                <a href="${url}" target="_blank" class="text-blue-500 inline-block">
                  <div class="flex flex-row items-center">
                    Source&nbsp;
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg> 
                  </div>
                </a>`;
        }
        metaFields.forEach(category => {
            const isNumber = Number(match.metadata[category]) === match.metadata[category];
            const numStr = isNumber ? "#" : "$";
            let value = match.metadata[category];
            if (isNumber) {
                value = Number(match.metadata[category]) || 0;
            }
            metaString += `<div class="meta_field_row border-b border-b-slate-400 text-nowrap p-1 text-sm">
                    <span class="meta_field_col_name font-bold text-sm mr-2 w-32 overflow-hidden inline-block">${numStr} ${category}</span>
                    <span class="meta_field_col_value">${value}</span>
                    </div>`;
        });
        const title = match.metadata.title || "";
        return `
            <div class="semantic_result_card border-b mb-2 p-2 ${matchedClass}">
                <div class="flex flex-row pb-2 text-sm">
                    <div class="flex-1">
                    <span class="font-semibold pr-2">${title}</span>
                        ${url}
                    </div>
                    <div>
                    ${similarityScore}
                    <label class="font-medium text-gray-900 p-2">
                     <input ${checkboxChecked} data-matchid="${match.id}" type="checkbox" class="semantic_result_include_checkbox h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600">
                    </label>
                    </div>
                </div>
                <div class="flex justify-center">
                    <button class="open_semantic_result_details text-xs font-semibold text-blue-400">See Detailed Results</button>
                </div>
                <div class="h-[500px] flex-row semantic_result_details flex">
                    <div class="whitespace-pre-wrap overflow-auto flex-1 text-sm">${match.fullText}</div>
                    <div class="overflow-auto flex-1 pl-2 text-sm">${metaString}</div>
                </div>
            </div>`;
    }
    async renderSearchChunks(result: any) {
        let html = "";
        const includes = (await this.extCommon.getStorageField("semanticIncludeMatchIndexes")) || [];
        const chunkIncludedMap: any = {};
        includes.forEach((include: any) => {
            chunkIncludedMap[include.id] = include;
        });
        if (!result.matches || result.matches.length === 0) {
            document.body.classList.add("no_semantic_result");
            this.semantic_full_augmented_response.innerHTML = `<div class="semantic_results_none_found">No results found</div>`;
            this.runningQuery = false;
            return;
        } else {
            document.body.classList.remove("no_semantic_result");
        }
        await this.extCommon.fetchDocumentsLookup(result.matches.map((match: any) => match.id));
        result.matches.forEach((match: any) => {
            let displayDocHTML = this.generateDisplayText(match.id, true);
            match.fullText = this.generateDisplayText(match.id);
            if (!displayDocHTML) {
                console.log(match.id, this.extCommon.lookupData);
            }

            let block = this.semanticChunkResultCardHTML(match, chunkIncludedMap[match.id]);
            html += block;
        });
        this.semantic_full_augmented_response.innerHTML = html;
        this.semantic_full_augmented_response.querySelectorAll(".semantic_result_include_checkbox").forEach((checkbox: any) => {
            checkbox.addEventListener("change", async () => {
                this.scrapeIncludeStatusOfChunks();

            });
        });
        this.semantic_full_augmented_response.querySelectorAll(".open_semantic_result_details").forEach((button: any) => {
            button.addEventListener("click", () => {
                button.parentElement.parentElement.querySelector(".semantic_result_details").classList.toggle("hidden");
            });
        });
        this.runningQuery = false;
        return;
    }
    async scrapeIncludeStatusOfChunks() {
        let includes: any[] = [];
        const semanticResults = await this.extCommon.getStorageField("semanticResults");
        this.semantic_full_augmented_response.querySelectorAll(".semantic_result_include_checkbox").forEach((checkbox: any) => {
            if (checkbox.checked) {
                const matchId = checkbox.getAttribute("data-matchid");
                const match = semanticResults.matches.find((m: any) => m.id === matchId);
                includes.push(match);
            }
        });
        await chrome.storage.local.set({ semanticIncludeMatchIndexes: includes });
    }
    addMetaFilter(metaField = "") {
        if (!metaField) {
            let newValue = prompt("Enter a metric name");
            if (!newValue) return;
            metaField = newValue;
        }
        this.extCommon.selectedSemanticMetaFilters.push({ metaField, value: "", operator: "$se" });
        this.renderFilters();
        this.saveSelectFilters();
    }
    generateDisplayText(matchId: string, highlight = false): string {
        const displayDocHTML = this.extCommon.lookupData[matchId];
        return displayDocHTML;
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
        let keys = Object.keys(this.extCommon.chunkSizeMetaDataMap);
        keys.forEach((key: string) => {
            optionHtml += `<option>${this.extCommon.chunkSizeMetaDataMap[key].title}</option>`;
        });
        this.dmtab_change_session_select.innerHTML = optionHtml;
        let selectedSemanticSource = await this.extCommon.getSelectedSemanticSource();
        this.dmtab_change_session_select.value = selectedSemanticSource;

        await this.extCommon.selectSemanticSource(selectedSemanticSource);
    }
    async analyzePrompt() {
        await this.sendPromptToLLM();
        const llmResponse = await this.extCommon.getStorageField("semanticLLMQueryResultText");
        this.semantic_embedded_llm_response.innerText = llmResponse;

        return;
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
        const isAlreadyRunning = await this.extCommon.setSemanticRunning(true);
        if (isAlreadyRunning) {
            return;
        }
        const message = await this.extCommon.getStorageField("semanticQueryText");
        const embeddedMessage = await this.embedPrompt(message);
        const result = await this.extCommon.processPromptUsingUnacogAPI(embeddedMessage);

        await chrome.storage.local.set({
            semanticQueryRunning: false,
            semanticLLMQueryResult: result,
            semanticLLMQueryResultText: result.resultMessage,
        });
    }
    getSmallToBig(matchId: string, includeK: number): string {
        const lookUpIndex = this.extCommon.lookUpKeys.indexOf(matchId);
        let firstIndex = lookUpIndex - Math.floor(includeK / 2);
        let lastIndex = lookUpIndex + Math.ceil(includeK / 2);
        if (firstIndex < 0) firstIndex = 0;
        if (lastIndex > this.extCommon.lookUpKeys.length - 1) lastIndex = this.extCommon.lookUpKeys.length - 1;
        const parts = matchId.split("_");
        const docID = parts[0];
        let text = "";
        for (let i = firstIndex; i <= lastIndex; i++) {
            const chunkKey = this.extCommon.lookUpKeys[i];
            if (!chunkKey) continue;
            if (chunkKey.indexOf(docID) === 0) {
                if (this.extCommon.lookupData[chunkKey]) {
                    text = this.annexChunkWithoutOverlap(text, this.extCommon.lookupData[chunkKey]);
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
    async processIncludedChunks(): Promise<any> {
        const semanticResults = await this.extCommon.getStorageField("semanticResults");
        const embedIndex = Number(await this.extCommon.getStorageField("selectedEmbeddingType")) || 0;

        let includeK = this.extCommon.chunkSizeMeta.topK;
        let halfK = Math.ceil(includeK / 2);
        let semanticIncludeMatchIndexes: any[] = [];
        // include K chunks as doc
        if (embedIndex === 0) {
            semanticIncludeMatchIndexes = semanticResults.matches.slice(0, includeK);
            await this.extCommon.fetchDocumentsLookup(semanticIncludeMatchIndexes.map((match: any) => match.id));
            // include halfK doc w/ halfK chunks
        } else if (embedIndex === 1) {
            semanticIncludeMatchIndexes = semanticResults.matches.slice(0, halfK);
            await this.extCommon.fetchDocumentsLookup(semanticIncludeMatchIndexes.map((match: any) => match.id));
            // include 1 doc w includeK chunks
        } else if (embedIndex === 2) {
            const match = semanticResults.matches[0];
            await this.extCommon.fetchDocumentsLookup([match.id]);
        }
        await chrome.storage.local.set({
            semanticIncludeMatchIndexes,
        });

        return semanticIncludeMatchIndexes;
    }
    async buildChunkEmbedText(message: string, semanticIncludeMatchIndexes: any[]): Promise<string> {
        const embedIndex = Number(await this.extCommon.getStorageField("selectedEmbeddingType")) || 0;
        const selectedSemanticPromptTemplate = await this.extCommon.getStorageField("selectedSemanticPromptTemplate") || "Answer with Doc Summary";
        const promptTemplate = this.extCommon.semanticPromptTemplatesMap[selectedSemanticPromptTemplate];
        let documentsEmbedText = "";
        let includeK = this.extCommon.chunkSizeMeta.topK;
        let halfK = Math.ceil(includeK / 2);
        // include K chunks as doc
        if (embedIndex === 0) {
            await this.extCommon.fetchDocumentsLookup(semanticIncludeMatchIndexes.map((match: any) => match.id));
            semanticIncludeMatchIndexes.forEach((match: any, index: number) => {
                const merge = Object.assign({}, match.metadata);
                merge.id = match.id;
                merge.matchIndex = index;
                merge.text = this.extCommon.lookupData[match.id];
                merge.prompt = message;
                if (!merge.text) {
                    console.log("missing merge", match.id, this.extCommon.lookupData)
                    merge.text = "";
                }
                merge.text = merge.text.replaceAll("\n", " ");
                documentsEmbedText += Mustache.render(promptTemplate.documentPrompt, merge);
            });
            // include halfK doc w/ halfK chunks
        } else if (embedIndex === 1) {
            await this.extCommon.fetchDocumentsLookup(semanticIncludeMatchIndexes.map((match: any) => match.id));
            semanticIncludeMatchIndexes.forEach((match: any, index: number) => {
                const merge = Object.assign({}, match.metadata);
                merge.id = match.id;
                merge.matchIndex = index;
                merge.text = this.getSmallToBig(match.id, halfK);
                merge.prompt = message;
                if (!merge.text) {
                    console.log("missing merge", match.id, this.extCommon.lookupData)
                    merge.text = "";
                }
                merge.text = merge.text.replaceAll("\n", " ");
                documentsEmbedText += Mustache.render(promptTemplate.documentPrompt, merge);
            });
            // include 1 doc w includeK chunks
        } else if (embedIndex === 2) {
            const match = semanticIncludeMatchIndexes[0];
            await this.extCommon.fetchDocumentsLookup([match.id]);
            const merge = Object.assign({}, match.metadata);
            merge.id = match.id;
            merge.matchIndex = 0;
            merge.prompt = message;
            merge.text = this.getSmallToBig(match.id, includeK);
            merge.text = merge.text.replaceAll("\n", " ");
            documentsEmbedText += Mustache.render(promptTemplate.documentPrompt, merge);
        }
        await chrome.storage.local.set({
            documentsEmbedText,
        });

        return documentsEmbedText;
    }
    async embedPrompt(prompt: string): Promise<string> {
        await this.processIncludedChunks();
        const semanticIncludeMatchIndexes = await this.extCommon.getStorageField("semanticIncludeMatchIndexes") || [];
        let documentsEmbedText = await this.buildChunkEmbedText(prompt, semanticIncludeMatchIndexes);
        const selectedSemanticPromptTemplate = await this.extCommon.getStorageField("selectedSemanticPromptTemplate") || "Answer with Doc Summary";
        const promptTemplate = this.extCommon.semanticPromptTemplatesMap[selectedSemanticPromptTemplate];
        const mainMerge = {
            documents: documentsEmbedText,
            prompt,
        };
        const promptT = promptTemplate.mainPrompt;
        const mainPrompt = Mustache.render(promptT, mainMerge);
        return mainPrompt;
    }
    async paintPromptTemplateView() {
        const selectedSemanticPromptTemplate = (await this.extCommon.getStorageField("selectedSemanticPromptTemplate")) || "Answer with Doc Summary";
        const promptTemplate = this.extCommon.semanticPromptTemplatesMap[selectedSemanticPromptTemplate];

        this.llm_prompt_template_text_area.value = promptTemplate?.mainPrompt;
        this.llm_document_template_text_area.value = promptTemplate?.documentPrompt;
        this.llm_prompt_template_select_preset.value = selectedSemanticPromptTemplate;
    }
}