export class AnalyzerExtensionCommon {
  promptUrl = `https://us-central1-promptplusai.cloudfunctions.net/lobbyApi/session/external/message`;
  cloudWriteUrl = `https://us-central1-promptplusai.cloudfunctions.net/lobbyApi/session/external/cloudwrite`;
  chrome: any;
  query_source_tokens_length: any;
  previousSlimOptions = '';
  activeTabsBeingScraped: any = [];
  debouncedInputTimeouts: any = {};
  lastSeenContextMenuSettings: any = {};

  constructor(chrome: any) {
    this.chrome = chrome;
    // for detecting in browser scraping completion
    chrome.tabs.onUpdated.addListener(
      (tabId: number, changeInfo: any, tab: any) => {
        if (this.activeTabsBeingScraped[tabId] && changeInfo.status === "complete") {
          this.activeTabsBeingScraped[tabId]();
        }
      }
    );
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
    return compactData;
  }
  async getDefaultAnalysisPrompts() {
    const promptListFile = await fetch("/defaults/promptDefaultsList.json");
    const defaultPromptList = await promptListFile.json();
    const promises: any[] = [];
    defaultPromptList.forEach((url: string) => {
      promises.push((async (url) => {
        let promptQuery = await fetch("/defaults/" + url + ".json");
        let defaultPrompts = await promptQuery.json();
        const allPrompts: any[] = [];
        defaultPrompts.forEach((prompt: any) => {
          prompt.setName = url;
          allPrompts.push(prompt);
        });
        return allPrompts;
      })(url));
    });
    const defaultPrompts = await Promise.all(promises);
    const resultPrompts: any[] = [];
    defaultPrompts.forEach((promptList, index) => {
      promptList.forEach((prompt: any) => {
        resultPrompts.push(prompt);
      });
    });
    return resultPrompts;
  }
  async getAnalysisPrompts() {
    let prompts = await this.getDefaultAnalysisPrompts();
    prompts = this.processPromptRows(prompts);
    let rawData = await this.chrome.storage.local.get('masterAnalysisList');
    if (rawData && rawData.masterAnalysisList && Object.keys(rawData.masterAnalysisList).length > 0) {
      prompts = rawData.masterAnalysisList;
    }
    return prompts;
  }
  async getAnalysisSetNames() {
    let allPrompts = await this.getAnalysisPrompts();
    let analysisSets: any = {};
    allPrompts.forEach((prompt) => {
      if (!analysisSets[prompt.setName]) {
        analysisSets[prompt.setName] = [];
      }
      analysisSets[prompt.setName].push(prompt);
    });

    return Object.keys(analysisSets);
  }
  async setRunning(prompt = false) {
    let running = await this.chrome.storage.local.get('running');
    if (running && running.running) {
      return true;
    }

    await this.chrome.storage.local.set({
      running: true,
    });
    return false;
  }
  async setBulkRunning(prompt = false) {
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
  renderHTMLForHistoryEntry(entry: any, historyIndex: number): {
    html: string;
    usageCreditTotal: number;
  } {
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
    let headerHtml = ``;
    let resultsHTML = `<div class="history_results flex flex-wrap flex-1">`;
    let allResults = entry.results;
    let setBasedResults: any = {};
    allResults.forEach((result: any) => {
      if (!setBasedResults[result.prompt.setName]) {
        setBasedResults[result.prompt.setName] = [];
      }
      setBasedResults[result.prompt.setName].push(result);
    });
    const setNamesArray = Object.keys(setBasedResults);
    setNamesArray.forEach((setName: any, index: number) => {
      let historyIndexDisplay = (historyIndex + 1).toString();
      if (setNamesArray.length > 1) {
        historyIndexDisplay += String.fromCharCode(97 + index);
      }
      resultsHTML += `
            <div class="history_entry_set_wrapper mx-1 my-1 flex flex-col">
            <div class="flex flex-row">
                <h6 class="history_entry_prompt_setname pl-2 pr-1 flex-1 py-2 fs-5">${setName}</h6>
                <div class="whitespace-nowrap">
                  <button class="download_compact_results_btn btn_icon text-sm inline-flex m-1 p-2" data-historyindex="${historyIndex}">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15M9 12l3 3m0 0 3-3m-3 3V2.25" />
                      </svg>                
                    CSV</button>
                  <button class="download_full_results_btn btn_icon text-sm inline-flex m-1 mr-0 p-2" data-historyindex="${historyIndex}">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15M9 12l3 3m0 0 3-3m-3 3V2.25" />
                      </svg>    
                    Full</button>
                    <span class="history_index pr-2 font-bold inline-block w-[30px] relative top-[-4px] text-right text-slate-500">${historyIndexDisplay}</span>
                  </div>
              </div>
              <hr class="history_separator">
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
        resultsHTML += this.getHTMLforPromptResult(result);
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
  getHTMLforPromptResult(result: any) {
    const usageText = ``;
    if (result.prompt.promptType === 'metric') {
      try {
        let json = JSON.parse(result.result.resultMessage);
        let metric = json.contentRating;
        return `
            <div class="prompt_result metric_result mx-2 py-2">
              <span class="prompt_id">${result.prompt.id}</span>
              <span class="metric_score">${metric}<span class="outofscore">/10</span></span>
              <div class="metric_bar">
              <div class="metric_fill" style="width: ${metric * 10}%;"></div>
              </div>
            </div>
          `;
      } catch (error) {
        return `
            <div class="prompt_result error_result mx-2 py-2">
              <div class="prompt_header">
                <span class="prompt_id">${result.prompt.id}</span>
              </div>
              <div class="result_content">${result.result.resultMessage}</div>
            </div>
          `;
      }
    } else if (result.prompt.promptType === 'json') {
      let resultDisplay = '';
      try {
        resultDisplay = JSON.stringify(JSON.parse(result.result.resultMessage), null, 2);
      } catch (error) {
        resultDisplay = result.result.resultMessage;
      }
      return `
          <div class="prompt_result json_result mx-2 py-2">
            <div class="prompt_header">
              <span class="prompt_id">${result.prompt.id}</span>
            </div>
            <div class="result_content">${resultDisplay}</div>
            <div class="result_usage">${usageText}</div>
          </div>
        `;
    } else {
      return `
          <div class="prompt_result text_result mx-2 py-2">
            <div class="prompt_header">
              <span class="prompt_id">${result.prompt.id}</span>
            </div>
            <div class="result_content">${result.result.resultMessage}</div>
            <div class="result_usage">${usageText}</div>
          </div>
        `;
    }
  }
  truncateText(text: any, maxLength: any) {
    if (!text) return '';
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength) + '...';
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
  async toggleExentionPage(url: string, openOnly = false) {
    const [extensionTab] = await this.chrome.tabs.query({
      url: `chrome-extension://${this.chrome.runtime.id}/main.html`,
      lastFocusedWindow: true,
    });

    if (extensionTab && extensionTab.active !== true) {
      await this.chrome.tabs.update(extensionTab.id, { active: true });
    } else if (extensionTab && !openOnly) {
      await this.chrome.tabs.remove(extensionTab.id);
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
  async getFieldFromStorage(domInput: HTMLInputElement | HTMLTextAreaElement, storageKey: string) {
    clearTimeout(this.debouncedInputTimeouts[storageKey]);
    this.debouncedInputTimeouts[storageKey] = setTimeout(async () => {
      let value = await this.chrome.storage.local.get(storageKey);
      value = value[storageKey] || '';
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
  async detectTabLoaded(tabId: number) {
    return new Promise((resolve, reject) => {
      this.activeTabsBeingScraped[tabId] = resolve;
    });
  }
  processPromptRows(rows: any[]): any[] {
    rows.forEach((row: any) => {
      if (!row.promptType) row.promptType = 'metric';
    });
    return rows;
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
    let hideAnalyzeInPageContextMenu = await this.getStorageField('hideAnalyzeInPageContextMenu');
    let showQueryInPageContextMenu = await this.getStorageField('showQueryInPageContextMenu');
    let hideAnalyzeInSelectionContextMenu = await this.getStorageField('hideAnalyzeInSelectionContextMenu');
    let showQueryInSelectionContextMenu = await this.getStorageField('showQueryInSelectionContextMenu');

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
