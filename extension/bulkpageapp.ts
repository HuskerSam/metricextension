import { AnalyzerExtensionCommon } from './extensioncommon';
import { TabulatorFull } from 'tabulator-tables';
import SlimSelect from 'slim-select';
declare const chrome: any;

export default class BulkPageApp {
  previousSlimOptions = "";
  extCommon = new AnalyzerExtensionCommon(chrome);
  bulk_analysis_sets_select: any = document.querySelector('.bulk_analysis_sets_select');
  bulkSelected: SlimSelect;
  bulk_url_list_tabulator: TabulatorFull;
  add_bulk_url_row = document.querySelector('.add_bulk_url_row') as HTMLButtonElement;
  run_bulk_analysis_btn = document.querySelector('.run_bulk_analysis_btn') as HTMLButtonElement;
  bulk_analysis_results_history = document.querySelector('.bulk_analysis_results_history') as HTMLDivElement;
  download_url_list = document.querySelector('.download_url_list') as HTMLButtonElement;
  upload_url_list = document.querySelector('.upload_url_list') as HTMLButtonElement;
  url_file_input = document.getElementById('url_file_input') as HTMLInputElement;
  runId = '';
  chromeTabListener: any = null;
  activeTabsBeingScraped: any = [];

  constructor() {
    this.bulk_url_list_tabulator = new TabulatorFull(".bulk_url_list_tabulator", {
      layout: "fitColumns",
      movableRows:true,
      rowHeader:{headerSort:false, resizable: false, minWidth:30, width:30, rowHandle:true, formatter:"handle"},
      columns: [
        { title: "URL", field: "url", editor: "input" },
        {
          title: "",
          field: "delete",
          headerSort: false,
          formatter: () => {
              return `<i class="material-icons-outlined">delete</i>`;
          },
          hozAlign: "center",
          width: 30,
      },
      ],
    });
    this.bulk_url_list_tabulator.on("cellClick", async (e: Event, cell: any) => {
      if (cell.getColumn().getField() === "delete") {
        let bulkUrlList = this.bulk_url_list_tabulator.getData();
        this.bulk_url_list_tabulator.deleteRow(cell.getRow());
        await chrome.storage.local.set({ bulkUrlList });
      }
    });
    this.bulk_url_list_tabulator.on("cellEdited", async (cell: any) => {
      let bulkUrlList = this.bulk_url_list_tabulator.getData();
      await chrome.storage.local.set({ bulkUrlList });
    });
    this.add_bulk_url_row.addEventListener('click', async () => {
      let bulkUrlList = this.bulk_url_list_tabulator.getData();
      bulkUrlList.push({ url: "", analysis_set: "" });
      this.bulk_url_list_tabulator.setData(bulkUrlList);
      await chrome.storage.local.set({ bulkUrlList });
    });
    this.run_bulk_analysis_btn.addEventListener('click', async () => {
      await this.runBulkAnalysis();
    });
    this.download_url_list.addEventListener('click', async () => {
      this.bulk_url_list_tabulator.download("csv", "bulk_url_list.csv");
    });
    this.upload_url_list.addEventListener('click', async () => {
      this.url_file_input.click();
    });
    this.url_file_input.addEventListener('change', async () => {
      let file = (this.url_file_input.files as any)[0];
      let reader = new FileReader();
      reader.onload = async () => {
        let text = reader.result as string;
        let lines = text.split('\n');
        let bulkUrlList: any[] = [];
        lines.forEach((line) => {
          let parts = line.split(',');
          bulkUrlList.push({ url: parts[0], analysis_set: parts[1] });
        });
        this.bulk_url_list_tabulator.setData(bulkUrlList);
        await chrome.storage.local.set({ bulkUrlList });
      };
      reader.readAsText(file);
    });


    this.bulkSelected = new SlimSelect({
      select: '.bulk_analysis_sets_select',
      settings: {
        showSearch: false,
        placeholderText: 'Select Analysis Set(s)',
        keepOrder: true,
        hideSelected: true,
        minSelected: 1,
        closeOnSelect: false,
      },
      events: {
        afterChange: async (newVal) => {
          let selectedBulkAnalysisSets: any[] = [];
          this.bulkSelected.render.main.values.querySelectorAll('.ss-value')
            .forEach((item: any) => {
              selectedBulkAnalysisSets.push(item.innerText);
            });
          if (selectedBulkAnalysisSets.length <= 1) {
            this.bulk_analysis_sets_select.classList.add('slimselect_onevalue');
          } else {
            this.bulk_analysis_sets_select.classList.remove('slimselect_onevalue');
          }
          await chrome.storage.local.set({ selectedBulkAnalysisSets });
        },
      },
    });

    chrome.tabs.onUpdated.addListener(
      (tabId: number, changeInfo: any, tab: any) => {
        console.log(tabId, changeInfo, tab);
        if (this.activeTabsBeingScraped[tabId] && changeInfo.status === "complete") {
          console.log("Tab loaded", tabId);
          this.activeTabsBeingScraped[tabId]();
        }
      }
    );

    chrome.storage.local.onChanged.addListener(() => {
      this.paintData();
    });
    this.paintData();
  }

