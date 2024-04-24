import Mustache from 'mustache';

export class AnalyzerExtensionCommon {
  promptUrl = `https://us-central1-promptplusai.cloudfunctions.net/lobbyApi/session/external/message`;
  cloudWriteUrl = `https://us-central1-promptplusai.cloudfunctions.net/lobbyApi/session/external/cloudwrite`;
  cloudScrapeUrl = `https://us-central1-promptplusai.cloudfunctions.net/lobbyApi/session/external/scrapeurl`;
  chrome: any;
  query_source_tokens_length: any;
  previousSlimOptions = '';

  constructor(chrome: any) {
    this.chrome = chrome;
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
  async sendPromptForMetric(promptTemplate: string, query: string) {
    try {
      let result = Mustache.render(promptTemplate, { query });
      return result;
    } catch (error) {
      console.log(promptTemplate, query, error);
      return `{
        "contentRating": -1
      }`;
    }
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
  async runAnalysisPrompts(text: string, url = "", promptToUse = null, selectedSetName = "selectedAnalysisSets", addToHistory = true, title = "") {
    if (text.length > 30000) text = text.slice(0, 30000);
    const runDate = new Date().toISOString();

    let prompts: any = [];
    let analysisPrompts: any = await this.getAnalysisPrompts();
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
      let result = await this.processPromptUsingUnacogAPI(fullPrompt);
      return {
        prompt,
        result,
      };
    };

    let promises = [];
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
        running: false,
      });
    }

    return historyEntry;
  }
  getHTMLforPromptResult(result: any) {
    const usageText = ``;
    if (result.prompt.promptType === 'text') {
      return `
          <div class="prompt_result text_result">
            <div class="prompt_header">
              <span class="prompt_id">${result.prompt.id}</span>
            </div>
            <div class="result_content">${result.result.resultMessage}</div>
            <div class="result_usage">${usageText}</div>
          </div>
        `;
    } else if (result.prompt.promptType === 'metric') {
      try {
        let json = JSON.parse(result.result.resultMessage);
        let metric = json.contentRating;
        return `
            <div class="prompt_result metric_result">
              <span class="prompt_id">${result.prompt.id}</span>
              <span class="metric_score">${metric}<span class="outofscore">/10</span></span>
              <div class="metric_bar">
              <div class="metric_fill" style="width: ${metric * 10}%;"></div>
              </div>
            </div>
          `;
      } catch (error) {
        return `
            <div class="prompt_result error_result">
              <div class="prompt_header">
                <span class="prompt_id">${result.prompt.id}</span>
              </div>
              <div class="result_content">${result.result.resultMessage}</div>
            </div>
          `;
      }
    } else {
      let resultDisplay = '';
      try {
        resultDisplay = JSON.stringify(JSON.parse(result.result.resultMessage), null, 2);
      } catch (error) {
        resultDisplay = result.result.resultMessage;
      }
      return `
          <div class="prompt_result json_result">
            <div class="prompt_header">
              <span class="prompt_id">${result.prompt.id}</span>
            </div>
            <div class="result_content">${resultDisplay}</div>
            <div class="result_usage">${usageText}</div>
          </div>
        `;
    }
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
  truncateText(text: any, maxLength: any) {
    if (!text) return '';
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength) + '...';
  }
  _formatAMPM(date: any) {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? "0" + minutes : minutes;
    return hours + ":" + minutes + " " + ampm;
  }
  showGmailStyleDate(ISOdate: any, amFormat = false) {
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
  async toggleExentionPage(url: string) {
    const [extensionTab] = await this.chrome.tabs.query({
      url: `chrome-extension://${this.chrome.runtime.id}/main.html`,
      lastFocusedWindow: true,
    });

    if (extensionTab && extensionTab.active !== true) {
      await this.chrome.tabs.update(extensionTab.id, { active: true });
    } else if (extensionTab) {
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
    let value = await this.chrome.storage.local.get(storageKey);
    value = value[storageKey] || '';
    if (domInput.value !== value) domInput.value = value;
  }
  async setFieldToStorage(domInput: HTMLInputElement | HTMLTextAreaElement, storageKey: string) {
    let value = domInput.value;
    await this.chrome.storage.local.set({ [storageKey]: value });
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
  async getStorageField(field: string) {
    let value = await this.chrome.storage.local.get(field);
    value = value[field] || '';
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
    
    if (sourceType === 'scrape') {
      if (clearCache) {
        const url = await this.getURLContentSource();
        const result = await this.scrapeURLUsingAPI(url, "");
        let content = "";
        if (result.success) {
          content = result.result.text;
        } else {
          content
        }

        await this.chrome.storage.local.set({ sidePanelScrapeContent: content });
        return content;
      }

      return await this.getStorageField("sidePanelScrapeContent");
    } else {
      return await this.getTextContentSource();
    }
  }
}
