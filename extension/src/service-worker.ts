import { AnalyzerExtensionCommon } from "./extensioncommon";
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
    chrome.sidePanel.open({ tabId: tab.id });
    function getPageDom() {
        return document.body.innerText;
    }
    let extCommon = new AnalyzerExtensionCommon(chrome);
    if (info.menuItemId === 'hideAnalyzeInSelectionContextMenu') {
        await extCommon.processAnalysisContextMenuAction(info.selectionText, tab.url);
    }
    else if (info.menuItemId === 'hideAnalyzeInPageContextMenu') {
        let scrapes = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: getPageDom,
        });
        await extCommon.processAnalysisContextMenuAction(scrapes[0].result, tab.url);
    } else if (info.menuItemId === 'showQueryInSelectionContextMenu') {
        await extCommon.processSemanticContextMenuAction(info.selectionText, tab.url);
    } else if (info.menuItemId === 'showQueryInPageContextMenu') {
        let scrapes = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: getPageDom,
        });
        await extCommon.processSemanticContextMenuAction(scrapes[0].result, tab.url);
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

