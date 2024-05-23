export class AnalyzerExtensionCommon {
  promptUrl = `https://us-central1-promptplusai.cloudfunctions.net/lobbyApi/session/external/message`;
  cloudWriteUrl = `https://us-central1-promptplusai.cloudfunctions.net/lobbyApi/session/external/cloudwrite`;
  chrome: any;
  debouncedInputTimeouts: any = {};
  lastSeenContextMenuSettings: any = {};
  defaultScrapedLengthCharacterLimit = 20000;

  constructor(chrome: any) {
    this.chrome = chrome;
  }
  async getEmbeddingCharacterLimit() {
    let limit = await this.getStorageField('scrapedLengthCharacterLimit');
    limit = Number(limit);
    if (!limit) limit = this.defaultScrapedLengthCharacterLimit;
    return limit;
  }
  async testSessionKeys(showPrompt = true) {
    let apiToken = await this.getStorageField('apiToken');
    let sessionId = await this.getStorageField('sessionId');

    if (!apiToken || !sessionId) {
      if (showPrompt) {
        alert("Please set your session keys in the extension settings page");
      }
      return false;
    }
      
    
    return true;
  }
  generatePagination(totalItems: number, currentEntryIndex: number, itemsPerPage: number, currentPageIndex: number) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    let paginationHtml = '';
    paginationHtml = '<ul class="pagination pagination-sm mb-0">';
    paginationHtml += `
    <li class="page-item ${currentPageIndex === 0 || totalPages === 0 ? 'buttondisabled' : ''}">
        <a class="page-link" href="#" aria-label="Previous" data-entryindex="-1">
            <span aria-hidden="true">&laquo;</span>
        </a>
    </li>
    <li class="page-item ${currentEntryIndex === 0 ? 'buttondisabled' : ''}">
      <a class="page-link" href="#" data-entryindex="-10">
          <span aria-hidden="true">
           &#x2190; 
          </span>
      </a>
    </li>`;
    const startIndex = currentPageIndex * itemsPerPage;
    const endIndex = Math.min((currentPageIndex + 1) * itemsPerPage, totalItems);
    for (let i = startIndex; i < endIndex; i++) {
      paginationHtml += `<li class="page-item ${currentEntryIndex === i ? 'selected' : ''}">
        <a class="page-link" href="#" data-entryindex="${i}">
            <span aria-hidden="true">${i + 1}</span>
        </a>
    </li>`;
    }
    paginationHtml += `
    <li class="page-item ${currentEntryIndex === totalItems - 1 ? 'buttondisabled' : ''}">
      <a class="page-link" href="#" data-entryindex="-20">
        <span aria-hidden="true">&#x2192;</span>
      </a>
    </li>
    <li class="page-item ${currentPageIndex === totalPages - 1 || totalPages === 0 ? 'buttondisabled' : ''}">
        <a class="page-link" href="#" aria-label="Next" data-entryindex="-2">
            <span aria-hidden="true">&raquo;</span>
        </a>
    </li>`;
    paginationHtml += `<li class="page-item count">
               <span>${totalItems}<br>items</li>`;
    paginationHtml += '</ul>';

    return paginationHtml;
  }
  handlePaginationClick(newIndex: number, totalItems: number, selectedIndex: number, itemsPerPage: number, pageIndex: number) {
    if (newIndex === -1) {
      pageIndex = Math.max(pageIndex - 1, 0);
      if (selectedIndex < pageIndex * itemsPerPage) {
        selectedIndex = pageIndex * itemsPerPage;
      } else if (selectedIndex > (pageIndex + 1) * itemsPerPage - 1) {
        selectedIndex = pageIndex * itemsPerPage;
      }
    } else if (newIndex === -2) {
      pageIndex = Math.min(pageIndex + 1, Math.ceil(totalItems / itemsPerPage) - 1);
      if (selectedIndex < pageIndex * itemsPerPage) {
        selectedIndex = pageIndex * itemsPerPage;
      } else if (selectedIndex > (pageIndex + 1) * itemsPerPage - 1) {
        selectedIndex = pageIndex * itemsPerPage;
      }
    } else if (newIndex === -10) {
      selectedIndex -= 1;
      pageIndex = Math.floor(selectedIndex / itemsPerPage);
    } else if (newIndex === -20) {
      selectedIndex += 1;
      if (selectedIndex > totalItems - 1) selectedIndex = totalItems - 1;
      if (selectedIndex < 0) selectedIndex = 0;
      pageIndex = Math.floor(selectedIndex / itemsPerPage);
    } else {
      selectedIndex = newIndex;
      pageIndex = Math.floor(selectedIndex / itemsPerPage);
    }

    return {
      selectedIndex,
      pageIndex,
    }
  }
  async processPromptUsingUnacogAPI(message: string): Promise<any> {
    let apiToken = await this.chrome.storage.local.get('apiToken');
    apiToken = apiToken.apiToken || '';
    let sessionId = await this.chrome.storage.local.get('sessionId');
    sessionId = sessionId.sessionId || '';

    let resultMessage = 'unknown error';
    let promptResult: any = {};
    let error = true;

    const body = {
      message,
      apiToken,
      sessionId,
      disableEmbedding: true,
    };
    try {
      const fetchResults = await fetch(this.promptUrl, {
        method: "POST",
        mode: "cors",
        cache: "no-cache",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      promptResult = await fetchResults.json();
      if (!promptResult.success) {
        console.log("error", promptResult);
        resultMessage = promptResult.errorMessage;
      } else {
      }
      if (promptResult.assist) {
        if (promptResult.assist.error) {
          resultMessage = promptResult.assist.error.message;
        } else if (promptResult.assist.assist.error) {
          resultMessage = promptResult.assist.assist.error.message;
        } else {
          resultMessage = promptResult.assist.assist.choices["0"].message.content;
          error = false;
        }
      }
    } catch (err: any) {
      console.log("error", err);
      resultMessage = err.message;
      error = err;
    }


    return {
      resultMessage,
      originalPrompt: message,
      promptResult,
      error,
    }
  }
  async writeCloudDataUsingUnacogAPI(fileName: string, fileData: any, mimeType = "", fileExt = ""): Promise<any> {
    let apiToken = await this.chrome.storage.local.get('apiToken');
    apiToken = apiToken.apiToken || '';
    let sessionId = await this.chrome.storage.local.get('sessionId');
    sessionId = sessionId.sessionId || '';

    const body = {
      fileName,
      apiToken,
      sessionId,
      fileData,
      mimeType,
      fileExt,
    };
    try {
      const fetchResults = await fetch(this.cloudWriteUrl, {
        method: "POST",
        mode: "cors",
        cache: "no-cache",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const cloudWriteResult = await fetchResults.json();
      if (!cloudWriteResult.success) {
        return cloudWriteResult;
      }

      const encodedFragment = encodeURIComponent(cloudWriteResult.storagePath);
      const publicStorageUrlPath = `https://firebasestorage.googleapis.com/v0/b/promptplusai.appspot.com/o/${encodedFragment}?alt=media`;

      return {
        success: true,
        publicStorageUrlPath,
      }
    } catch (err: any) {
      return {
        success: false,
        error: err,
      };
    }
  }
  processRawResultstoCompact(analysisResults: any[]) {
    let compactData: any[] = [];
    analysisResults.forEach((urlResult: any) => {
      let compactResult: any = {};
      compactResult.url = urlResult.url;
      compactResult.title = urlResult.title;

      const results = urlResult.results;
      if (results) {
        results.forEach((metricResult: any) => {
          const fieldName = metricResult.prompt.name + "_" + metricResult.prompt.setName;
          if (metricResult.prompt.metricType === "score 0 - 10") {
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
    return compactData;
  }
  async setBulkRunning() {
    let bulk_running = await this.chrome.storage.local.get('bulk_running');
    if (bulk_running && bulk_running.bulk_running) {
      return true;
    }

    await this.chrome.storage.local.set({
      bulk_running: true,
    });
    return false;
  }
  prepDataForHistoryRender(entry: any, historyIndex: number) {
    let usageCreditTotal = 0;
    let resultHistory = entry.result;
    if (!resultHistory) resultHistory = entry.results[0];
    let noError = true;
    let errorMessage = "";
    if (entry.results.length > 0) {
      entry.results.forEach((result: any) => {
        if (result.result.error) {
          noError = false;
          errorMessage = result?.result?.promptResult?.assist?.error;
        }
      });
      if (!noError) {
        return {
          html: `<div class="history_error_message flex-1 text-center">${errorMessage}</div>`,
          usageCreditTotal,
        };
      }
    }

    let allResults = entry.results;
    let setBasedResults: any = {};
    allResults.forEach((result: any) => {
      if (!setBasedResults[result.prompt.setName]) {
        setBasedResults[result.prompt.setName] = [];
      }
      setBasedResults[result.prompt.setName].push(result);
    });
    const setNamesArray = Object.keys(setBasedResults);

    return {
      setNamesArray,
      setBasedResults,
      allResults,
    };
  }
  static _formatAMPM(date: any) {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? "0" + minutes : minutes;
    return hours + ":" + minutes + " " + ampm;
  }
  static showGmailStyleDate(ISOdate: any, amFormat = false) {
    let date = new Date(ISOdate);
    if (Date.now() - date.getTime() < 24 * 60 * 60 * 1000) {
      if (amFormat) return this._formatAMPM(date);

      let result = this._formatAMPM(date);
      return result;
    }

    return date.toLocaleDateString("en-us", {
      month: "short",
      day: "numeric",
    });
  }
  static timeSince(date: Date, showSeconds = false): string {
    let seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    seconds = Math.max(seconds, 0);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + ` yrs ago`;

    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + ` months ago`;

    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + ` days ago`;

    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + ` hrs ago`;

    if (showSeconds) return Math.floor(seconds) + " s";

    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + ` mins ago`;

    return "now";
  }
  static updateTimeSince(container: any) {
    const elements = container.querySelectorAll(".time_since");
    elements.forEach((ctl: any) => {
      const timeStyle = ctl.dataset.timestyle;
      const isoTime = ctl.dataset.timesince;
      const showSeconds = ctl.dataset.showseconds;

      let dateDisplay: string;
      if (timeStyle === "gmail") {
        dateDisplay = AnalyzerExtensionCommon.showGmailStyleDate(new Date(isoTime));
      } else {
        dateDisplay = AnalyzerExtensionCommon.timeSince(new Date(isoTime), (showSeconds === "1"));
      }
      ctl.innerText = dateDisplay;
    });
  }
  async toggleExentionPage(url: string) {
    const [extensionTab] = await this.chrome.tabs.query({
      url: `chrome-extension://${this.chrome.runtime.id}/main.html`,
      lastFocusedWindow: true,
    });
    const urlHashtag = url.split("#")[1] || "";

    if (extensionTab) {
      await this.chrome.tabs.update(extensionTab.id, {
        active: true,
        url: `chrome-extension://${this.chrome.runtime.id}/main.html#${urlHashtag}`
      });
    } else {
      await this.chrome.tabs.create({
        url
      });
    }
  }
  async toggleSidePanel(currentTab: any = null) {
    const lastPanelToggleDate = new Date().toISOString();
    if (currentTab) {
      this.chrome.sidePanel.open({ tabId: currentTab.id });
    } else {
      [currentTab] = await this.chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      this.chrome.sidePanel.open({ tabId: currentTab.id });
    }

    await this.chrome.storage.local.set({
      lastPanelToggleDate,
      lastPanelToggleWindowId: currentTab.windowId,
    });
  }
  async updateSessionKeyStatus() {
    let sessionId = await this.chrome.storage.local.get('sessionId');
    sessionId = sessionId?.sessionId || "";
    let apiToken = await this.chrome.storage.local.get('apiToken');
    apiToken = apiToken?.apiToken || "";
    if (apiToken && sessionId) {
      document.body.classList.add("session_key_set");
      document.body.classList.remove("no_session_key_set");
    } else {
      document.body.classList.remove("session_key_set");
      document.body.classList.add("no_session_key_set");
    }
  }
  async getFieldFromStorage(domInput: HTMLInputElement | HTMLTextAreaElement, storageKey: string, defaultStorageKey = "") {
    clearTimeout(this.debouncedInputTimeouts[storageKey]);
    const getFieldValue = async () => {
      let value = await this.getStorageField(storageKey);
      if (!value && defaultStorageKey) value = await this.getStorageField(defaultStorageKey);
      return value;
    }
    const value = await getFieldValue();
    if (value === domInput.value) return;
    if (!this.debouncedInputTimeouts[storageKey] && !domInput.value && value) {
      domInput.value = value;
    }
    this.debouncedInputTimeouts[storageKey] = setTimeout(async () => {
      const value = await getFieldValue();
      if (domInput.value !== value) domInput.value = value;
    }, 500);
  }
  async getStorageField(field: string) {
    let value = await this.chrome.storage.local.get(field);
    value = value[field] || '';
    return value;
  }
  async setFieldToStorage(domInput: HTMLInputElement | HTMLTextAreaElement, storageKey: string) {
    let value = domInput.value;
    await this.chrome.storage.local.set({ [storageKey]: value });
  }
  async enabledBrowserScrapePermissions() {
    // Permissions must be requested from inside a user gesture, like a button's
    // click handler.
    await this.chrome.permissions.request({
      permissions: ["tabs"],
      origins: ["https://*/*",
        "http://*/*"]
    }, (granted: any) => {
      if (!granted) {
        alert("Browser scraping permission denied. You can enable it from the extension settings page");
      }
    });
  }
  static processOptions(options: string): any {
    const opts = options.split("||");
    const optionsMap: any = {};
    opts.forEach((opt: string) => {
      const pieces = opt.trim().split("=");
      const key = pieces[0].trim();
      if (key !== "") {
        let value = "";
        if (pieces.length > 1) value = pieces.slice(1).join("=").trim();

        optionsMap[key] = value;
      }
    });

    return optionsMap;
  }
  async updateBrowserContextMenus() {
    const hideAnalyzeInPageContextMenu = await this.getStorageField('hideAnalyzeInPageContextMenu');
    const showQueryInPageContextMenu = await this.getStorageField('showQueryInPageContextMenu');
    const hideAnalyzeInSelectionContextMenu = await this.getStorageField('hideAnalyzeInSelectionContextMenu');
    const showQueryInSelectionContextMenu = await this.getStorageField('showQueryInSelectionContextMenu');

    let updateContextMenu = false;
    if (this.lastSeenContextMenuSettings.hideAnalyzeInSelectionContextMenu !== hideAnalyzeInSelectionContextMenu) {
      this.lastSeenContextMenuSettings.hideAnalyzeInSelectionContextMenu = hideAnalyzeInSelectionContextMenu;
      updateContextMenu = true;
    }
    if (this.lastSeenContextMenuSettings.hideAnalyzeInPageContextMenu !== hideAnalyzeInPageContextMenu) {
      this.lastSeenContextMenuSettings.hideAnalyzeInPageContextMenu = hideAnalyzeInPageContextMenu;
      updateContextMenu = true;
    }
    if (this.lastSeenContextMenuSettings.showQueryInSelectionContextMenu !== showQueryInSelectionContextMenu) {
      this.lastSeenContextMenuSettings.showQueryInSelectionContextMenu = showQueryInSelectionContextMenu;
      updateContextMenu = true;
    }
    if (this.lastSeenContextMenuSettings.showQueryInPageContextMenu !== showQueryInPageContextMenu) {
      this.lastSeenContextMenuSettings.showQueryInPageContextMenu = showQueryInPageContextMenu;
      updateContextMenu = true;
    }

    if (!updateContextMenu) return;
    await this.chrome.contextMenus.removeAll();

    if (!hideAnalyzeInSelectionContextMenu) {
      this.chrome.contextMenus.create({
        id: 'hideAnalyzeInSelectionContextMenu',
        title: 'Analyze selection',
        type: 'normal',
        contexts: ['selection']
      });
    }

    if (!hideAnalyzeInPageContextMenu) {
      this.chrome.contextMenus.create({
        id: 'hideAnalyzeInPageContextMenu',
        title: 'Analyze page',
        type: 'normal',
        contexts: ['page']
      });
    }

    if (showQueryInSelectionContextMenu) {
      this.chrome.contextMenus.create({
        id: 'showQueryInSelectionContextMenu',
        title: 'Semantic query Selection',
        type: 'normal',
        contexts: ['selection']
      });
    }

    if (showQueryInPageContextMenu) {
      this.chrome.contextMenus.create({
        id: 'showQueryInPageContextMenu',
        title: 'Semantic query page',
        type: 'normal',
        contexts: ['page']
      });
    }
  }
}
