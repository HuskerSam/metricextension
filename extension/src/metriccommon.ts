import { AnalyzerExtensionCommon } from './extensioncommon';
import Mustache from 'mustache';

export class MetricCommon {
    cloudScrapeUrl = `https://us-central1-promptplusai.cloudfunctions.net/lobbyApi/session/external/scrapeurl`;
    chrome: any;
    extCommon: AnalyzerExtensionCommon;
    activeTabsBeingScraped: any = [];

    constructor(chrome: any) {
        this.chrome = chrome;
        this.extCommon = new AnalyzerExtensionCommon(chrome);
        // for detecting in browser scraping completion
        chrome.tabs.onUpdated.addListener(
            (tabId: number, changeInfo: any, tab: any) => {
                if (this.activeTabsBeingScraped[tabId] && changeInfo.status === "complete") {
                    this.activeTabsBeingScraped[tabId]();
                }
            }
        );
    }
    async getTextContentSource() {
        let value = await this.chrome.storage.local.get("sidePanelTextSource");
        value = value["sidePanelTextSource"] || '';
        return value;
    }
    async getURLContentSource() {
        let value = await this.chrome.storage.local.get("sidePanelUrlSource");
        value = value["sidePanelUrlSource"] || '';
        return value;
    }
    async getSourceType() {
        let value = await this.chrome.storage.local.get("sidePanelSource");
        value = value["sidePanelSource"] || '';
        if (value === 'scrape') {
            return 'scrape';
        } else {
            return 'text';
        }
    }
    async getSourceText(clearCache = false) {
        let sourceType = await this.getSourceType();
        let sidePanelScrapeType = await this.extCommon.getStorageField("sidePanelScrapeType");

        if (sourceType === 'scrape') {
            if (clearCache && sidePanelScrapeType !== 'cache') {
                const url = await this.getURLContentSource();
                const options = await this.extCommon.getStorageField("sidePanelUrlSourceOptions");
                let bulkUrl = {
                    url,
                    scrape: sidePanelScrapeType,
                    options,
                }
                if (sidePanelScrapeType === "browser scrape") {
                    this.extCommon.enabledBrowserScrapePermissions();
                }
                const activeTab = await this.chrome.tabs.getCurrent();
                const result: any = await this.scrapeBulkUrl(bulkUrl, activeTab?.id);
                let text = "";
                if (result && result.text) text = result.text;
                if (result && result.length > 0 && result[0].result) text = result[0].result;
                let content = text;
                if (result.success) {
                    content = result.result.text;
                    content = content.slice(0, await this.extCommon.getEmbeddingCharacterLimit());
                } else {
                    content
                }

                await this.chrome.storage.local.set({ sidePanelScrapeContent: content });
                return content;
            }

            return await this.extCommon.getStorageField("sidePanelScrapeContent");
        } else {
            return await this.getTextContentSource();
        }
    }
    async detectTabLoaded(tabId: number) {
        return new Promise((resolve, reject) => {
            this.activeTabsBeingScraped[tabId] = resolve;
        });
    }
    async scrapeTabPage(url: any, tabId: string) {
        return new Promise(async (resolve, reject) => {

            let tab = await this.chrome.tabs.create({
                url
            });

            this.chrome.tabs.update(tabId, { active: true })

            await this.detectTabLoaded(tab.id);
            setTimeout(async () => {
                try {
                    let scrapes = await this.chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => {
                            return document.body.innerText;
                        },
                    });
                    const updatedTab = await this.chrome.tabs.get(tab.id);
                    scrapes.title = updatedTab.title;
                    await this.chrome.tabs.remove(tab.id);
                    resolve(scrapes);
                } catch (e) {
                    console.log("tab scrape error", e);
                    resolve("");
                }
            }, 3000);
        });
    }
    async scrapeBulkUrl(bulkUrl: any, defaultTabId: string) {
        let scrape = bulkUrl.scrape;
        let url = bulkUrl.url || "";
        let options = bulkUrl.options || "";
        if (scrape === "server scrape") {
            const result = await this.scrapeUrlServerSide(url, options);
            if (result.success) {
                return {
                    text: result.result.text,
                    title: result.result.title,
                };
            }
            return {
                text: "No text found in page",
                title: "",
            };
        } else if (scrape === "browser scrape") {
            let results = this.scrapeTabPage(url, defaultTabId);
            console.log("active scrape results", results);
            return results;
        } else if (scrape === "override content") {
            return {
                text: bulkUrl.content,
                url,
                title: "",
            };
        } else {
            return {
                text: "No text found in page",
                title: "",
                url
            };
        }
    }
    async scrapeUrlServerSide(url: string, options: string) {
        const result = await this.scrapeURLUsingAPI(url, options);
        result.url = url;
        return result;
    }
    async serverScrapeUrl(url: string, htmlElementsSelector: string) {
        let options = `urlScrape=true`;
        if (htmlElementsSelector) {
            options += `||htmlElementsSelector=${htmlElementsSelector}`;
        }
        let result = await this.scrapeUrlServerSide(url, options);

        if (result.success) {
            return {
                text: result.result.text,
                title: result.result.title,
            };
        }
        return {
            text: "No text found in page",
            title: "",
        };

    }
    async scrapeURLUsingAPI(url: string, options: string): Promise<any> {
        let apiToken = await this.chrome.storage.local.get('apiToken');
        apiToken = apiToken.apiToken || '';
        let sessionId = await this.chrome.storage.local.get('sessionId');
        sessionId = sessionId.sessionId || '';

        const body = {
            apiToken,
            sessionId,
            url,
            options,
        };
        try {
            const fetchResults = await fetch(this.cloudScrapeUrl, {
                method: "POST",
                mode: "cors",
                cache: "no-cache",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });
            return await fetchResults.json();
        } catch (err: any) {
            return {
                success: false,
                error: err,
            };
        }
    }
    async runAnalysisPrompts(text: string, url = "", promptToUse = null, selectedSetName = "selectedAnalysisSets", addToHistory = true, title = "") {
        if (text.length > 30000) text = text.slice(0, await this.extCommon.getEmbeddingCharacterLimit());
        const runDate = new Date().toISOString();

        let prompts: any = [];
        let analysisPrompts: any = await this.extCommon.getAnalysisPrompts();
        let selectedAnalysisSets: any = await this.chrome.storage.local.get(selectedSetName);
        if (promptToUse) {
            prompts = [promptToUse];
        } else if (selectedAnalysisSets && selectedAnalysisSets[selectedSetName]) {
            selectedAnalysisSets = selectedAnalysisSets[selectedSetName];
            for (let set of selectedAnalysisSets) {
                let localPrompts = analysisPrompts.filter((prompt: any) => prompt.setName === set);
                localPrompts.forEach((prompt: any) => {
                    prompts.push(prompt);
                });
            }
        }

        const runPrompt = async (prompt: any, text: string) => {
            let fullPrompt = await this.sendPromptForMetric(prompt.prompt, text);
            let result = await this.extCommon.processPromptUsingUnacogAPI(fullPrompt);
            return {
                prompt,
                result,
            };
        };

        let promises: any[] = [];
        for (let prompt of prompts) {
            promises.push(runPrompt(prompt, text));
        }

        let results = await Promise.all(promises);
        let historyEntry = {
            text,
            results,
            runDate,
            url,
            title,
        };
        if (addToHistory) {
            let history = await this.chrome.storage.local.get('history');
            let historyRangeLimit = await this.chrome.storage.local.get('historyRangeLimit');
            historyRangeLimit = Number(historyRangeLimit.historyRangeLimit) || 10;
            history = history.history || [];
            history.unshift(historyEntry);
            history = history.slice(0, historyRangeLimit);
            await this.chrome.storage.local.set({
                history,
                metrics_running: false,
            });
        }

        return historyEntry;
    }
    async sendPromptForMetric(promptTemplate: string, query: string) {
        try {
            const charLimit = await this.extCommon.getEmbeddingCharacterLimit();
            const q = query.slice(0, charLimit);
            let result = Mustache.render(promptTemplate, { query: q });
            return result;
        } catch (error) {
            console.log(promptTemplate, query, error);
            return `{
            "contentRating": -1
          }`;
        }
    }
    async setMetricsRunning(prompt = false) {
        let running = await this.chrome.storage.local.get('metrics_running');
        if (running && running.running) {
            return true;
        }

        await this.chrome.storage.local.set({
            metrics_running: true,
        });
        return false;
    }
}
