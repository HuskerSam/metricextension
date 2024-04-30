import { AnalyzerExtensionCommon } from './extensioncommon';
declare const chrome: any;

export default class LLMChatApp {
    extCommon = new AnalyzerExtensionCommon(chrome);
    llm_analyze_prompt_button = document.querySelector('.llm_analyze_prompt_button') as HTMLButtonElement;
    running = false;
    llm_analyze_prompt_textarea = document.querySelector('.llm_analyze_prompt_textarea') as HTMLTextAreaElement;
    summary_details = document.querySelector('.summary_details') as HTMLDivElement;
    llm_full_augmented_response = document.querySelector('.llm_full_augmented_response') as HTMLDivElement;
    semanticResults: any[] = [];
    semanticEnabled = false;

    constructor() {
        this.llm_analyze_prompt_button.addEventListener("click", () => this.analyzePrompt());
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
        this.llm_analyze_prompt_button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            <span class="visually-hidden">Loading...</span>`;
        this.summary_details.innerHTML = "Compiling Prompt...";
        this.running = true;

        document.body.classList.remove("initial");
        document.body.classList.add("running");
        document.body.classList.remove("complete");

        this.llm_full_augmented_response.innerHTML = "Processing Query...<br><br>";
        if (this.semanticEnabled) {
            this.semanticResults = [];// await this.lookupAIDocumentChunks();
            this.llm_full_augmented_response.innerHTML +=
                `<a class="response_verse_link p-2 mt-4" href="see verses">Top k Search Results</a> retrieved...
    <a class="response_detail_link p-2" href="see details">Prompt Details</a>`;
//            this._addFeedHandlers();
        }

        this.llm_full_augmented_response.innerHTML = await this.sendPromptToLLM();
        this.llm_full_augmented_response.innerHTML +=
            `<br><div class="d-flex flex-column link-primary" style="white-space:normal;">
<a class="response_verse_link p-2 mt-4" href="see verses">Top k Search Results</a>
<a class="response_detail_link p-2" href="see details">Prompt Details</a></div>`;
     //   this._addFeedHandlers();

        this.llm_analyze_prompt_button.removeAttribute("disabled");
        this.llm_analyze_prompt_button.innerHTML = `<span class="material-icons-outlined mt-1">
        send
        </span>`;
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

}