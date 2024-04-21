import { AnalyzerExtensionCommon } from './extensioncommon';
import BulkHelper from './bulkhelper';
import PromptHelper from './prompthelper';
declare const chrome: any;

export default class MainPageApp {
    extCommon = new AnalyzerExtensionCommon(chrome);
    bulkHelper = new BulkHelper();
    promptHelper = new PromptHelper();
    api_token_input = document.querySelector('.api_token_input') as HTMLInputElement;
    session_id_input = document.querySelector('.session_id_input') as HTMLInputElement;
    clearStorageButton = document.querySelector('.reset_chrome_storage') as HTMLButtonElement;
    session_anchor_label = document.querySelector('.session_anchor_label') as HTMLDivElement;
    session_anchor = document.querySelector('.session_anchor') as HTMLAnchorElement;
    export_history = document.querySelector('.export_history') as HTMLButtonElement;
    clear_history = document.querySelector('.clear_history') as HTMLButtonElement;
    history_range_amount_select = document.querySelector('.history_range_amount_select') as HTMLSelectElement;
    entry_total_credit_usage = document.querySelector('.entry_total_credit_usage') as HTMLDivElement;
    history_pagination = document.querySelector('.history_pagination') as HTMLDivElement;
    historyEntryListItems: any = null;
    historyDisplay = document.querySelector('.history_display') as HTMLDivElement;
    history_date = document.querySelector('.history_date') as HTMLDivElement;
    manage_history_configuration = document.querySelector('.manage_history_configuration') as HTMLButtonElement;
    open_side_panel_from_main = document.querySelector('.open_side_panel_from_main') as HTMLButtonElement;
    history_text = document.querySelector('.history_text') as HTMLDivElement;
    url_display = document.querySelector('.url_display') as HTMLAnchorElement;
    activeTab: any = null;
    chromeTabListener: any = null;
    itemsPerView = 5;
    baseHistoryIndex = 0;
    currentPageIndex = 0;

