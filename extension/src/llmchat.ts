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

}