import { AnalyzerExtensionCommon } from "./extensioncommon";
import { SemanticCommon } from "./semanticcommon";
import { MetricCommon } from "./metriccommon";
declare const chrome: any;
chrome.runtime.onInstalled.addListener(async (reason: any) => {
    if (reason.reason === 'install') {
        await chrome.tabs.create({
            url: "https://unacog.com/klyde/"
        });
    }
    const extCommon = new AnalyzerExtensionCommon(chrome);
    extCommon.updateBrowserContextMenus();
});

chrome.contextMenus.onClicked.addListener(async (info: any, tab: any) => {
    function getPageDom() {
        return document.body.innerText;
    }
    if (info.menuItemId === 'hideAnalyzeInSelectionContextMenu') {
        chrome.sidePanel.open({ tabId: tab.id });
        await processAnalysisContextMenuAction(info.selectionText, tab.url);
    }
    else if (info.menuItemId === 'hideAnalyzeInPageContextMenu') {
        chrome.sidePanel.open({ tabId: tab.id });
        let scrapes = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: getPageDom,
        });
        processAnalysisContextMenuAction(scrapes[0].result, tab.url);
    } else if (info.menuItemId === 'showQueryInSelectionContextMenu') {
        new AnalyzerExtensionCommon(chrome).toggleExentionPage("main.html#semantic");
        processSemanticContextMenuAction(info.selectionText, tab.url);
    } else if (info.menuItemId === 'showQueryInPageContextMenu') {
        new AnalyzerExtensionCommon(chrome).toggleExentionPage("main.html#semantic");
        let scrapes = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: getPageDom,
        });
        await processSemanticContextMenuAction(scrapes[0].result, tab.url);
    }
});

chrome.action.onClicked.addListener((tab: any) => {
    new AnalyzerExtensionCommon(chrome).toggleSidePanel(tab);
});

chrome.runtime.onMessageExternal.addListener(
    async (request: any, sender: any, sendResponse: any) => {
        console.log(sender.tab ?
            "from a content script:" + sender.tab.url :
            "from the extension");
        if (request.sessionId) {
            await chrome.storage.local.set({
                sessionId: request.sessionId,
                apiToken: request.apiToken
            });
            sendResponse({ success: "key set" });
        }
        if (request.specialAction === 'openSidePanel') {
            chrome.sidePanel.open({ tabId: sender.tab.id });
        }
        if (request.specialAction === 'openMainPage') {
            new AnalyzerExtensionCommon(chrome).toggleExentionPage("main.html");
        }
    }
);
async function processAnalysisContextMenuAction(text: string, url: string) {
    let extCommon = new AnalyzerExtensionCommon(chrome);
    let metricCommon = new MetricCommon(chrome);
    text = text.slice(0, 1000000);
    await chrome.storage.local.set({
      sidePanelScrapeContent: text,
      sidePanelSource: 'scrape',
      sidePanelUrlSource: url,
      sidePanelScrapeType: "cache"
    });
    let isAlreadyRunning = await extCommon.setRunning(true);
    if (isAlreadyRunning) return;
    return await metricCommon.runAnalysisPrompts(text, url);
  }

  async function processSemanticContextMenuAction(text: string, url: string) {
    const semanticCommon = new SemanticCommon(chrome);
    let isAlreadyRunning = await semanticCommon.setSemanticRunning(true);
    if (isAlreadyRunning) return;

    text = text.slice(0, 1000000);
    await chrome.storage.local.set({
      semanticQueryText: text,
      semanticUrlSource: url,
      semanticScrapeType: "cache"
    });
    let selectedSemanticSource = await semanticCommon.getSelectedSemanticSource();
    await semanticCommon.selectSemanticSource(selectedSemanticSource, true);
    await semanticCommon.lookupDocumentChunks();
  }
