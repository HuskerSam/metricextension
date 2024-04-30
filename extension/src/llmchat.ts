import { AnalyzerExtensionCommon } from './extensioncommon';
declare const chrome: any;

export default class LLMChatApp {
    extCommon = new AnalyzerExtensionCommon(chrome);
    llm_analyze_prompt_button = document.querySelector('.llm_analyze_prompt_button') as HTMLButtonElement;
    running = false;
    llm_analyze_prompt_textarea = document.querySelector('.llm_analyze_prompt_textarea') as HTMLTextAreaElement;
    summary_details = document.querySelector('.summary_details') as HTMLDivElement;
    llm_full_augmented_response = document.querySelector('.llm_full_augmented_response') as HTMLDivElement;
    llm_prompt_template_select_preset = document.querySelector('.llm_prompt_template_select_preset') as HTMLSelectElement;
    llm_prompt_template_text_area = document.querySelector('.llm_prompt_template_text_area') as HTMLTextAreaElement;
    llm_document_template_text_area = document.querySelector('.llm_document_template_text_area') as HTMLTextAreaElement;
    llm_embedding_type_select = document.querySelector('.llm_embedding_type_select') as HTMLSelectElement;
    uniqueDocsCheck = document.body.querySelector(".uniqueDocsCheck") as HTMLInputElement;
    verboseDebugging = false;
    semanticResults: any[] = [];
    lookUpKeys: string[] = [];
    semanticEnabled = false;

    constructor() {
        this.llm_analyze_prompt_button.addEventListener("click", () => this.analyzePrompt());
        this.llm_prompt_template_select_preset.addEventListener("input", async () => {
            const selectedSemanticPromptTemplate = this.llm_prompt_template_select_preset.value;
            await chrome.storage.local.set({ selectedSemanticPromptTemplate });
            this.paintPromptTemplateView();
        });
    }   
     async analyzePrompt() {
        if (this.running) {
            alert("already running");
            return;
        }
        const message = this.llm_analyze_prompt_textarea.value.trim();
        if (!message || message.length < 10) {
            alert("please supply a message of at least 10 characters");
            return [];
        }
        this.llm_analyze_prompt_button.setAttribute("disabled", "");
        this.llm_analyze_prompt_button.innerHTML = `<span>
        <lottie-player src="media/heartlottie.json" background="transparent" speed="1"
        style="height:100px;width:100px;align-self:center;" loop autoplay></lottie-player></span>`;
        this.summary_details.innerHTML = "Compiling Prompt...";
        this.running = true;

        document.body.classList.remove("initial");
        document.body.classList.add("running");
        document.body.classList.remove("complete");

        this.llm_full_augmented_response.innerHTML = "Processing Query...<br><br>";
        if (this.semanticEnabled) {
            this.semanticResults = [];// await this.lookupAIDocumentChunks();
//            this._addFeedHandlers();
        }

        this.llm_full_augmented_response.innerHTML = await this.sendPromptToLLM();
     //   this._addFeedHandlers();

        this.llm_analyze_prompt_button.removeAttribute("disabled");
        this.llm_analyze_prompt_button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
      </svg> `;
        this.running = false;
        document.body.classList.add("complete");
        document.body.classList.remove("running");

        return;
    }
    async sendPromptToLLM(): Promise<string> {
        const message = this.llm_analyze_prompt_textarea.value.trim();
        if (!message) {
            return "please supply a message";
        }

        if (this.semanticEnabled) {
        //    prompt = await this.embedPrompt(message, this.semanticResults);
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
        const embedIndex = this.llm_embedding_type_select.selectedIndex;
        const promptTemplate = this.llm_prompt_template_text_area.value;
        const documentTemplate = this.llm_document_template_text_area.value;
        const promptT = (<any>window).Handlebars.compile(promptTemplate);
        const docT = (<any>window).Handlebars.compile(documentTemplate);
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
                documentsEmbedText += (<any>docT)(merge);
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
                documentsEmbedText += (<any>docT)(merge);
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
            documentsEmbedText += (<any>docT)(merge);
        }

        const mainMerge = {
            documents: documentsEmbedText,
            prompt,
        };
        return (<any>promptT)(mainMerge);
    }
    async paintPromptTemplateView() {
        const selectedSemanticPromptTemplate = (await this.extCommon.getStorageField("selectedSemanticPromptTemplate"))|| "Answer with Doc Summary";
        const promptTemplate = this.extCommon.semanticPromptTemplatesMap[selectedSemanticPromptTemplate];

        this.llm_prompt_template_text_area.value = promptTemplate.mainPrompt;
        this.llm_document_template_text_area.value = promptTemplate.documentPrompt;
        this.llm_prompt_template_select_preset.value = selectedSemanticPromptTemplate;
    }
    paint() {
        this.paintPromptTemplateView();
    }
}
