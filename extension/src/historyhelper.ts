import Split from "split.js";
import Papa from 'papaparse';
import { AnalyzerExtensionCommon } from './extensioncommon';


declare const chrome: any;
export default class HistoryHelper {
    extCommon = new AnalyzerExtensionCommon(chrome);
    main_history_upper_panel = document.querySelector('.main_history_upper_panel') as HTMLDivElement;
    main_history_lower_panel = document.querySelector('.main_history_lower_panel') as HTMLDivElement;
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
            gutterSize: 16,
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
    }
    async renderHistoryDisplay() {
        let historyRangeLimit = await chrome.storage.local.get('historyRangeLimit');
        historyRangeLimit = historyRangeLimit.historyRangeLimit || 20;

        let history = await chrome.storage.local.get('history');
        history = history.history || [];

        let usageCreditTotal = 0;
        let entry = history[this.baseHistoryIndex];
        let entryHTML = `
        <div class="block">
            <div class="rounded-md bg-blue-50 p-4 history_empty w-full h-auto">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <div class="ml-3 flex-1 md:flex md:justify-between">
                        <p class="text-sm text-blue-700">No history found.<br><br>
                           Use sidebar to select a metric, input text and run an analysis to begin.</p>
                    </div>
                </div>
            </div>
        </div>
        `;
        if (entry) {
            let renderResult = this.extCommon.renderHTMLForHistoryEntry(entry, this.baseHistoryIndex);
            const historyText = entry.text;
            this.history_text.innerHTML = historyText;    
            entryHTML = renderResult.html;
            usageCreditTotal += renderResult.usageCreditTotal;
            const url = entry.url;
            this.url_display.innerHTML = url;
            this.url_display.href = url;
            this.entry_total_credit_usage.innerHTML = `Credits: ${Math.round(usageCreditTotal)}`;
            this.history_date.innerHTML = this.extCommon.showGmailStyleDate(entry.runDate);
        } else {
            this.history_text.innerHTML = 'Analysis text for each entry will be displayed here...';
            this.entry_total_credit_usage.innerHTML = '';
            this.history_date.innerHTML = '';
            this.url_display.innerHTML = '';
            this.url_display.href = '';
        }
        if (this.baseHistoryIndex < history.length - 1) {
            let renderResult = this.extCommon.renderHTMLForHistoryEntry(history[this.baseHistoryIndex + 1], this.baseHistoryIndex + 1);
            entryHTML += renderResult.html;
        }

        this.historyDisplay.innerHTML = entryHTML;
        this.historyDisplay.querySelectorAll('.download_compact_results_btn').forEach((btn: any) => {
            btn.addEventListener('click', async (e: any) => {
                e.preventDefault();
                const historyIndex = Number(btn.dataset.historyindex);
                const entry = history[historyIndex];
                let compactData = this.extCommon.processRawResultstoCompact(entry.results);
                let csvData = Papa.unparse(compactData);
                let blob = new Blob([csvData], { type: "text/csv" });
                let url = URL.createObjectURL(blob);
                let a = document.createElement('a');
                document.body.appendChild(a);
                a.href = url;
                a.download = 'results.csv';
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            });
        });
        this.historyDisplay.querySelectorAll('.download_full_results_btn').forEach((btn: any) => {
            btn.addEventListener('click', async (e: any) => {
                e.preventDefault();
                const historyIndex = Number(btn.dataset.historyindex);
                const entry = history[historyIndex];
                let blob = new Blob([JSON.stringify(entry)], { type: "application/json" });
                let url = URL.createObjectURL(blob);
                let a = document.createElement('a');
                document.body.appendChild(a);
                a.href = url;
                a.download = 'results.json';
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
                const eventResult = this.extCommon.handlePaginationClick(index,
                    history.length, this.baseHistoryIndex, this.itemsPerView, this.currentPageIndex);
                this.baseHistoryIndex = eventResult.selectedIndex;
                this.currentPageIndex = eventResult.pageIndex;
                this.renderHistoryDisplay();
            });
        });
    }
}