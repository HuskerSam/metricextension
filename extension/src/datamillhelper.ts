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
    lookUpKeys: string[] = [];
    semanticEnabled = true;
    dmtab_change_session_select = document.querySelector(".dmtab_change_session_select") as HTMLSelectElement;
    semantic_full_augmented_response = document.querySelector(".semantic_full_augmented_response") as HTMLDivElement;
    analyze_prompt_textarea = document.querySelector(".analyze_prompt_textarea") as HTMLTextAreaElement;
    analyze_prompt_button = document.querySelector(".analyze_prompt_button") as HTMLButtonElement;
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
        this.analyze_prompt_button.addEventListener("click", async () => {
            this.analyze_prompt_button.disabled = true;
            this.analyze_prompt_textarea.select();
            this.analyze_prompt_button.innerHTML = "...";
            this.saveSelectFilters();
            document.body.classList.add("semantic_search_running");
            await this.runSemanticQuery();
            this.analyze_prompt_button.disabled = false;
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

        this.analyze_prompt_textarea.addEventListener("keydown", (e: any) => {
            if (e.key === "Enter" && e.shiftKey === false) {
                e.preventDefault();
                e.stopPropagation();
                this.analyze_prompt_button.click();
            }
        });
        this.dmtab_add_meta_filter_button.addEventListener("click", () => {
            this.addMetaFilter();
        });

        this.viewSplitter = Split([this.left_semantic_view_splitter, this.right_semantic_view_splitter],
            {
                sizes: [50, 50],
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
            this.semantic_full_augmented_response.innerHTML = "Please run new query";
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
    async runSemanticQuery() {
        if (this.runningQuery === true) return;
        this.runningQuery = true;

        await chrome.storage.local.set({
            semanticResults: {
                success: true,
                matches: [],
            },
            semanticIncludeMatchIndexes: [],
        });
        this.semantic_full_augmented_response.innerHTML = `<div class="hidden flex-col flex-1 semantic_search_running_loader h-full justify-center text-center align-middle">
        <lottie-player src="media/lottie.json" background="transparent" speed="1" class="w-12 h-12 self-center inline-block" loop
          autoplay></lottie-player>
          <span class="font-bold text-lg">Search running...</span>
        </div>`;

        const message = this.analyze_prompt_textarea.value.trim();
        let topK = this.extCommon.chunkSizeMeta.topK;
        let apiToken = this.extCommon.chunkSizeMeta.apiToken;
        let sessionId = this.extCommon.chunkSizeMeta.sessionId;
        if (this.extCommon.chunkSizeMeta.useDefaultSession) {
            topK = 15;
            sessionId = await chrome.storage.local.get('sessionId');
            sessionId = sessionId?.sessionId || "";
            apiToken = await chrome.storage.local.get('apiToken');
            apiToken = apiToken?.apiToken || "";
        }
        let result = await this.extCommon.getMatchingVectors(message, topK, apiToken, sessionId);
        if (result.success === false) {
            console.log("FAILED TO FETCH", result);
            this.semantic_full_augmented_response.innerHTML = "Error fetching results. Please refer to console for details.";
            this.runningQuery = false;
        }

        this.analyze_prompt_button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="m15.75 15.75-2.489-2.489m0 0a3.375 3.375 0 1 0-4.773-4.773 3.375 3.375 0 0 0 4.774 4.774ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg> &nbsp; Search`;
        await chrome.storage.local.set({ semanticResults: result });
    }
    semanticChunkResultCardHTML(match: any, includeInfo: any): string {
        let matchedClass = includeInfo ? "matched" : "not-matched";
        let similarityScore = `<span class="similarity_score_badge mb-2">${(match.score * 100).toFixed()}%</span>`;
        let metaString = `<div class="meta_field_row border-b border-b-slate-300 text-nowrap p-1">
        <span class="meta_field_col_name font-bold text-sm mr-2 w-28 overflow-hidden inline-block">$ Id</span>
        <span class="meta_field_col_value">${match.id}</span>
        </div>`;
        let metaFields = Object.keys(match.metadata);
        let url = match.metadata.url || "";
        if (url) {
            url = `<a href="${url}" target="_blank" class="text-blue-500">View Source</a>`;
        }
        metaFields.forEach(category => {
            const isNumber = Number(match.metadata[category]) === match.metadata[category];
            const numStr = isNumber ? "#" : "$";
            let value = match.metadata[category];
            if (isNumber) {
                value = Number(match.metadata[category]) || 0;
            }
            metaString += `<div class="meta_field_row border-b border-b-slate-400 text-nowrap p-1">
                    <span class="meta_field_col_name font-bold text-sm mr-2 w-28 overflow-hidden inline-block">${numStr} ${category}</span>
                    <span class="meta_field_col_value">${value}</span>
                    </div>`;
        });
        const title = match.metadata.title || "";
        return `
            <div class="semantic_result_card rounded border mr-1 mb-2 p-2 ${matchedClass}" data-songcardid="${match.id}">
                <div class="flex flex-row">
                    <div class="flex-1 font-bold">
                    <h4>${title}</h4>
                    ${url}</div>
                    <div>${similarityScore}</div>
                </div>
                <div class="h-[150px] flex flex-row">
                    <div class="whitespace-pre-wrap overflow-auto flex-1">${match.fullText}</div>
                    <div class="overflow-auto flex-1 pl-2">${metaString}</div>
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
        this.runningQuery = false;
        return;
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
                        <select class="form-select-ts w-16" data-filterindex="${filterIndex}">
                            <option value="$lte" ${lessThan}>&#8804;</option>
                            <option value="$gte" ${greaterThan}>&#8805</option>
                            <option value="$e" ${numberEqual}># number</option>
                            <option value="$se" ${stringEqual}>$ string</option>
                        </select>
                    </div>
                    <div>
                        <input type="text" class="filter-input-value form-input-ts w-12" value="${filter.value}" data-filterindex="${filterIndex}">
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
        this.llm_analyze_prompt_button.setAttribute("disabled", "");
        this.llm_analyze_prompt_button.innerHTML = `<span>
        <lottie-player src="media/heartlottie.json" background="transparent" speed="1"
        style="height:100px;width:100px;align-self:center;" loop autoplay></lottie-player></span>`;

        document.body.classList.remove("initial");
        document.body.classList.add("running");
        document.body.classList.remove("complete");

        this.llm_full_augmented_response.innerHTML = "Processing Query...<br><br>";
        if (this.semanticEnabled) {
            await this.lookupDocumentChunks();
        }

        this.llm_full_augmented_response.innerHTML = await this.sendPromptToLLM();

        this.llm_analyze_prompt_button.removeAttribute("disabled");
        this.llm_analyze_prompt_button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
      </svg> `;
        document.body.classList.add("complete");
        document.body.classList.remove("running");

        return;
    }
    async lookupDocumentChunks() {
        await chrome.storage.local.set({
            semanticResults: {
                success: true,
                matches: []
            }
        });
        const message = this.llm_analyze_prompt_textarea.value.trim();
        const result = await this.extCommon.querySemanticChunks(message);
        console.log("query results", result);
        if (result.success === false) {
            console.log("FAILED TO FETCH", result);
            this.llm_full_augmented_response.innerHTML = "Error fetching results. Please refer to console for details.";
            return [];
        }

        if (!result.success) {
            console.log("error", result);
            this.llm_full_augmented_response.innerHTML = result.errorMessage;
            return [];
        } else {
            console.log(result);
        }

        let matches = this.filterUniqueDocs(result.matches);
        await this.extCommon.fetchDocumentsLookup(matches.map((match: any) => match.id));

        await chrome.storage.local.set({ semanticResults: result });
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
    async sendPromptToLLM(): Promise<string> {
        let message = this.llm_analyze_prompt_textarea.value.trim();
        if (!message) {
            return "please supply a message";
        }

        if (this.semanticEnabled) {
            const semanticResults = await this.extCommon.getStorageField("semanticResults");
            message = await this.embedPrompt(message, semanticResults.matches);
            console.log("embedded message", message);
        }
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
        const lookUpIndex = this.lookUpKeys.indexOf(matchId);
        let firstIndex = lookUpIndex - Math.floor(includeK / 2);
        let lastIndex = lookUpIndex + Math.ceil(includeK / 2);
        if (firstIndex < 0) firstIndex = 0;
        if (lastIndex > this.lookUpKeys.length - 1) lastIndex = this.lookUpKeys.length - 1;
        const parts = matchId.split("_");
        const docID = parts[0];
        let text = "";
        for (let i = firstIndex; i <= lastIndex; i++) {
            const chunkKey = this.lookUpKeys[i];
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
    async embedPrompt(prompt: string, matches: any[]): Promise<string> {
        const embedIndex = Number(await this.extCommon.getStorageField("selectedEmbeddingType")) || 0;
        const selectedSemanticPromptTemplate = await this.extCommon.getStorageField("selectedSemanticPromptTemplate") || "Answer with Doc Summary";
        const promptTemplate = this.extCommon.semanticPromptTemplatesMap[selectedSemanticPromptTemplate];
        let documentsEmbedText = "";
        let includeK = this.extCommon.chunkSizeMeta.topK;
        let halfK = Math.ceil(includeK / 2);
        // include K chunks as doc
        if (embedIndex === 0) {
            let filteredMatches = this.filterUniqueDocs(matches);
            const includes = filteredMatches.slice(0, includeK);
            await this.extCommon.fetchDocumentsLookup(includes.map((match: any) => match.id));
            includes.forEach((match: any, index: number) => {
                const merge = Object.assign({}, match.metadata);
                merge.id = match.id;
                merge.matchIndex = index;
                merge.text = this.extCommon.lookupData[match.id];
                merge.prompt = prompt;
                if (!merge.text) {
                    console.log("missing merge", match.id, this.extCommon.lookupData)
                    merge.text = "";
                }
                merge.text = merge.text.replaceAll("\n", " ");
                documentsEmbedText += Mustache.render(promptTemplate.documentPrompt, merge);
            });
            await chrome.storage.local.set({
                semanticIncludeMatchIndexes: includes,
            });
            // include halfK doc w/ halfK chunks
        } else if (embedIndex === 1) {
            let filteredMatches = this.filterUniqueDocs(matches);
            const includes = filteredMatches.slice(0, halfK);
            await this.extCommon.fetchDocumentsLookup(includes.map((match: any) => match.id));
            includes.forEach((match: any, index: number) => {
                const merge = Object.assign({}, match.metadata);
                merge.id = match.id;
                merge.matchIndex = index;
                merge.text = this.getSmallToBig(match.id, halfK);
                merge.prompt = prompt;
                if (!merge.text) {
                    console.log("missing merge", match.id, this.extCommon.lookupData)
                    merge.text = "";
                }
                merge.text = merge.text.replaceAll("\n", " ");
                documentsEmbedText += Mustache.render(promptTemplate.documentPrompt, merge);
            });

            await chrome.storage.local.set({
                semanticIncludeMatchIndexes: includes,
            });
            // include 1 doc w includeK chunks
        } else if (embedIndex === 2) {
            const match = matches[0];
            await this.extCommon.fetchDocumentsLookup([match.id]);
            const merge = Object.assign({}, match.metadata);
            merge.id = match.id;
            merge.matchIndex = 0;
            merge.prompt = prompt;
            merge.text = this.getSmallToBig(match.id, includeK);
            merge.text = merge.text.replaceAll("\n", " ");
            documentsEmbedText += Mustache.render(promptTemplate.documentPrompt, merge);
            await chrome.storage.local.set({
                semanticIncludeMatchIndexes: [merge],
            });
        }

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