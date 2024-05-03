import { AnalyzerExtensionCommon } from './extensioncommon';
import Mustache from 'mustache';
import Split from 'split.js';

declare const chrome: any;
export default class DataMillHelper {
    extCommon = new AnalyzerExtensionCommon(chrome);
    promptUrl = `https://us-central1-promptplusai.cloudfunctions.net/lobbyApi/session/external/message`;
    llm_analyze_prompt_button = document.querySelector('.llm_analyze_prompt_button') as HTMLButtonElement;
    llm_analyze_prompt_textarea = document.querySelector('.llm_analyze_prompt_textarea') as HTMLTextAreaElement;
    summary_details = document.querySelector('.summary_details') as HTMLDivElement;
    llm_full_augmented_response = document.querySelector('.llm_full_augmented_response') as HTMLDivElement;
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
    left_semantic_view_splitter = document.body.querySelector(".left_semantic_view_splitter") as HTMLDivElement;
    right_semantic_view_splitter = document.body.querySelector(".right_semantic_view_splitter") as HTMLDivElement;
    viewSplitter: Split.Instance;
    runningQuery = false;

    constructor() {
        (async () => {
            await this.extCommon.initDatamillSessionList();
            await this.initSemanticSessionList();
            await this.extCommon.semanticLoad();
            this.paintData();
        })();
        this.run_semantic_search_query_button.addEventListener("click", async () => {
            this.run_semantic_search_query_button.disabled = true;
            this.llm_analyze_prompt_textarea.select();
            this.run_semantic_search_query_button.innerHTML = "...";
            this.saveSelectFilters();
            document.body.classList.add("semantic_search_running");
            await this.runSemanticQuery();
            this.run_semantic_search_query_button.disabled = false;
            document.body.classList.remove("semantic_search_running");
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

        this.viewSplitter = Split([this.left_semantic_view_splitter, this.right_semantic_view_splitter],
            {
                sizes: [70, 30],
                direction: 'horizontal',
                minSize: 100, // min size of both panes
                gutterSize: 16,
            });

        this.llm_analyze_prompt_button.addEventListener("click", () => this.analyzePrompt());
        this.llm_prompt_template_select_preset.addEventListener("input", async () => {
            const selectedSemanticPromptTemplate = this.llm_prompt_template_select_preset.value;
            await chrome.storage.local.set({ selectedSemanticPromptTemplate });
            this.paintPromptTemplateView();
        });
        this.llm_analyze_prompt_textarea.addEventListener("keydown", (e: any) => {
            if (e.key === "Enter" && e.shiftKey === false) {
                e.preventDefault();
                e.stopPropagation();
                this.analyzePrompt();
            }
        });
    }
    async paintData() {
        this.renderFilters();
        let result = await this.extCommon.getStorageField("semanticResults");
        if (result.success) {
            await this.renderSearchChunks(result);
        } else {
            this.semantic_full_augmented_response.innerHTML = "Please run new query for chunk results";
        }
        this.paintPromptTemplateView();

        let selectedEmbeddingType = await this.extCommon.getStorageField("selectedEmbeddingType");
        if (selectedEmbeddingType) {
            this.llm_embedding_type_select.value = selectedEmbeddingType;
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
    async lookupDocumentChunks(message: string): Promise<any> {
        await chrome.storage.local.set({
            semanticResults: {
                success: true,
                matches: []
            },
            semanticIncludeMatchIndexes: [],
        });
        const semanticResults = await this.extCommon.querySemanticChunks(message);
        console.log("query results", semanticResults);
        if (semanticResults.success === false) {
            console.log("FAILED TO FETCH", semanticResults);
            this.llm_full_augmented_response.innerHTML = "Error fetching results. Please refer to console for details.";
            return semanticResults;
        }

        let matches = this.filterUniqueDocs(semanticResults.matches);
        await this.extCommon.fetchDocumentsLookup(matches.map((match: any) => match.id));

        await chrome.storage.local.set({ semanticResults });
        return semanticResults;
    }
    async runSemanticQuery() {
        if (this.runningQuery === true) return;
        this.runningQuery = true;

        const message = this.llm_analyze_prompt_textarea.value.trim();
        if (!message || message.length < 3) {
            alert("please supply a message of at least 3 characters");
            return [];
        }
        await this.lookupDocumentChunks(message);
        await this.processIncludedChunks();

        this.run_semantic_search_query_button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="m15.75 15.75-2.489-2.489m0 0a3.375 3.375 0 1 0-4.773-4.773 3.375 3.375 0 0 0 4.774 4.774ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg> &nbsp; Search`;

        return;
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
                <div class="h-[500px] flex-row semantic_result_details flex hidden">
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
        if (result.matches.length === 0) {
            this.semantic_full_augmented_response.innerHTML = "No results found";
            this.runningQuery = false;
            return;
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
        if (this.extCommon.semanticQueryRunning) {
            alert("already running");
            return;
        }
        const message = this.llm_analyze_prompt_textarea.value.trim();
        if (!message || message.length < 3) {
            alert("please supply a message of at least 3 characters");
            return [];
        }
        let querySemanticResults = false;
        const semanticResults = await this.extCommon.getStorageField("semanticResults");
        if (semanticResults && semanticResults.success) {
            const includes = (await this.extCommon.getStorageField("semanticIncludeMatchIndexes")) || [];
            if (includes.length > 0) {
                if (confirm("You have selected some documents to include. Do you want to proceed without them?")) {
                    querySemanticResults = true;
                }
            }
        }
        this.llm_analyze_prompt_button.setAttribute("disabled", "");
        this.llm_analyze_prompt_button.innerHTML = `<span>
        <lottie-player src="media/heartlottie.json" background="transparent" speed="1"
        style="height:100px;width:100px;align-self:center;" loop autoplay></lottie-player></span>`;

        document.body.classList.remove("initial");
        document.body.classList.add("running");
        document.body.classList.remove("complete");

        if (querySemanticResults) {
            this.llm_full_augmented_response.innerHTML = "Processing Query...<br><br>";
            await this.lookupDocumentChunks(message);
        }

        this.llm_full_augmented_response.innerHTML = await this.sendPromptToLLM(querySemanticResults);

        this.llm_analyze_prompt_button.removeAttribute("disabled");
        this.llm_analyze_prompt_button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
      </svg> `;
        document.body.classList.add("complete");
        document.body.classList.remove("running");

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
    async sendPromptToLLM(resolveNewIncludes = true): Promise<string> {
        let message = this.llm_analyze_prompt_textarea.value.trim();
        if (!message) {
            return "please supply a message";
        }
        message = await this.embedPrompt(message, resolveNewIncludes);
        console.log("embedded message", message);

        let result = await this.extCommon.processPromptUsingUnacogAPI(message);
        return result.resultMessage;
    }
    filterUniqueDocs(matches: any[]): any[] {
        let uniqueDocsChecked = this.uniqueDocsCheck.checked;
        if (uniqueDocsChecked) {
            let docMap: any = {};
            let uniqueMatches: any[] = [];
            matches.forEach((match: any) => {
                const parts = match.id.split("_");
                const docID = parts[0];
                if (!docMap[docID]) {
                    docMap[docID] = true;
                    uniqueMatches.push(match);
                }
            });
            matches = uniqueMatches;
        }
        return matches;
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
            let filteredMatches = this.filterUniqueDocs(semanticResults.matches);
            semanticIncludeMatchIndexes = filteredMatches.slice(0, includeK);
            await this.extCommon.fetchDocumentsLookup(semanticIncludeMatchIndexes.map((match: any) => match.id));
            // include halfK doc w/ halfK chunks
        } else if (embedIndex === 1) {
            let filteredMatches = this.filterUniqueDocs(semanticResults.matches);
            semanticIncludeMatchIndexes = filteredMatches.slice(0, halfK);
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
    async embedPrompt(prompt: string, resolveNewIncludes: boolean): Promise<string> {
        if (resolveNewIncludes) {
            await this.processIncludedChunks();
        }

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

        this.llm_prompt_template_text_area.value = promptTemplate.mainPrompt;
        this.llm_document_template_text_area.value = promptTemplate.documentPrompt;
        this.llm_prompt_template_select_preset.value = selectedSemanticPromptTemplate;
    }
}