import chunkSizeMetaData from './dmdefaultindexes.json';
import semanticPromptTemplates from '../defaults/semanticPromptTemplates.json';
import { AnalyzerExtensionCommon } from './extensioncommon';

export class SemanticCommon {
    queryUrl = `https://us-central1-promptplusai.cloudfunctions.net/lobbyApi/session/external/vectorquery`;
    chrome: any;
    extCommon: AnalyzerExtensionCommon;
    lookUpKeys: string[] = [];
    lookedUpIds: any = {};
    lookupData: any = {};
    chunkSizeMeta: any = {
        apiToken: "",
        sessionId: "",
        lookupPath: "",
        topK: 10,
        numberOfParts: 0,
        useDefaultSession: false,
    };
    chunkSizeMetaDataMap: any = {};
    semanticPromptTemplatesMap: any = {};

    constructor(chrome: any) {
        this.chrome = chrome;
        this.extCommon = new AnalyzerExtensionCommon(chrome);

        chunkSizeMetaData.forEach((defaultData: any) => {
            let key = defaultData.title;
            if (!key) console.log("chunkSizeMetaData missing title", defaultData);
            this.chunkSizeMetaDataMap[key] = defaultData;
        });
        semanticPromptTemplates.forEach((defaultData: any) => {
            let key = defaultData.title;
            if (!key) console.log("semanticPromptTemplates missing title", defaultData);
            this.semanticPromptTemplatesMap[key] = defaultData;
        });
    }
    async getSemanticFilters() {
        return (await this.extCommon.getStorageField("selectedSemanticFilters")) || [];
    }
    async getMatchingVectors(message: string, topK: number, apiToken: string, sessionId: string): Promise<any> {
        const filter: any = {};
        const selectedSemanticMetaFilters = await this.getSemanticFilters();
        selectedSemanticMetaFilters.forEach((selectedFilter: any) => {
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
    async setSemanticRunning(prompt = false) {
        let semantic_running = await this.chrome.storage.local.get('semantic_running');
        if (semantic_running && semantic_running.semantic_running) {
            return true;
        }

        await this.chrome.storage.local.set({
            semantic_running: true,
        });
        return false;
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
    async semanticLoad() {
        this.lookupData = {};
        this.lookedUpIds = {};
    }
    async selectSemanticSource(selectedSemanticSource: string, clearStorage = false) {
        this.chunkSizeMeta = this.chunkSizeMetaDataMap[selectedSemanticSource];
        await this.chrome.storage.local.set({ selectedSemanticSource });
        if (clearStorage) {
            await this.chrome.storage.local.set({
                semanticResults: {
                    success: true,
                    matches: []
                },
                semanticIncludeMatchIndexes: [],
            });
        }
        await this.semanticLoad();
    }
    async querySemanticChunks(message: string) {
        let selectedSemanticSource = await this.getSelectedSemanticSource();
        const chunkSizeMeta = this.chunkSizeMetaDataMap[selectedSemanticSource];
        this.chunkSizeMeta = chunkSizeMeta;
        let topK = chunkSizeMeta.topK;
        let apiToken = chunkSizeMeta.apiToken;
        let sessionId = chunkSizeMeta.sessionId;
        if (chunkSizeMeta.useDefaultSession) {
            topK = 15;
            sessionId = await this.chrome.storage.local.get('sessionId');
            sessionId = sessionId?.sessionId || "";
            apiToken = await this.chrome.storage.local.get('apiToken');
            apiToken = apiToken?.apiToken || "";
        }
        console.log("querying semantic chunks", chunkSizeMeta, message, topK, apiToken, sessionId);
        const result = await this.getMatchingVectors(message, topK, apiToken, sessionId);
        return result;
    }
    async getSelectedSemanticSource() {
        return (await this.extCommon.getStorageField("selectedSemanticSource")) || "song full lyrics chunk";
    }
    async lookupDocumentChunks(): Promise<any> {
        const message = await this.extCommon.getStorageField("semanticQueryText");
        await this.chrome.storage.local.set({
            semanticResults: {
                success: true,
                matches: []
            },
            semantic_running: true,
            semanticIncludeMatchIndexes: [],
        });
        if (!message) return;
        const semanticResults = await this.querySemanticChunks(message);
        if (semanticResults.success === false) {
            console.log("FAILED TO FETCH", semanticResults);
        } else {
            let matches = await this.filterUniqueDocs(semanticResults.matches);
            await this.fetchDocumentsLookup(matches.map((match: any) => match.id));
        }

        await this.chrome.storage.local.set({
            semanticResults,
            semantic_running: false,
        });
    }
    async filterUniqueDocs(matches: any[]) {
        const uniqueDocsChecked = (await this.extCommon.getStorageField("uniqueDocsChecked")) === true;
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
}
