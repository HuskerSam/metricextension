
import { AnalyzerExtensionCommon } from "./extensioncommon";
declare const chrome: any;

chrome.storage.local.onChanged.addListener(async () => {
    let activeTabReadToScrape = await chrome.storage.local.get("activeTabReadToScrape");
    if (activeTabReadToScrape.activeTabReadToScrape) {
        let tabId = await chrome.storage.local.get("activeTabId");


        tabId = tabId.activeTabId;

            setTimeout(async () => {
                function getDom() {
                    return document.body.innerText;
                }
                let scrapes = await chrome.scripting.executeScript({
                    target: { tabId },
                    func: getDom,
                });
        
                console.log("scrapes", scrapes);
          
                await chrome.tabs.remove(tabId);
                await chrome.storage.local.set({ activeTabReadToScrape: false });
                await chrome.storage.local.set({ activeTabScrapeResult: scrapes });
            }, 5000);
    }
});

chrome.runtime.onInstalled.addListener(async (reason: any) => {
   if (reason.reason === 'install') {
        chrome.tabs.create({
          url: "https://unacog.com/clyde/"
        });
      }


    chrome.contextMenus.create({
        id: 'analyzeSelection',
        title: 'Analyze selection',
        type: 'normal',
        contexts: ['selection']
    });
    chrome.contextMenus.create({
        id: 'analyzePage',
        title: 'Analyze page',
        type: 'normal',
        contexts: ['page']
    });
});

chrome.contextMenus.onClicked.addListener(async (info: any, tab: any) => {
    chrome.sidePanel.open({ tabId: tab.id });

    let text = '';
    let result: any = {};
    if (info.menuItemId === 'analyzeSelection') {
        text = info.selectionText;
        console.log("info", info);
        text = text.slice(0, 20000);
        let abc = new AnalyzerExtensionCommon(chrome);
        result = await abc.runAnalysisPrompts(text, tab.url);
    }
    else if (info.menuItemId === 'analyzePage') {
        function getDom() {
            return document.body.innerText;
        }
        let scrapes = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: getDom,
        });
        text = scrapes[0].result;
        text = text.slice(0, 20000);
        let abc = new AnalyzerExtensionCommon(chrome);
        result = await abc.runAnalysisPrompts(text, tab.url);
    }

    let abc = new AnalyzerExtensionCommon(chrome);
    console.log("super result", result);
    let def = '';
    result.results.forEach((result: any) => {
        def += abc.getHTMLforPromptResult(result);
    });

});

chrome.action.onClicked.addListener(async (tab: any) => {
    chrome.sidePanel.open({ tabId: tab.id });
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
    }
);

