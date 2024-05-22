import { AnalyzerExtensionCommon } from './extensioncommon';
import MainPageApp from './mainpageapp';
declare const chrome: any;

export default class SettingsHelper {
    app: MainPageApp;
    extCommon: AnalyzerExtensionCommon;
    api_token_input = document.querySelector('.api_token_input') as HTMLInputElement;
    session_id_input = document.querySelector('.session_id_input') as HTMLInputElement;
    clearStorageButton = document.querySelector('.reset_chrome_storage') as HTMLButtonElement;
    session_anchor_label = document.querySelector('.session_anchor_label') as HTMLDivElement;
    session_anchor = document.querySelector('.session_anchor') as HTMLAnchorElement;
    clear_history = document.querySelector('.clear_history') as HTMLButtonElement;
    history_range_amount_select = document.querySelector('.history_range_amount_select') as HTMLSelectElement;
    show_analyze_text_in_context_menu = document.querySelector('.show_analyze_text_in_context_menu') as HTMLInputElement;
    show_query_text_in_context_menu = document.querySelector('.show_query_text_in_context_menu') as HTMLInputElement;
    scraped_length_character_limit = document.querySelector('.scraped_length_character_limit') as HTMLInputElement;
    show_analyze_selection_in_context_menu = document.querySelector('.show_analyze_selection_in_context_menu') as HTMLInputElement;
    show_query_selection_in_context_menu = document.querySelector('.show_query_selection_in_context_menu') as HTMLInputElement;
    export_history = document.querySelector('.export_history') as HTMLButtonElement;

    constructor(app: MainPageApp) {
        this.app = app;
        this.extCommon = app.extCommon;
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
        this.export_history.addEventListener('click', async () => {
            let history = await chrome.storage.local.get('history');
            history = history.history || [];
            let blob = new Blob([JSON.stringify(history)], { type: "application/json" });
            let url = URL.createObjectURL(blob);
            let a = document.createElement('a');
            document.body.appendChild(a);
            a.href = url;
            a.download = 'history.json';
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        });
        this.show_analyze_text_in_context_menu.addEventListener('input', async (e) => {
            let hideAnalyzeInPageContextMenu = !this.show_analyze_text_in_context_menu.checked;
            chrome.storage.local.set({ hideAnalyzeInPageContextMenu });
        });
        this.show_analyze_selection_in_context_menu.addEventListener('input', async (e) => {
            let hideAnalyzeInSelectionContextMenu = !this.show_analyze_selection_in_context_menu.checked;
            chrome.storage.local.set({ hideAnalyzeInSelectionContextMenu });
        });
        this.show_query_selection_in_context_menu.addEventListener('input', async (e) => {
            let showQueryInSelectionContextMenu = this.show_query_selection_in_context_menu.checked;
            chrome.storage.local.set({ showQueryInSelectionContextMenu });
        });
        this.show_query_text_in_context_menu.addEventListener('input', async (e) => {
            let showQueryInPageContextMenu = this.show_query_text_in_context_menu.checked;
            chrome.storage.local.set({ showQueryInPageContextMenu });
        });
        this.scraped_length_character_limit.addEventListener('input', async (e) => {
            let scrapedLengthCharacterLimit = this.scraped_length_character_limit.value;
            chrome.storage.local.set({ scrapedLengthCharacterLimit });
        });

        this.paintData();
    }
    async renderSettingsTab() {
        let sessionConfig = await chrome.storage.local.get('sessionId');
        if (sessionConfig && sessionConfig.sessionId) {
            (<any>document.querySelector('.no_session_key')).style.display = 'none';
            this.session_anchor_label.innerText = 'Use link to visit Unacog Session: ';
            this.session_anchor.innerText = `Visit Session ${sessionConfig.sessionId}`;
            this.session_anchor.href = `https://unacog.com/session/${sessionConfig.sessionId}`;
        } else {
            (<any>document.querySelector('.no_session_key')).style.display = 'block';
            this.session_anchor_label.innerText = 'Visit Unacog:';
            this.session_anchor.innerText = `Get Started`;
            this.session_anchor.href = `https://unacog.com/klyde`;
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

        let historyRangeLimit = await this.extCommon.getStorageField('historyRangeLimit') || 20;
        this.history_range_amount_select.value = historyRangeLimit;

        let hideAnalyzeInPageContextMenu = await this.extCommon.getStorageField('hideAnalyzeInPageContextMenu');
        this.show_analyze_text_in_context_menu.checked = !hideAnalyzeInPageContextMenu;

        let showQueryInPageContextMenu = await this.extCommon.getStorageField('showQueryInPageContextMenu');
        this.show_query_text_in_context_menu.checked = showQueryInPageContextMenu;
        
        this.extCommon.getFieldFromStorage(this.scraped_length_character_limit, 'scrapedLengthCharacterLimit');
        this.show_analyze_selection_in_context_menu.checked = !(await this.extCommon.getStorageField('hideAnalyzeInSelectionContextMenu'));
        this.show_query_selection_in_context_menu.checked = await this.extCommon.getStorageField('showQueryInSelectionContextMenu');
        this.extCommon.updateBrowserContextMenus();
    }
}