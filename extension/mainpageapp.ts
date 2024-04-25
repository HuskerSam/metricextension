import { AnalyzerExtensionCommon } from './extensioncommon';
import BulkHelper from './bulkhelper';
import PromptHelper from './prompthelper';
import HistoryHelper from './historyhelper';
import SettingsHelper from './settingshelper';
declare const chrome: any;

export default class MainPageApp {
    extCommon = new AnalyzerExtensionCommon(chrome);
    bulkHelper: BulkHelper | null = null;
    promptHelper: PromptHelper | null = null;
    historyHelper: HistoryHelper | null = null;
    settingsHelper: SettingsHelper | null = null;
    open_side_panel_from_main = document.querySelector('.open_side_panel_from_main') as HTMLButtonElement;
    main_history_tab_view = document.querySelector('#main_history_tab_view') as HTMLDivElement;
    main_prompt_manager_tab_view = document.querySelector('#main_prompt_manager_tab_view') as HTMLDivElement;
    main_bulk_tab_view = document.querySelector('#main_bulk_tab_view') as HTMLDivElement;
    main_options_tab_view = document.querySelector('#main_options_tab_view') as HTMLDivElement;

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
        await this.loadHTMLTemplate("pages/settings.html", this.main_options_tab_view);
        this.settingsHelper = new SettingsHelper();
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
    }
    

    async paintData(forceUpdate = false) {
        this.historyHelper?.renderHistoryDisplay();
        this.bulkHelper?.paintAnalysisHistory();
        this.bulkHelper?.paintBulkURLList(forceUpdate);
        this.extCommon.updateSessionKeyStatus();
    }
}
