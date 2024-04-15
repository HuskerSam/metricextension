import { AnalyzerExtensionCommon } from './extensioncommon';
import { TabulatorFull } from 'tabulator-tables';
import SlimSelect from 'slim-select';
declare const chrome: any;
import Papa from "papaparse";


export default class BulkPageApp {
  previousSlimOptions = "";
  extCommon = new AnalyzerExtensionCommon(chrome);
  bulk_analysis_sets_select: any = document.querySelector('.bulk_analysis_sets_select');
  bulkSelected: SlimSelect;
  bulk_url_list_tabulator: TabulatorFull;
  add_bulk_url_row = document.querySelector('.add_bulk_url_row') as HTMLButtonElement;
  run_bulk_analysis_btn = document.querySelector('.run_bulk_analysis_btn') as HTMLButtonElement;
  download_full_json = document.querySelector('.download_full_json') as HTMLButtonElement;
  download_compact_csv = document.querySelector('.download_compact_csv') as HTMLButtonElement;
  runId = '';
  lastRunFullData: any[] | null = null;
  lastRunCompactData: any[] | null = null;
  chromeTabListener: any = null;
  activeTabsBeingScraped: any = [];

  constructor() {
    this.bulk_url_list_tabulator = new TabulatorFull(".bulk_url_list_tabulator", {
      layout: "fitColumns",
      columns: [
        { title: "URL", field: "url", editor: "input" },
      ],
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

    this.download_full_json.addEventListener('click', async () => {
      if (this.lastRunFullData === null) {
        alert("No data to download");
        return;
      }

      const fileName = this.runId + ".json";
      let fullRunData = await this.extCommon.writeCloudDataUsingUnacogAPI(fileName, this.lastRunFullData);
      let anchor = document.createElement('a');
      anchor.href = fullRunData.publicStorageUrlPath;
      anchor.download = fileName;
      anchor.target = '_blank';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    });
    this.download_compact_csv.addEventListener('click', async () => {
      if (this.lastRunCompactData === null) {
        alert("No data to download");
        return;
      }
      const fileName = this.runId + "compact.csv";
      const csvText = Papa.unparse(this.lastRunCompactData);
      let compactData = await this.extCommon.writeCloudDataUsingUnacogAPI(fileName, csvText);
      let anchor = document.createElement('a');
      anchor.href = compactData.publicStorageUrlPath;
      anchor.download = fileName;
      console.log(anchor.download);
      anchor.target = '_blank';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
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
    this.lastRunFullData = analysisResults;
    await this.extCommon.writeCloudDataUsingUnacogAPI(this.runId + ".json", this.lastRunFullData);

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
    this.lastRunCompactData = compactData;
    await this.extCommon.writeCloudDataUsingUnacogAPI(this.runId + "compact.json", compactData, "text/csv");
    document.body.classList.remove("bulk_analysis_running");
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
  }
}
