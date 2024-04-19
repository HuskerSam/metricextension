import Papa from 'papaparse';
import { AnalyzerExtensionCommon } from './extensioncommon';
declare const chrome: any;

export default class BulkHelper {
    extCommon = new AnalyzerExtensionCommon(chrome);
    activeTabsBeingScraped: any = [];
    constructor() {
        // for detecting in browser scraping completion
        chrome.tabs.onUpdated.addListener(
            (tabId: number, changeInfo: any, tab: any) => {
                if (this.activeTabsBeingScraped[tabId] && changeInfo.status === "complete") {
                    this.activeTabsBeingScraped[tabId]();
                }
            }
        );
    }
    async detectTabLoaded(tabId: number) {
        return new Promise((resolve, reject) => {
            this.activeTabsBeingScraped[tabId] = resolve;
        });
    }
    async scrapeTabPage(url: any, tabId: string) {
        return new Promise(async (resolve, reject) => {

            let tab = await chrome.tabs.create({
                url
            });

            chrome.tabs.update(tabId, { active: true })

            await this.detectTabLoaded(tab.id);
            setTimeout(async () => {
                try {
                    let scrapes = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => {
                            return document.body.innerText;
                        },
                    });
                    const updatedTab = await chrome.tabs.get(tab.id);
                    scrapes.title = updatedTab.title;
                    await chrome.tabs.remove(tab.id);
                    resolve(scrapes);
                } catch (e) {
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
            return this.scrapeTabPage(url, defaultTabId);
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
        const result = await this.extCommon.scrapeURLUsingAPI(url, options);
        result.url = url;
        return result;
    }
    async runBulkAnalysis(rows: any[]) {
        let browserScrape = false;
        rows.forEach((row: any) => {
            if (row.scrape === "browser scrape") {
                browserScrape = true;
            }
        });
        if (browserScrape) {
            if (confirm("Browser scraping is enabled. This will open tabs in your browser to scrape the pages. Do you want to continue?") === false) {
                return;
            }
            await this.enabledBrowserScrapePermissions();
        }

        document.body.classList.add("extension_running");
        document.body.classList.remove("extension_not_running");
        const runId = new Date().toISOString();
        let urls: string[] = [];
        let promises: any[] = [];
        const activeTab = await chrome.tabs.getCurrent();
        rows.forEach((row: any) => {
            urls.push(row.url);
            promises.push(this.scrapeBulkUrl(row, activeTab.id));
        });

        let results = await Promise.all(promises);
        let analysisPromises: any[] = [];
        results.forEach((result: any, index: number) => {
            let text = "";
            if (result && result.text) text = result.text;
            if (result && result.length > 0 && result[0].text) text = result[0].text;
            if (!text) {
                analysisPromises.push(async () => {
                    return {
                        text: "No text found in page",
                        url: urls[index],
                        results: [],
                        runDate: new Date().toISOString(),
                        title: "",
                    };
                });
            } else {
                analysisPromises.push(this.extCommon.runAnalysisPrompts(text, urls[index], null, "selectedBulkAnalysisSets", false, result.title));
            }

        });
        let analysisResults = await Promise.all(analysisPromises);
        const fullCloudUploadResult = await this.extCommon.writeCloudDataUsingUnacogAPI(runId + ".json", analysisResults);

        let compactData: any[] = [];
        analysisResults.forEach((urlResult: any) => {
            let compactResult: any = {};
            compactResult.url = urlResult.url;
            compactResult.title = urlResult.title;

            const results = urlResult.results;
            if (results) {
                results.forEach((metricResult: any) => {
                    const fieldName = metricResult.prompt.id + "_" + metricResult.prompt.setName;
                    if (metricResult.prompt.promptType === "metric") {
                        let metric = 0;
                        try {
                            let json = JSON.parse(metricResult.result.resultMessage);
                            metric = json.contentRating;
                        } catch (e) {
                            metric = -1;
                        }
                        compactResult[fieldName] = metric;
                    } else {
                        compactResult[fieldName] = metricResult.result.resultMessage;
                    }
                });
            } else {
                compactResult["No Results"] = "No Results";
            }

            compactData.push(compactResult);
        });

        if (compactData.length > 0) {
            const firstRow = compactData[0];
            const allFields: any = {};
            compactData.forEach((row: any) => {
                Object.keys(row).forEach((field) => {
                    allFields[field] = true;
                });
            });
            const fieldNames = Object.keys(allFields);
            fieldNames.forEach((fieldName) => {
                if (!firstRow[fieldName]) {
                    firstRow[fieldName] = "";
                }
            });
        }

        const csv = Papa.unparse(compactData);
        const compactResult = await this.extCommon.writeCloudDataUsingUnacogAPI(runId, csv, "text/csv", "csv");
        document.body.classList.remove("extension_running");
        document.body.classList.add("extension_not_running");

        let bulkHistory = await chrome.storage.local.get('bulkHistory');
        let bulkHistoryRangeLimit = await chrome.storage.local.get('bulkHistoryRangeLimit');
        bulkHistoryRangeLimit = Number(bulkHistoryRangeLimit.bulkHistoryRangeLimit) || 100;
        bulkHistory = bulkHistory.bulkHistory || [];
        bulkHistory.unshift({
            runId,
            urls,
            compactResultPath: compactResult.publicStorageUrlPath,
            analysisResultPath: fullCloudUploadResult.publicStorageUrlPath,
        });
        bulkHistory = bulkHistory.slice(0, bulkHistoryRangeLimit);
        await chrome.storage.local.set({ bulkHistory });
    }
    async enabledBrowserScrapePermissions() {
        // Permissions must be requested from inside a user gesture, like a button's
        // click handler.
        await chrome.permissions.request({
            permissions: ["activeTab", "tabs"],
            origins: ["https://*/*",
                "http://*/*"]
        }, (granted: any) => {
            if (!granted) {
                alert("Browser scraping permission denied. You can enable it from the extension settings page");
            }
        });
    }
}