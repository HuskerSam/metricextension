import { AnalyzerExtensionCommon } from './extensioncommon';
import BulkHelper from './bulkhelper';
import PromptHelper from './prompthelper';
import HistoryHelper from './historyhelper';
declare const chrome: any;

export default class MainPageApp {
    extCommon = new AnalyzerExtensionCommon(chrome);
    bulkHelper: BulkHelper | null = null;
    promptHelper: PromptHelper | null = null;
    historyHelper: HistoryHelper | null = null;
    api_token_input = document.querySelector('.api_token_input') as HTMLInputElement;
    session_id_input = document.querySelector('.session_id_input') as HTMLInputElement;
    clearStorageButton = document.querySelector('.reset_chrome_storage') as HTMLButtonElement;
    session_anchor_label = document.querySelector('.session_anchor_label') as HTMLDivElement;
    session_anchor = document.querySelector('.session_anchor') as HTMLAnchorElement;
    clear_history = document.querySelector('.clear_history') as HTMLButtonElement;
    history_range_amount_select = document.querySelector('.history_range_amount_select') as HTMLSelectElement;
    open_side_panel_from_main = document.querySelector('.open_side_panel_from_main') as HTMLButtonElement;
    main_history_tab_view = document.querySelector('#main_history_tab_view') as HTMLDivElement;
    main_prompt_manager_tab_view = document.querySelector('#main_prompt_manager_tab_view') as HTMLDivElement;
    main_bulk_tab_view = document.querySelector('#main_bulk_tab_view') as HTMLDivElement;

    constructor() {
        this.load();
    }
    async loadHTMLTemplate(path: string, dom: any) {
        let htmlRequest = await fetch(path);
        let html = await htmlRequest.text();
        dom.innerHTML = html;
    }
    async load() {
        await this.loadHTMLTemplate("pages/history.html", this.main_history_tab_view);
        await this.loadHTMLTemplate("pages/bulk.html", this.main_bulk_tab_view);
        await this.loadHTMLTemplate("pages/prompts.html", this.main_prompt_manager_tab_view);
        this.bulkHelper = new BulkHelper();
        this.promptHelper = new PromptHelper();
        this.historyHelper = new HistoryHelper();
        this.initEventHandlers();

        // list for changes to local storage and update the UI
        chrome.storage.local.onChanged.addListener(() => {
            this.paintData();
        });
        this.paintData(true);
    }
    initEventHandlers() {
        this.open_side_panel_from_main.addEventListener('click', async () => this.extCommon.toggleSidePanel());
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

    async paintData(forceUpdate = false) {
        this.renderSettingsTab();  
        let historyRangeLimit = await chrome.storage.local.get('historyRangeLimit');
        historyRangeLimit = historyRangeLimit.historyRangeLimit || 20;     
        this.history_range_amount_select.value = historyRangeLimit;

        this.historyHelper?.renderHistoryDisplay();
        this.bulkHelper?.paintAnalysisHistory();
        this.bulkHelper?.paintBulkURLList(forceUpdate);
    }
}
