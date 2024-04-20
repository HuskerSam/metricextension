import { AnalyzerExtensionCommon } from './extensioncommon';
declare const chrome: any;

export default class SidePanelApp {
    extCommon = new AnalyzerExtensionCommon(chrome);
    show_main_page_btn = document.querySelector('.show_main_page_btn') as HTMLButtonElement;
    lastPanelToggleDate = new Date().toISOString();

    constructor() {
        this.extCommon.initCommonDom();
        chrome.storage.local.onChanged.addListener(() => {
            this.handleStorageChange();
        });
        this.handleStorageChange();

        this.show_main_page_btn.addEventListener('click', () => {
            chrome.tabs.create({ url: 'main.html', active: true });
        });
    }
    async handleStorageChange() {
        let lastPanelToggleDate = await chrome.storage.local.get('lastPanelToggleDate');
        if (lastPanelToggleDate && lastPanelToggleDate.lastPanelToggleDate) lastPanelToggleDate = lastPanelToggleDate.lastPanelToggleDate;

        if (lastPanelToggleDate > this.lastPanelToggleDate) {
            window.close();
            return;
        }
        this.extCommon.paintAnalysisTab();
    }
}
