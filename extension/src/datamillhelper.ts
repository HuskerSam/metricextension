import { AnalyzerExtensionCommon } from './extensioncommon';
import { prompts } from "./metrics";
const metricCategories = ['romantic', 'comedic', 'inappropriatelanguage', 'mature', 'seasonal', 'motivational', 'political', 'religious', 'sad', 'violent'];


declare const chrome: any;
export default class DataMillHelper {
    extCommon = new AnalyzerExtensionCommon(chrome);
    byVerseAPIToken = "9b2b6dcc-900d-4051-9947-a42830853d86";
    byVerseSessionId = "lh3a4fui9n7j";
    byChapterToken = "a1316745-313f-4bdf-b073-3705bf11a0e7";
    byChapterSessionId = "vkuyk8lg74nq";
    promptUrl = `https://us-central1-promptplusai.cloudfunctions.net/lobbyApi/session/external/message`;
    queryUrl = `https://us-central1-promptplusai.cloudfunctions.net/lobbyApi/session/external/vectorquery`;
    loaded = false;
    lookUpKeys: string[] = [];
    lookedUpIds: any = {};
    lookupData: any = {};
    songMatchLookup: any = {};
    metricPromptMap: any = {};
    displayDocHtmlDoc: any = {};
    lastSearchMatches: any[] = [];
    metricPrompts: any[] = [];
    selectedFilters: any[] = [];
    full_augmented_response = document.querySelector(".full_augmented_response") as HTMLDivElement;
    analyze_prompt_textarea = document.querySelector(".analyze_prompt_textarea") as HTMLTextAreaElement;
    analyze_prompt_button = document.querySelector(".analyze_prompt_button") as HTMLButtonElement;
    filter_container = document.body.querySelector(".filter_container") as HTMLDivElement;
    metric_filter_select = document.body.querySelector(".metric_filter_select") as HTMLSelectElement;


    runningQuery = false;

