import { AnalyzerExtensionCommon } from './extensioncommon';
import { prompts } from "./metrics";
import chunkSizeMetaData from './dmdefaultindexes.json';

declare const chrome: any;
export default class DataMillHelper {
    extCommon = new AnalyzerExtensionCommon(chrome);
    promptUrl = `https://us-central1-promptplusai.cloudfunctions.net/lobbyApi/session/external/message`;
    queryUrl = `https://us-central1-promptplusai.cloudfunctions.net/lobbyApi/session/external/vectorquery`;
    loaded = false;
    lookUpKeys: string[] = [];
    lookedUpIds: any = {};
    lookupData: any = {};
    songMatchLookup: any = {};
    displayDocHtmlDoc: any = {};
    lastSearchMatches: any[] = [];
    metricPrompts: any[] = [];
    selectedFilters: any[] = [];
    dmtab_change_session_select = document.querySelector(".dmtab_change_session_select") as HTMLSelectElement;
    chunkSizeMeta: any = {
        apiToken: "",
        sessionId: "",
        lookupPath: "",
        topK: 10,
        numberOfParts: 0,
    };
    full_augmented_response = document.querySelector(".full_augmented_response") as HTMLDivElement;
    analyze_prompt_textarea = document.querySelector(".analyze_prompt_textarea") as HTMLTextAreaElement;
    analyze_prompt_button = document.querySelector(".analyze_prompt_button") as HTMLButtonElement;
    filter_container = document.body.querySelector(".filter_container") as HTMLDivElement;
    dmtab_add_meta_filter_button = document.body.querySelector(".dmtab_add_meta_filter_button") as HTMLButtonElement;
    runningQuery = false;

