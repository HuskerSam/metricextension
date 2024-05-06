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

    let text = '';
    let result: any = {};
    let extCommon = new AnalyzerExtensionCommon(chrome);
    if (info.menuItemId === 'hideAnalyzeInSelectionContextMenu') {
        text = info.selectionText;

        result = await extCommon.processAnalysisContextMenuAction(text, tab.url);
    }
    else if (info.menuItemId === 'hideAnalyzeInPageContextMenu') {
        function getDom() {
            return document.body.innerText;
        }
        let scrapes = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: getDom,
        });
        text = scrapes[0].result;

        result = await extCommon.processAnalysisContextMenuAction(text, tab.url);
    } else if (info.menuItemId === 'showQueryInSelectionContextMenu') {
        console.log('showQueryInSelectionContextMenu');
    } else if (info.menuItemId === 'showQueryInPageContextMenu') {
        console.log('showQueryInPageContextMenu');
    }

    let def = '';
    result.results.forEach((result: any) => {
        def += extCommon.getHTMLforPromptResult(result);
    });

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

