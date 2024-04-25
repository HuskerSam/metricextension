import { AnalyzerExtensionCommon } from './extensioncommon';
declare const chrome: any;

export default class SettingsHelper {
    extCommon = new AnalyzerExtensionCommon(chrome);
    api_token_input = document.querySelector('.api_token_input') as HTMLInputElement;
    session_id_input = document.querySelector('.session_id_input') as HTMLInputElement;
    clearStorageButton = document.querySelector('.reset_chrome_storage') as HTMLButtonElement;
    session_anchor_label = document.querySelector('.session_anchor_label') as HTMLDivElement;
    session_anchor = document.querySelector('.session_anchor') as HTMLAnchorElement;
    clear_history = document.querySelector('.clear_history') as HTMLButtonElement;
    history_range_amount_select = document.querySelector('.history_range_amount_select') as HTMLSelectElement;

    constructor() {
          this.api_token_input.addEventListener('input', async (e) => {
            let apiToken = this.api_token_input.value;
            chrome.storage.local.set({ apiToken });
        });
        this.session_id_input.addEventListener('input', async (e) => {
            let sessionId = this.session_id_input.value;
            chrome.storage.local.set({ sessionId });
        });
        this.history_range_amount_select.addEventListener('click', async (e) => {
            let amount = this.history_range_amount_select.value;
            chrome.storage.local.set({ historyRangeLimit: amount });
        });
        this.clearStorageButton.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all data? This will clear your session key. If you have custom prompts, download first.')) {
                await chrome.storage.local.clear();
                location.reload();
            }
        });
        this.clear_history.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all history?')) {
                await chrome.storage.local.set({ history: [] });
            }
        });
        this.paintData();
    }
    async renderSettingsTab() {
        let sessionConfig = await chrome.storage.local.get('sessionId');
        if (sessionConfig && sessionConfig.sessionId) {
            (<any>document.querySelector('.no_session_key')).style.display = 'none';
            this.session_anchor_label.innerHTML = 'Use link to visit Unacog Session: ';
            this.session_anchor.innerHTML = `Visit Session ${sessionConfig.sessionId}`;
            this.session_anchor.href = `https://unacog.com/session/${sessionConfig.sessionId}`;
            document.querySelector('#api-config-tab i')?.classList.remove('api-key-warning');
        } else {
            (<any>document.querySelector('.no_session_key')).style.display = 'block';
            this.session_anchor_label.innerHTML = 'Visit Unacog:';
            this.session_anchor.innerHTML = `Get Started`;
            this.session_anchor.href = `https://unacog.com/klyde`;
            (<any>document.querySelector('#api-config-tab i')).classList.add('api-key-warning');
        }

        let sessionId = await chrome.storage.local.get('sessionId');
        sessionId = sessionId.sessionId || '';
        this.session_id_input.value = sessionId;

        let apiToken = await chrome.storage.local.get('apiToken');
        apiToken = apiToken.apiToken || '';
        this.api_token_input.value = apiToken;
    }
    async paintData() {
        this.renderSettingsTab();  
        let historyRangeLimit = await chrome.storage.local.get('historyRangeLimit');
        historyRangeLimit = historyRangeLimit.historyRangeLimit || 20;     
        this.history_range_amount_select.value = historyRangeLimit;
    }
}