    constructor() {
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

        this.manage_history_configuration.addEventListener('click', async () => {
            document.getElementById('history-tab')?.click();
        });
    }
    getActiveTab() {
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
    async renderHistoryDisplay() {
        let historyRangeLimit = await chrome.storage.local.get('historyRangeLimit');
        historyRangeLimit = historyRangeLimit.historyRangeLimit || 20;
        this.history_range_amount_select.value = historyRangeLimit;

        let history = await chrome.storage.local.get('history');
        history = history.history || [];

        let usageCreditTotal = 0;
        let entry = history[this.baseHistoryIndex];
        let entryHTML = `
        <div class="history_empty">
            <p class="history_empty_onboarding_message">
                No history found. <br><br>
                Select metric and provide text input to begin.
            </p>
        </div>
        `;
        if (entry) {
            let renderResult = this.renderHTMLForHistoryEntry(entry, this.baseHistoryIndex);
            entryHTML = renderResult.html;
            usageCreditTotal += renderResult.usageCreditTotal;
            this.entry_total_credit_usage.innerHTML = `<img src="media/logo16.png" alt="logo" style="position:relative;bottom:2px;">
                     Credits Used: ${Math.round(usageCreditTotal)}`;
            this.history_date.innerHTML = this.extCommon.showGmailStyleDate(entry.runDate);
        }

        this.historyDisplay.innerHTML = entryHTML;

        this.historyDisplay.querySelectorAll('.export_history_entry').forEach((button: any) => {
            button.addEventListener('click', async (e: any) => {
                let index = e.target.dataset.index;
                let entry = history[index];
                let blob = new Blob([JSON.stringify(entry)], { type: "application/json" });
                let url = URL.createObjectURL(blob);
                let a = document.createElement('a');
                document.body.appendChild(a);
                a.href = url;
                a.download = `history_entry_${index}.json`;
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            });
        });

        let paginationHtml = this.extCommon
            .generatePagination(history.length, this.baseHistoryIndex, this.itemsPerView, this.currentPageIndex);
        this.history_pagination.innerHTML = paginationHtml;

        this.historyEntryListItems = document.querySelectorAll('.history_pagination li a') as NodeListOf<HTMLLIElement>;
        this.historyEntryListItems.forEach((item: any) => {
            item.addEventListener('click', async (e: any) => {
                e.preventDefault();
                const index = Number(item.dataset.entryindex);
                if (index === -1) {
                    this.currentPageIndex = Math.max(this.currentPageIndex - 1, 0);
                    if (this.baseHistoryIndex < this.currentPageIndex * this.itemsPerView) {
                        this.baseHistoryIndex = this.currentPageIndex * this.itemsPerView;
                    } else if (this.baseHistoryIndex > (this.currentPageIndex + 1) * this.itemsPerView - 1) {
                        this.baseHistoryIndex = this.currentPageIndex * this.itemsPerView;
                    }
                } else if (index === -2) {
                    this.currentPageIndex = Math.min(this.currentPageIndex + 1, Math.ceil(history.length / this.itemsPerView) - 1);
                    if (this.baseHistoryIndex < this.currentPageIndex * this.itemsPerView) {
                        this.baseHistoryIndex = this.currentPageIndex * this.itemsPerView;
                    } else if (this.baseHistoryIndex > (this.currentPageIndex + 1) * this.itemsPerView - 1) {
                        this.baseHistoryIndex = this.currentPageIndex * this.itemsPerView;
                    }
                } else if (index === -10) {
                    this.baseHistoryIndex -= 1;
                    this.currentPageIndex = Math.floor(this.baseHistoryIndex / this.itemsPerView);
                } else if (index === -20) {
                    this.baseHistoryIndex += 1;
                    if (this.baseHistoryIndex > history.length - 1) this.baseHistoryIndex = history.length - 1;
                    if (this.baseHistoryIndex < 0) this.baseHistoryIndex = 0;
                    this.currentPageIndex = Math.floor(this.baseHistoryIndex / this.itemsPerView);
                } else {
                    this.baseHistoryIndex = index;
                    this.currentPageIndex = Math.floor(this.baseHistoryIndex / this.itemsPerView);
                }
                this.renderHistoryDisplay();
            });
        });
    }
    renderHTMLForHistoryEntry(entry: any, historyIndex: number): {
        html: string;
        usageCreditTotal: number;
    } {
        let usageCreditTotal = 0;
        let resultHistory = entry.result;
        if (!resultHistory) resultHistory = entry.results[0];
        const historyText = entry.text;
        this.history_text.innerHTML = historyText;
        const url = entry.url;
        this.url_display.innerHTML = url;
        this.url_display.href = url;
        let headerHtml = ``;
        let resultsHTML = `<div class="history_results">`;
        let allResults = entry.results;
        let setBasedResults: any = {};
        allResults.forEach((result: any) => {
            if (!setBasedResults[result.prompt.setName]) {
                setBasedResults[result.prompt.setName] = [];
            }
            setBasedResults[result.prompt.setName].push(result);
        });
        const setNamesArray = Object.keys(setBasedResults);
        setNamesArray.forEach((setName: any) => {
            resultsHTML += `<h6 class="">${setName}</h6>`;
            let promptSetResults = setBasedResults[setName];
            promptSetResults.forEach((result: any) => {
                try {
                    usageCreditTotal += result.result.promptResult.ticketResults.usage_credits;
                } catch (err: any) {
                    console.log("Usage total credit summming error", err);
                }
            });

            for (let result of promptSetResults) {
                resultsHTML += this.extCommon.getHTMLforPromptResult(result);
            }
        });
        resultsHTML += `</div>`;
        let html = `${resultsHTML}${headerHtml}`;
        return {
            html,
            usageCreditTotal,
        };
    }
    async paintData(forceUpdate = false) {
        this.renderSettingsTab();
        this.renderHistoryDisplay();
        this.bulkHelper.paintAnalysisHistory();

        await this.bulkHelper.paintBulkURLList(forceUpdate);
    }
}
