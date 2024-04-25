import Split from "split.js";
import { AnalyzerExtensionCommon } from './extensioncommon';
declare const chrome: any;
export default class HistoryHelper {
    extCommon = new AnalyzerExtensionCommon(chrome);
    main_history_upper_panel = document.querySelector('.main_history_upper_panel') as HTMLDivElement;
    main_history_lower_panel = document.querySelector('.main_history_lower_panel') as HTMLDivElement;
    manage_history_configuration = document.querySelector('.manage_history_configuration') as HTMLButtonElement;
    export_history = document.querySelector('.export_history') as HTMLButtonElement;
    history_text = document.querySelector('.history_text') as HTMLDivElement;
    url_display = document.querySelector('.url_display') as HTMLAnchorElement;    
    entry_total_credit_usage = document.querySelector('.entry_total_credit_usage') as HTMLDivElement;
    history_pagination = document.querySelector('.history_pagination') as HTMLDivElement;
    history_copy_url_btn = document.querySelector('.history_copy_url_btn') as HTMLButtonElement;
    historyEntryListItems: any = null;
    historyDisplay = document.querySelector('.history_display') as HTMLDivElement;
    history_date = document.querySelector('.history_date') as HTMLDivElement;
    copy_entry_result_as_csv_text_btn = document.querySelector('.copy_entry_result_as_csv_text_btn') as HTMLButtonElement;
    itemsPerView = 5;
    baseHistoryIndex = 0;
    currentPageIndex = 0;
    activeTab: any = null;
    chromeTabListener: any = null;

    viewSplitter: Split.Instance;
    constructor() {
        this.viewSplitter = Split([this.main_history_upper_panel, this.main_history_lower_panel], {
            sizes: [30, 70],
            direction: 'vertical',
            minSize: 100, // min size of both panes
            gutterSize: 24,
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
        this.history_copy_url_btn.addEventListener('click', async () => {
            const url = this.url_display.href;
            navigator.clipboard.writeText(url);
        });
        this.manage_history_configuration.addEventListener('click', async () => {
            document.getElementById('history-tab')?.click();
        });
    }
    async renderHistoryDisplay() {
        let historyRangeLimit = await chrome.storage.local.get('historyRangeLimit');
        historyRangeLimit = historyRangeLimit.historyRangeLimit || 20;

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
            this.entry_total_credit_usage.innerHTML = `Credits: ${Math.round(usageCreditTotal)}`;
            this.history_date.innerHTML = this.extCommon.showGmailStyleDate(entry.runDate);
        }

        this.historyDisplay.innerHTML = entryHTML;

        let paginationHtml = this.extCommon
            .generatePagination(history.length, this.baseHistoryIndex, this.itemsPerView, this.currentPageIndex);
        this.history_pagination.innerHTML = paginationHtml;

        this.historyEntryListItems = document.querySelectorAll('.history_pagination li a') as NodeListOf<HTMLLIElement>;
        this.historyEntryListItems.forEach((item: any) => {
            item.addEventListener('click', async (e: any) => {
                e.preventDefault();
                const index = Number(item.dataset.entryindex);
                const eventResult = this.extCommon.handlePaginationClick(index,
                    history.length, this.baseHistoryIndex, this.itemsPerView, this.currentPageIndex);
                this.baseHistoryIndex = eventResult.selectedIndex;
                this.currentPageIndex = eventResult.pageIndex;
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
        let resultsHTML = `<div class="history_results flex flex-wrap">`;
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
            resultsHTML += `
            <div class="history_entry_set_wrapper my-2 mr-2">
                <div class="history_entry_setname_wrapper"><h6 class="history_entry_prompt_setname py-2 font-bold fs-5">${setName}</h6></div>
                <hr class="history_separator" />
            `;
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
            resultsHTML += `</div>`;
        });
        resultsHTML += `</div>`;
        let html = `${resultsHTML}${headerHtml}`;
        return {
            html,
            usageCreditTotal,
        };
    }
}