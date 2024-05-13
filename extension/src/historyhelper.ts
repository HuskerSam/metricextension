import Papa from 'papaparse';
import { AnalyzerExtensionCommon } from './extensioncommon';
import MainPageApp from "./mainpageapp";

declare const chrome: any;
export default class HistoryHelper {
    app: MainPageApp;
    extCommon: AnalyzerExtensionCommon;
    history_pagination = document.querySelector('.history_pagination') as HTMLDivElement;
    history_copy_url_btn = document.querySelector('.history_copy_url_btn') as HTMLButtonElement;
    historyEntryListItems: any = null;
    historyDisplay = document.querySelector('.history_display') as HTMLDivElement;
    itemsPerView = 5;
    baseHistoryIndex = 0;
    currentPageIndex = 0;
    activeTab: any = null;
    chromeTabListener: any = null;

    constructor(app: MainPageApp) {
        this.app = app;
        this.extCommon = app.extCommon;
    }
    async renderHistoryDisplay() {
        let historyRangeLimit = await chrome.storage.local.get('historyRangeLimit');
        historyRangeLimit = historyRangeLimit.historyRangeLimit || 20;

        let history = await chrome.storage.local.get('history');
        history = history.history || [];

        let entry = history[this.baseHistoryIndex];
        if (entry && entry.results && entry.results.length > 0) {
            entry.results.forEach((result: any, index: number) => {
                result.id = index;
            });
        }

       
        if (entry) {
            entry.historyIndex = this.baseHistoryIndex;
            this.app.historyResult?.props.hooks.setHistoryEntry(entry);
            this.app.historyResult?.props.hooks.setShow(true);
        } else {
            this.app.historyResult?.props.hooks.setHistoryEntry({
                results: [],
            }, this.baseHistoryIndex);
            this.app.historyResult?.props.hooks.setShow(false);
        }
        if (this.baseHistoryIndex < history.length - 1) {
            let entry = history[this.baseHistoryIndex + 1];
            entry.historyIndex = this.baseHistoryIndex + 1;
            if (entry && entry.results && entry.results.length > 0) {
                entry.results.forEach((result: any, index: number) => {
                    result.id = index;
                });
            }
            this.app.historyResultPrevious?.props.hooks.setHistoryEntry(entry);
            this.app.historyResultPrevious?.props.hooks.setShow(true);
        } else {
            this.app.historyResultPrevious?.props.hooks.setHistoryEntry({
                results: [],
            }, this.baseHistoryIndex + 1);
            this.app.historyResultPrevious?.props.hooks.setShow(false);
        }

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