    constructor() {
        this.analyze_prompt_button.addEventListener("click", async () => {
            this.analyze_prompt_button.disabled = true;
            this.analyze_prompt_textarea.select();
            this.analyze_prompt_button.innerHTML = "...";
            await this.renderSongSearchChunks();
            this.analyze_prompt_button.disabled = false;
            this.analyze_prompt_button.innerHTML = "Analyze";
        });
        this.metric_filter_select.addEventListener("input", () => this.addMetricFilter());
        this.load();
    }
    load() {
        this.metricPrompts = prompts;
        this.loaded = true;
        this.lookupData = {};
        this.lookedUpIds = {};
        this.metricPromptMap = {};
        this.metricPrompts.forEach((prompt: any) => {
            this.metricPromptMap[prompt.id] = prompt;
        });
    }
    renderFilters() {
        this.filter_container.innerHTML = "";
        this.selectedFilters.forEach((filter: any, filterIndex: number) => {
            let filterDiv = document.createElement("div");
            filterDiv.classList.add("filter-element");
            filterDiv.innerHTML = this.selectedFilterTemplate(filter, filterIndex);
            this.filter_container.appendChild(filterDiv);
        });
        this.filter_container.querySelectorAll(".delete-button").forEach((button) => {
            (button as HTMLButtonElement).addEventListener("click", () => {
                let filterIndex = Number(button.getAttribute("data-filterindex"));
                this.selectedFilters.splice(filterIndex, 1);
                this.renderFilters();
            });
        });
        this.filter_container.querySelectorAll(".filter-select select").forEach((select: Element) => {
            select.addEventListener("input", () => {
                let filterIndex = Number(select.getAttribute("data-filterindex"));
                this.selectedFilters[filterIndex].operator = (select as any).value;
            });
        });
        this.filter_container.querySelectorAll(".filter-value select").forEach((select: Element) => {
            select.addEventListener("input", () => {
                let filterIndex = Number(select.getAttribute("data-filterindex"));
                this.selectedFilters[filterIndex].value = (select as any).value;
            });
        });
        let html = "<option>metric...</option>";
        this.metricPrompts.forEach((prompt: any) => {
            let promptUsed = false;
            this.selectedFilters.forEach((filter: any) => {
                if (filter.metaField === prompt.id) promptUsed = true;
            });
            if (promptUsed === false) html += `<option value="${prompt.id}">${prompt.title}</option>`;
        });
        this.metric_filter_select.innerHTML = html;
    }
    async renderSongSearchChunks() {
        if (this.runningQuery === true) return;
        this.full_augmented_response.innerHTML = `<span class="text-light">Search running...</span>`;
        this.runningQuery = true;
        const message = this.analyze_prompt_textarea.value.trim();
        const chunkSizeMeta = this.getChunkSizeMeta();
        let result = await this.getMatchingVectors(message, chunkSizeMeta.topK, chunkSizeMeta.apiToken, chunkSizeMeta.sessionId);
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
                let similarityScore = `<span class="similarity_score_badge">${(match.score * 100).toFixed()}%</span>`;
                let catString = ``;
                metricCategories.forEach(category => {
                    if (match.metadata[category] !== 0) {
                        catString += `
                            <span class="badge bg-primary me-1">${this.metricPromptMap[category].title}: ${match.metadata[category]}</span>`;
                    }
                });
                return `
                    <div class="song_card card mb-1 text-white" data-songcardid="${match.id}" style="background:rgba(50, 50, 50, .25);">
                        <div class="card-body match-card">
                            <div class="d-flex">
                                <div class="me-3" style="display:flex; flex-direction:column; justify-content:center; align-items:center;">
                                    ${similarityScore}
                                </div>
                                <div style="flex:1">
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <h5 class="card-title" style="flex:1">${match.metadata.artist} - ${match.metadata.title}</h5>
                                        <button class="btn play_song me-2 text-white" data-song="${match.id}">
                                            <i class="material-icons">play_arrow</i>
                                        </button>
                                        <button class="btn add_song text-white" data-song="${match.id}">
                                            <i class="material-icons">playlist_add</i>
                                        </button>
                                    </div>
                                    <div style="display:flex; flex-direction:row;">
                                        <div style="flex:1">${catString}</div>
                                        <div>
                                            <button class="btn show_lyrics_modal text-white" data-song="${match.id}">
                                                <i class="material-icons">lyrics</i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
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
    addMetricFilter() {
        const metaField = this.metric_filter_select.value;
        this.selectedFilters.push({ metaField, value: 1, operator: "$gte" });
        this.renderFilters();
        this.metric_filter_select.selectedIndex = 0;
    }
    async getMatchingVectors(message: string, topK: number, apiToken: string, sessionId: string): Promise<any> {
        const body = {
            message,
            apiToken,
            sessionId,
            topK,
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
            let lookupPath = this.getChunkSizeMeta().lookupPath;
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
    getChunkSizeMeta(): any {
        return {
            apiToken: "cfbde57f-a4e6-4eb9-aea4-36d5fbbdad16",
            sessionId: "8umxl4rdt32x",
            lookupPath: "https://firebasestorage.googleapis.com/v0/b/promptplusai.appspot.com/o/projectLookups%2FHlm0AZ9mUCeWrMF6hI7SueVPbrq1%2Fsong-demo-v3%2FbyDocument%2FDOC_ID_URIENCODED.json?alt=media",
            topK: 15,
        };
    }
    generateDisplayText(matchId: string, highlight = false): string {
        const displayDocHTML = this.lookupData[matchId];
        return displayDocHTML;
    }
    selectedFilterTemplate(filter: any, filterIndex: number): string {
        const title = this.metricPromptMap[filter.metaField].title;
        const lessThan = filter.operator === "$lte" ? "selected" : "";
        const greaterThan = filter.operator === "$gte" ? "selected" : "";
        return `<div class="filter-header">
                    <span class="metric-filter-title">${title}</span>
                    </div>
                    <div class="filter-body">
                    <div class="filter-select">
                        <select class="bg-dark text-white" data-filterindex="${filterIndex}">
                        <option value="$lte" ${lessThan}>≤</option>
                        <option value="$gte" ${greaterThan}>≥</option>
                        </select>
                    </div>
                    <div class="filter-value">
                        <select class="bg-dark text-white" data-filterindex="${filterIndex}">
                        ${Array.from({ length: 11 }, (_, i) => `<option value="${i}" ${Number(filter.value) === i ? 'selected' : ''}>${i}</option>`).join('')}
                        </select>
                    </div>
                    </div>
                    <button class="delete-button bg-dark text-white" data-filterindex="${filterIndex}">
                    <i class="material-icons">close</i>
                    </button>`;
    }
}