  async runBulkAnalysis() {
    document.body.classList.add("bulk_analysis_running");
    this.runId = new Date().toISOString();
    let rows = this.bulk_url_list_tabulator.getData();
    let urls: string[] = [];
    rows.forEach((row: any) => {
      urls.push(row.url);
    });
    let promises: any[] = [];
    urls.forEach((url) => {
      promises.push(this.scrapeTabPage(url));
    });
    let results = await Promise.all(promises);
    let analysisPromises: any[] = [];
    results.forEach((result: any, index: number) => {
      console.log(result);
      analysisPromises.push(this.extCommon.runAnalysisPrompts(result[0].result, urls[index], null, "selectedBulkAnalysisSets", false, result.title));
    });
    let analysisResults = await Promise.all(analysisPromises);
    const fullCloudUploadResult = await this.extCommon.writeCloudDataUsingUnacogAPI(this.runId + ".json", analysisResults);

    let compactData: any[] = [];
    analysisResults.forEach((urlResult: any) => {
      let compactResult: any = {};
      compactResult.url = urlResult.url;
      compactResult.title = urlResult.title;

      urlResult.results.forEach((metricResult: any) => {
        const fieldName = metricResult.prompt.setName + "_" + metricResult.prompt.id;
        console.log(fieldName, metricResult.result);
        if (metricResult.prompt.prompttype === "metric") {
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
      compactData.push(compactResult);
    });
    const compactResult = await this.extCommon.writeCloudDataUsingUnacogAPI(this.runId + "compact.json", compactData, "text/csv");
    document.body.classList.remove("bulk_analysis_running");

    let bulkHistory = await chrome.storage.local.get('bulkHistory');
    let bulkHistoryRangeLimit = await chrome.storage.local.get('bulkHistoryRangeLimit');
    bulkHistoryRangeLimit = Number(bulkHistoryRangeLimit.bulkHistoryRangeLimit) || 100;
    bulkHistory = bulkHistory.bulkHistory || [];
    bulkHistory.unshift({
      runId: this.runId,
      urls,
      compactResultPath: compactResult.publicStorageUrlPath,
      analysisResultPath: fullCloudUploadResult.publicStorageUrlPath,
    });
    bulkHistory = bulkHistory.slice(0, bulkHistoryRangeLimit);
    await chrome.storage.local.set({ bulkHistory });
  }

  async scrapeTabPage(url: any) {
    return new Promise(async (resolve, reject) => {
      let tab = await chrome.tabs.create({
        url
      });

      function getDom() {
        return document.body.innerText;
      }
      await this.detectTabLoaded(tab.id);
      setTimeout(async () => {

        let scrapes = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: getDom,
        });
        const updatedTab = await chrome.tabs.get(tab.id);
        scrapes.title = updatedTab.title;
        await chrome.tabs.remove(tab.id);
        resolve(scrapes);
      }, 3000);
    });
  }
  async detectTabLoaded(tabId: number) {
    return new Promise((resolve, reject) => {
      this.activeTabsBeingScraped[tabId] = resolve;
    });
  }
  analysisHistoryLogRowTemplate(historyItem: any, index: number): string {
    return `
      url count: ${historyItem.urls.length} <br>
      run date: ${new Date(historyItem.runId).toLocaleString()} <br> 
      <button class="download_full_json btn" data-index="${index}">download full JSON</button>
      <button class="download_compact_csv btn" data-index="${index}">download compact CSV</button>
    `;
  }
  async paintData() {
    let allUrls: any[] = [];
    let rawData = await chrome.storage.local.get('bulkUrlList');
    if (rawData && rawData.bulkUrlList && Object.keys(rawData.bulkUrlList).length > 0) {
      allUrls = rawData.bulkUrlList;
    }

    this.bulk_url_list_tabulator.setData(allUrls);

    let running = await chrome.storage.local.get('running');
    if (running && running.running) {
      document.body.classList.add("extension_running");
      document.body.classList.remove("extension_not_running");
    } else {
      document.body.classList.remove("extension_running");
      document.body.classList.add("extension_not_running");
    }

    const setNames = await this.extCommon.getAnalysisSetNames();
    let html = "";
    setNames.forEach((setName) => {
      html += `<option value="${setName}">${setName}</option>`;
    });
    let selectedBulkAnalysisSets = await chrome.storage.local.get("selectedBulkAnalysisSets");
    let slimOptions: any[] = [];
    setNames.forEach((setName) => {
      slimOptions.push({ text: setName, value: setName });
    });
    const slimOptionsString = JSON.stringify(slimOptions);
    if (this.previousSlimOptions !== slimOptionsString) {
      this.bulkSelected.setData(slimOptions);
      this.previousSlimOptions = slimOptionsString;
    }

    if (selectedBulkAnalysisSets && selectedBulkAnalysisSets.selectedBulkAnalysisSets) {
      this.bulkSelected.setSelected(selectedBulkAnalysisSets.selectedBulkAnalysisSets);
      let domSelections = this.bulkSelected.render.main.values.querySelectorAll('.ss-value');
      let indexMap: any = {};
      domSelections.forEach((item: any, index: any) => {
        indexMap[item.innerText] = index;
      });
      let setOrder = selectedBulkAnalysisSets.selectedBulkAnalysisSets;
      setOrder.forEach((setName: any, index: any) => {
        let domIndex = indexMap[setName];
        if (domSelections[domIndex]) {
          this.bulkSelected.render.main.values.appendChild(domSelections[domIndex]);
        }
      });
    }
    if (this.bulkSelected.getSelected().length === 0) {
      this.bulkSelected.setSelected([setNames[0]]);
    }
    this.paintAnalysisHistory();
  }

  async paintAnalysisHistory() {
    let bulkHistory = await chrome.storage.local.get('bulkHistory');
    bulkHistory = bulkHistory.bulkHistory || [];
    let html = "";
    bulkHistory.forEach((historyItem: any, index: number) => {
      html += this.analysisHistoryLogRowTemplate(historyItem, index);
    });
    this.bulk_analysis_results_history.innerHTML = html;
    this.bulk_analysis_results_history.querySelectorAll('.download_full_json').forEach((item: any) => {
      item.addEventListener('click', async () => {
        let index = item.getAttribute('data-index');
        let bulkHistory = await chrome.storage.local.get('bulkHistory');
        bulkHistory = bulkHistory.bulkHistory || [];
        let historyItem = bulkHistory[index];
         let a = document.createElement('a');
         document.body.appendChild(a);
        a.href = historyItem.analysisResultPath;
        a.click();
        document.body.removeChild(a);
      });
    });
    this.bulk_analysis_results_history.querySelectorAll('.download_compact_csv').forEach((item: any) => {
      item.addEventListener('click', async () => {
        let index = item.getAttribute('data-index');
        let bulkHistory = await chrome.storage.local.get('bulkHistory');
        bulkHistory = bulkHistory.bulkHistory || [];
        let historyItem = bulkHistory[index];
        let a = document.createElement('a');
        document.body.appendChild(a);
        a.href = historyItem.compactResultPath;
        a.click();
        document.body.removeChild(a);
      });
    });
  }
}
