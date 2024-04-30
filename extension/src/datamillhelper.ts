import { AnalyzerExtensionCommon } from './extensioncommon';

declare const chrome: any;
export default class DataMillHelper {
    extCommon = new AnalyzerExtensionCommon(chrome);
    promptUrl = `https://us-central1-promptplusai.cloudfunctions.net/lobbyApi/session/external/message`;
    songMatchLookup: any = {};
    displayDocHtmlDoc: any = {};
    lastSearchMatches: any[] = [];
    dmtab_change_session_select = document.querySelector(".dmtab_change_session_select") as HTMLSelectElement;
    full_augmented_response = document.querySelector(".full_augmented_response") as HTMLDivElement;
    analyze_prompt_textarea = document.querySelector(".analyze_prompt_textarea") as HTMLTextAreaElement;
    analyze_prompt_button = document.querySelector(".analyze_prompt_button") as HTMLButtonElement;
    filter_container = document.body.querySelector(".filter_container") as HTMLDivElement;
    dmtab_add_meta_filter_button = document.body.querySelector(".dmtab_add_meta_filter_button") as HTMLButtonElement;
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
            const result = await this.runSemanticQuery();
            this.analyze_prompt_button.disabled = false;
            if (result.success) {
                await this.renderSearchChunks(result);
                this.analyze_prompt_button.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m15.75 15.75-2.489-2.489m0 0a3.375 3.375 0 1 0-4.773-4.773 3.375 3.375 0 0 0 4.774 4.774ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg> &nbsp; Search`;
            } else {
                //handle error
            }
            document.body.classList.remove("semantic_search_running");
        });
        this.dmtab_change_session_select.addEventListener("change", async () => {
            const selectedValue = this.dmtab_change_session_select.value;
            await this.extCommon.selectSemanticSource(selectedValue);
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
    }
    paintData() {
        this.renderFilters();
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
        this.full_augmented_response.innerHTML = `<div class="hidden flex-col flex-1 semantic_search_running_loader h-full justify-center text-center align-middle">
        <lottie-player src="media/lottie.json" background="transparent" speed="1" class="w-12 h-12 self-center inline-block" loop
          autoplay></lottie-player>
          <span class="font-bold text-lg">Search running...</span>
        </div>`;
        if (this.runningQuery === true) {
            return {
                success: false,
            };
        }
        this.runningQuery = true;

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
            this.full_augmented_response.innerHTML = "Error fetching results. Please refer to console for details.";
            this.runningQuery = false;
        }

        return result;
    }
    semanticChunkResultCardHTML(match: any): string {
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
            <div class="rounded border mr-1 mb-2 p-2" data-songcardid="${match.id}">
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
        await this.extCommon.fetchDocumentsLookup(result.matches.map((match: any) => match.id));
        result.matches.forEach((match: any) => {
            this.songMatchLookup[match.id] = match;
            let displayDocHTML = this.generateDisplayText(match.id, true);
            match.fullText = this.generateDisplayText(match.id);
            if (!displayDocHTML) {
                console.log(match.id, this.extCommon.lookupData)
            }

            let block = this.semanticChunkResultCardHTML(match);
            this.displayDocHtmlDoc[match.id] = displayDocHTML;
            html += block;
        });

        this.lastSearchMatches = result.matches;

        this.full_augmented_response.innerHTML = html;

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
        this.dmtab_add_meta_filter_button.value = selectedSemanticSource;

        await this.extCommon.selectSemanticSource(selectedSemanticSource);
    }
}