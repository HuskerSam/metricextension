import chunkSizeMetaData from './dmdefaultindexes.json';
import semanticPromptTemplates from '../defaults/semanticPromptTemplates.json';
import { AnalyzerExtensionCommon } from './extensioncommon';
import Mustache from 'mustache';

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
            });
        }
        await this.semanticLoad();
    }
    async querySemanticChunks(message: string) {
        let selectedSemanticSource = await this.getSelectedSemanticSource();
        const chunkSizeMeta = this.chunkSizeMetaDataMap[selectedSemanticSource];
        this.chunkSizeMeta = chunkSizeMeta;
        let topK = await this.extCommon.getStorageField("topK");
        if (!topK || topK < 1) topK = 15;
        let apiToken = chunkSizeMeta.apiToken;
        let sessionId = chunkSizeMeta.sessionId;
        if (chunkSizeMeta.useDefaultSession) {
            topK = 15;
            sessionId = await this.chrome.storage.local.get('sessionId');
            sessionId = sessionId?.sessionId || "";
            apiToken = await this.chrome.storage.local.get('apiToken');
            apiToken = apiToken?.apiToken || "";
        }
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
    async getSelectedSemanticSource() {
        return (await this.extCommon.getStorageField("selectedSemanticSource")) || "song full lyrics chunk";
    }
    async getPromptTemplates() {
        const defaultPromptsNames = Object.keys(this.semanticPromptTemplatesMap);
        const defaultPrompts = this.semanticPromptTemplatesMap[defaultPromptsNames[0]];
        let promptTemplate = await this.extCommon.getStorageField("semanticQueryMainPromptTemplate");
        let documentTemplate = await this.extCommon.getStorageField("semanticQueryDocumentPromptTemplate");
        if (!promptTemplate) {
            promptTemplate = defaultPrompts.mainPrompt;
            await this.chrome.storage.local.set({ semanticQueryMainPromptTemplate: promptTemplate });
        }
        if (!documentTemplate) {
            documentTemplate = defaultPrompts.documentPrompt;
            await this.chrome.storage.local.set({ semanticQueryDocumentPromptTemplate: documentTemplate });
        }
        return {
            promptTemplate,
            documentTemplate,
        };
    }
    async semanticQuery(): Promise<any> {
        const message = await this.extCommon.getStorageField("semanticQueryText");
        await this.chrome.storage.local.set({
            semanticResults: {
                success: true,
                matches: []
            },
            semantic_running: true,
        });
        if (!message) return;
        const semanticResults = await this.querySemanticChunks(message);
        if (semanticResults.success === false || !semanticResults.matches
            || semanticResults.matches.length === 0) {
            await this.chrome.storage.local.set({
                semanticResults,
                semanticChunkRows: [],
                semantic_running: false,
            });
            return;
        }
        await this.fetchDocumentsLookup(semanticResults.matches.map((match: any) => match.id));

        const chunkIncludedMap: any = {};
        let includeK = Number(await this.extCommon.getStorageField("semanticIncludeK"));
        if (!includeK || includeK < 1) includeK = 5; 
        const columnMap: any = {};
        const usedDocuments: any = {};
        const uniqueDocsChecked = (await this.extCommon.getStorageField("uniqueSemanticDocs")) === true;
        const eligibleDocs: any[] = [];
        semanticResults.matches.forEach((match: any) => {
            const parts = match.id.split("_");
            const docID = parts[0];
            if (!usedDocuments[docID] || !uniqueDocsChecked) {
                usedDocuments[docID] = true;
                eligibleDocs.push(match);
            }
        });

        eligibleDocs.slice(0, includeK).forEach((match: any) => {
            chunkIncludedMap[match.id] = true;
            Object.keys(match.metadata).forEach((key: string) => {
                columnMap[key] = true;
            });
        });

        const columnMapKeys = Object.keys(columnMap);
        const columnsUsed: any = {};
        const semanticChunkColumns: any[] = [{
            formatter: "rowSelection",
            titleFormatter: "rowSelection",
            headerSort: false,
            resizable: false,
            frozen: true,
            headerHozAlign: "center",
            hozAlign: "center",
            title: "",
        }, {
            title: "Id",
            field: "id",
            width: 100,
            headerSort: false,
        }, {
            title: "Text",
            field: "text",
            width: 300,
            headerSort: false,

        }];
        columnsUsed["include"] = true;
        columnsUsed["id"] = true;
        columnsUsed["text"] = true;
        columnMapKeys.forEach((key: string) => {
            if (!columnsUsed[key]) {
                semanticChunkColumns.push({
                    title: key,
                    field: key,
                    width: 100,
                    headerSort: false,
                });
                columnsUsed[key] = true;
            }
        });

        const semanticChunkRows: any = [];
        semanticResults.matches.forEach((match: any) => {
            match.fullText = this.lookupData[match.id];
            if (!match.fullText) {
                console.log(match.id, this.lookupData);
            }
            const chunkDetails: any = {};
            Object.assign(chunkDetails, match.metadata);
            chunkDetails.id = match.id;
            chunkDetails.text = match.fullText;
            chunkDetails.include = chunkIncludedMap[match.id] ? true : false;
            const keys = Object.keys(chunkDetails);
            keys.forEach((key: string) => {
                if (!columnMap[key]) {
                    columnMap[key] = true;
                }
            });
            semanticChunkRows.push(chunkDetails);
        });

        await this.chrome.storage.local.set({
            semanticResults,
            semanticChunkRows,
            semanticChunkColumns,
            semantic_running: false,
        });
    }
    async buildChunkEmbedText(message: string, semanticChunkRows: any[], includeSpanTags = false): Promise<string> {
        let documentsEmbedText = "";
        const contextK = Number(await this.extCommon.getStorageField("semanticContextK")) || 1;

        const includedRows = semanticChunkRows.filter((row: any) => row.include);
        const promptTemplates = await this.getPromptTemplates();
        await this.fetchDocumentsLookup(includedRows.map((row: any) => row.id));
        let documentTemplate = promptTemplates.documentTemplate;
        if (includeSpanTags) {
            documentTemplate = `<span class="document_embedded_chunk">${documentTemplate}</span>`;
        }
        includedRows.forEach((row: any, index: number) => {
            const merge = Object.assign({}, row);
            merge.text = this.getSmallToBig(row.id, contextK);
            merge.prompt = message;
            if (!merge.text) {
                console.log("missing merge", row.id, this.lookupData)
                merge.text = "";
            }
            merge.text = merge.text.replaceAll("\n", " ");
            documentsEmbedText += Mustache.render(documentTemplate, merge);
        });

        await this.chrome.storage.local.set({
            documentsEmbedText,
        });

        return documentsEmbedText;
    }
    async getEmbeddedPromptText(includeSpanTags = false): Promise<string> {
        const message = await this.extCommon.getStorageField("semanticQueryText") || "";
        if (!message) {
            console.log("getEmbeddedPromptText: no message found in storage");
        }
        const semanticChunkRows = await this.extCommon.getStorageField("semanticChunkRows") || [];
        let documentsEmbedText = await this.buildChunkEmbedText(message, semanticChunkRows, includeSpanTags);

        const promptTemplates = await this.getPromptTemplates();
        let promptT = promptTemplates.promptTemplate;
        if (includeSpanTags) {
            documentsEmbedText = `<span class="documents_embed_section">${documentsEmbedText}</span>`;
        }
        const mainMerge = {
            documents: documentsEmbedText,
            prompt: message,
        };
        const mainPrompt = Mustache.render(promptT, mainMerge);
        return mainPrompt;
    }
    getSmallToBig(matchId: string, contextK: number): string {
        const lookUpIndex = this.lookUpKeys.indexOf(matchId);
        let firstIndex = lookUpIndex - Math.floor(contextK / 2);
        let lastIndex = lookUpIndex + Math.ceil(contextK / 2);
        if (firstIndex < 0) firstIndex = 0;
        if (lastIndex > this.lookUpKeys.length - 1) lastIndex = this.lookUpKeys.length - 1;
        const parts = matchId.split("_");
        const docID = parts[0];
        let text = "";
        for (let i = firstIndex; i <= lastIndex; i++) {
            const chunkKey = this.lookUpKeys[i];
            if (!chunkKey) continue;
            if (chunkKey.indexOf(docID) === 0) {
                if (this.lookupData[chunkKey]) {
                    text = this.annexChunkWithoutOverlap(text, this.lookupData[chunkKey]);
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
            return text + chunkText.slice(startPos) + " ";
        }
        return text + chunkText + " ";
    }
}