    constructor() {
        this.load();
        this.loadSessionData();
        this.analyze_prompt_button.addEventListener("click", async () => {
            this.analyze_prompt_button.disabled = true;
            this.analyze_prompt_textarea.select();
            this.analyze_prompt_button.innerHTML = "...";
            this.saveSelectFilters();
            document.body.classList.add("semantic_search_running");
            await this.renderSongSearchChunks();
            this.analyze_prompt_button.disabled = false;
            this.analyze_prompt_button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="m15.75 15.75-2.489-2.489m0 0a3.375 3.375 0 1 0-4.773-4.773 3.375 3.375 0 0 0 4.774 4.774ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg> &nbsp; Search`;
            document.body.classList.remove("semantic_search_running");
        });
        this.dmtab_change_session_select.addEventListener("change", () => {
            const selectedValue = Number(this.dmtab_change_session_select.value);
            this.chunkSizeMeta = chunkSizeMetaData[selectedValue];
            this.load();
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
    async load() {
        this.metricPrompts = prompts;
        this.loaded = true;
        this.lookupData = {};
        this.lookedUpIds = {};
        this.paintData();
    }
    async loadSessionData() {
        this.selectedFilters = (await this.extCommon.getStorageField("selectedSemanticFilters")) || [];

        let chunkSizeMetaDataKeys = Object.keys(chunkSizeMetaData);
        let chunkTitles: any = chunkSizeMetaDataKeys.map((key: string) => chunkSizeMetaData[Number(key)].title);
        let chunkValues = chunkSizeMetaDataKeys.map((key: string) => key);
        this.dmtab_change_session_select.innerHTML = "";
        chunkTitles.forEach((title: string, index: number) => {
            let option = document.createElement("option");
            option.value = chunkValues[index];
            option.text = title;
            this.dmtab_change_session_select.appendChild(option);
        });
        this.chunkSizeMeta = chunkSizeMetaData[Number(chunkValues[0])];
        this.dmtab_change_session_select.value = chunkValues[0];
        this.dmtab_change_session_select.dispatchEvent(new Event("change"));
        this.saveSelectFilters();
    }
    paintData() {
        this.renderFilters();
    }
    renderFilters() {
        this.filter_container.innerHTML = "";
        this.selectedFilters.forEach((filter: any, filterIndex: number) => {
            let filterDiv = document.createElement("div");
            filterDiv.classList.add("filter_chips");
            filterDiv.innerHTML = this.selectedFilterTemplate(filter, filterIndex);
            this.filter_container.appendChild(filterDiv);
        });
        this.filter_container.querySelectorAll(".delete-button").forEach((button) => {
            (button as HTMLButtonElement).addEventListener("click", () => {
                let filterIndex = Number(button.getAttribute("data-filterindex"));
                this.selectedFilters.splice(filterIndex, 1);
                this.renderFilters();
                this.saveSelectFilters();
            });
        });
        this.filter_container.querySelectorAll(".filter-input-value").forEach((ele: Element) => {
            ele.addEventListener("input", () => {
                let filterIndex = Number(ele.getAttribute("data-filterindex"));
                this.selectedFilters[filterIndex].value = (ele as HTMLInputElement).value;
            });
        });
        this.filter_container.querySelectorAll(".filter-input-value").forEach((ele: Element) => {
            ele.addEventListener("input", () => {
                let filterIndex = Number(ele.getAttribute("data-filterindex"));
                this.selectedFilters[filterIndex].value = (ele as HTMLInputElement).value;
            });
        });
        this.filter_container.querySelectorAll(".filter-select select").forEach((select: Element) => {
            select.addEventListener("input", () => {
                let filterIndex = Number(select.getAttribute("data-filterindex"));
                this.selectedFilters[filterIndex].operator = (select as any).value;
                this.saveSelectFilters();
            });
        });
    }
    async saveSelectFilters() {
        await chrome.storage.local.set({ "selectedSemanticFilters": this.selectedFilters });
    }
    async renderSongSearchChunks() {
        if (this.runningQuery === true) return;
        this.full_augmented_response.innerHTML = `
        <div class="hidden flex-col flex-1 semantic_search_running_loader h-full justify-center text-center align-middle">
        <lottie-player src="media/lottie.json" background="transparent" speed="1" class="w-12 h-12 self-center inline-block" loop
          autoplay></lottie-player>
          <span class="font-bold text-lg">Search running...</span>
        </div>`;
        this.runningQuery = true;
        const message = this.analyze_prompt_textarea.value.trim();
        let result = await this.getMatchingVectors(message, this.chunkSizeMeta.topK,
            this.chunkSizeMeta.apiToken, this.chunkSizeMeta.sessionId);
        if (result.success === false) {
            console.log("FAILED TO FETCH", result);
            this.full_augmented_response.innerHTML = "Error fetching results. Please refer to console for details.";
            this.runningQuery = false;
            return;
        }

        let html = "";
        await this.fetchDocumentsLookup(result.matches.map((match: any) => match.id));
        result.matches.forEach((match: any) => {
            this.songMatchLookup[match.id] = match;
            let displayDocHTML = this.generateDisplayText(match.id, true);
            match.fullText = this.generateDisplayText(match.id);
            if (!displayDocHTML) {
                console.log(match.id, this.lookupData)
            }

            const generateSongCard = (match: any) => {
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
            let block = generateSongCard(match);
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
        this.selectedFilters.push({ metaField, value: "", operator: "$se" });
        this.renderFilters();
        this.saveSelectFilters();
    }
    async getMatchingVectors(message: string, topK: number, apiToken: string, sessionId: string): Promise<any> {
        const filter: any = {};
        this.selectedFilters.forEach((selectedFilter: any) => {
            if (selectedFilter.operator === "$se") {
                filter[selectedFilter.metaField] = { ["$eq"]: selectedFilter.value };
            } else if (selectedFilter.operator === "$e") {
                const value = Number(selectedFilter.value) || 0;
                filter[selectedFilter.metaField] = { ["$eq"]: value };
            } else {
                filter[selectedFilter.metaField] = { [selectedFilter.operator]: Number(selectedFilter.value) };
            }
        });

        const body = {
            message,
            apiToken,
            sessionId,
            topK,
            filter,
        };
        const fetchResults = await fetch(this.queryUrl, {
            method: "POST",
            mode: "cors",
            cache: "no-cache",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        return await fetchResults.json();
    }
    async fetchDocumentsLookup(idList: string[]) {
        const promises: any[] = [];
        const docIdMap: any = {};
        idList.forEach((chunkId: string) => {
            const parts = chunkId.split("_");
            let docId = parts[0];
            if (this.chunkSizeMeta.numberOfParts === 2) {
                docId = parts[0] + "_" + parts[1];
            } else if (this.chunkSizeMeta.numberOfParts === 3) {
                docId = parts[0] + "_" + parts[1] + "_" + parts[2];
            }
            if (this.lookedUpIds[docId] !== true)
                docIdMap[docId] = true;
        });
        Object.keys(docIdMap).forEach((id: string) => promises.push(this.loadDocumentLookup(id)));
        let chunkMaps = await Promise.all(promises);
        chunkMaps.forEach((chunkMap: any) => {
            Object.keys(chunkMap).forEach((chunkId: string) => {
                this.lookupData[chunkId] = chunkMap[chunkId];
            });
        });
        Object.assign(this.lookedUpIds, docIdMap);
        this.lookUpKeys = Object.keys(this.lookupData).sort();
    }
    async loadDocumentLookup(docId: string): Promise<any> {
        try {
            let lookupPath: string = this.chunkSizeMeta.lookupPath;
            lookupPath = lookupPath.replace("DOC_ID_URIENCODED", docId);
            console.log(lookupPath);
            const r = await fetch(lookupPath);
            const result = await r.json();
            return result;
        } catch (error: any) {
            console.log("FAILED TO FETCH CHUNK MAP", docId, error);
            return {};
        }
    }
    generateDisplayText(matchId: string, highlight = false): string {
        const displayDocHTML = this.lookupData[matchId];
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
                <button class="delete-button" data-filterindex="${filterIndex}">X</button>`;
    }
}