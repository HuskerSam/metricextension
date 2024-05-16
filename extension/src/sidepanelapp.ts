import { AnalyzerExtensionCommon } from './extensioncommon';
import { MetricCommon } from './metriccommon';
import Papa from 'papaparse';
import SlimSelect from 'slim-select';
import Split from 'split.js';
import LastRunResult from './historyresult.jsx';
import {
  createRoot,
} from "react-dom/client";
import React from "react";
import {
  encode,
} from 'gpt-tokenizer';
declare const chrome: any;

export default class SidePanelApp {
  extCommon = new AnalyzerExtensionCommon(chrome);
  metricCommon = new MetricCommon(chrome);
  lastRunResult: React.ReactElement | null = null;
  analysisSetsSlimSelect: any;
  analysis_set_select = document.querySelector('.analysis_set_select') as HTMLSelectElement;
  open_main_feed_page_btn = document.querySelector('.open_main_feed_page_btn') as HTMLButtonElement;
  open_main_activity_page_btn = document.querySelector('.open_main_activity_page_btn') as HTMLButtonElement;
  open_main_prompts_page_btn = document.querySelector('.open_main_prompts_page_btn') as HTMLButtonElement;
  open_main_semantic_page_btn = document.querySelector('.open_main_semantic_page_btn') as HTMLButtonElement;
  open_main_settings_page_btn = document.querySelector('.open_main_settings_page_btn') as HTMLButtonElement;
  open_main_batch_page_btn = document.querySelector('.open_main_batch_page_btn') as HTMLButtonElement;
  lastPanelToggleDate = new Date().toISOString();
  run_analysis_btn = document.querySelector('.run_analysis_btn') as HTMLButtonElement;
  user_text_content_field = document.querySelector(".user_text_content_field") as HTMLTextAreaElement;
  source_text_length = document.querySelector('.source_text_length') as HTMLElement;
  source_tokens_length = document.querySelector('.source_tokens_length') as HTMLElement;
  top_history_view_splitter = document.querySelector('.top_history_view_splitter') as HTMLDivElement;
  bottom_history_view_splitter = document.querySelector('.bottom_history_view_splitter') as HTMLDivElement;
  analysis_run_label = document.querySelector('.analysis_run_label') as HTMLInputElement;
  ["tabs-input-url-tab"] = document.querySelector('#tabs-input-url-tab') as HTMLInputElement;
  ["tabs-input-textarea-tab"] = document.querySelector('#tabs-input-textarea-tab') as HTMLInputElement;
  ["tabs-input-textarea-panel"] = document.querySelector('#tabs-input-textarea-panel') as HTMLDivElement;
  ["tabs-input-url-panel"] = document.querySelector('#tabs-input-url-panel') as HTMLDivElement;
  url_source_input = document.querySelector('.url_source_input') as HTMLInputElement;
  url_source_options = document.querySelector('.url_source_options') as HTMLInputElement;
  url_scrape_results = document.querySelector('.url_scrape_results') as HTMLTextAreaElement;
  scrape_type_radios = document.querySelectorAll('input[name="scrape_type"]') as NodeListOf<HTMLInputElement>;
  copy_url_scrape = document.querySelector('.copy_url_scrape') as HTMLButtonElement;
  sidepanel_history_result_view = document.querySelector('.sidepanel_history_result_view') as HTMLDivElement;
  sidepanel_scrape_webpage_btn = document.querySelector('.sidepanel_scrape_webpage_btn') as HTMLButtonElement;
  sidepanel_dropdown_menu = document.querySelector('.sidepanel_dropdown_menu') as HTMLDivElement;
  lastSlimSelections = "";
  viewSplitter: Split.Instance;
  previousSlimOptions = '';

  constructor() {
    this.load()
    this.analysisSetsSlimSelect = new SlimSelect({
      select: '.analysis_set_select',
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
          let selectedAnalysisSets: any[] = [];
          this.analysisSetsSlimSelect.render.main.values.querySelectorAll('.ss-value')
            .forEach((item: any) => {
              selectedAnalysisSets.push(item.innerText);
            });
          if (selectedAnalysisSets.length <= 1) {
            this.analysis_set_select.classList.add('slimselect_onevalue');
          } else {
            this.analysis_set_select.classList.remove('slimselect_onevalue');
          }
          await chrome.storage.local.set({ selectedAnalysisSets });
        },
      },
    });

    this.viewSplitter = Split([this.top_history_view_splitter, this.bottom_history_view_splitter],
      {
        sizes: [50, 50],
        direction: 'vertical',
        minSize: 100,
        gutterSize: 8,
      });

    this.open_main_feed_page_btn.addEventListener('click', () => {
      this.extCommon.toggleExentionPage("main.html");
    });
    this.open_main_activity_page_btn.addEventListener('click', () => {
      this.extCommon.toggleExentionPage("main.html#history");
    });
    this.open_main_prompts_page_btn.addEventListener('click', () => {
      this.extCommon.toggleExentionPage("main.html#prompts");
    });
    this.open_main_semantic_page_btn.addEventListener('click', () => {
      this.extCommon.toggleExentionPage("main.html#semantic");
    });
    this.open_main_batch_page_btn.addEventListener('click', () => {
      this.extCommon.toggleExentionPage("main.html#bulk");
    });
    this.open_main_settings_page_btn.addEventListener('click', () => {
      this.extCommon.toggleExentionPage("main.html#settings");
    });

    this.run_analysis_btn.addEventListener('click', async () => {
      let isAlreadyRunning = await this.metricCommon.setMetricsRunning(true);
      console.log("isAlreadyRunning", isAlreadyRunning);
      if (isAlreadyRunning) {
        if (confirm("A previous analysis is still running. Do you want to cancel it and start a new one?") === false)
          return;
      }
      let label = await this.extCommon.getStorageField("analysisRunLabel");
      let text = await this.metricCommon.getTextContentSource();
      let type = await this.metricCommon.getSourceType();
      if (!label) label = await this.metricCommon.getURLContentSource();
      if (!label) label = "Manual Run";
      if (type === 'scrape') {
        await chrome.storage.local.set({ sidePanelScrapeContent: text });
      }

      await this.metricCommon.runAnalysisPrompts(text, label);
    });
    this.user_text_content_field.addEventListener('input',
      async () => this.extCommon.setFieldToStorage(this.user_text_content_field, "sidePanelTextSource"));
    this.analysis_run_label.addEventListener('input',
      async () => this.extCommon.setFieldToStorage(this.analysis_run_label, "analysisRunLabel"));
    this.url_source_input.addEventListener('input',
      async () => this.extCommon.setFieldToStorage(this.url_source_input, "sidePanelUrlSource"));

    this.url_source_options.addEventListener('input',
      async () => this.extCommon.setFieldToStorage(this.url_source_options, "sidePanelUrlSourceOptions"));
    this["tabs-input-url-tab"].addEventListener('click',
      async () => chrome.storage.local.set({ sidePanelSource: 'scrape' }));
    this["tabs-input-textarea-tab"].addEventListener('click',
      async () => chrome.storage.local.set({ sidePanelSource: 'text' }));
    this.scrape_type_radios.forEach((radio) => {
      radio.addEventListener('input', async () => {
        let type = radio.value;
        await chrome.storage.local.set({ sidePanelScrapeType: type });
      });
    });
    this.copy_url_scrape.addEventListener('click', async () => {
      let text = this.url_scrape_results.value;
      navigator.clipboard.writeText(text);
    });

    this.sidepanel_scrape_webpage_btn.addEventListener('click', async () => {
      this.url_scrape_results.value = 'Getting content...'
      this.metricCommon.sidePanelManualScrape();
    });

    this.sidepanel_dropdown_menu.addEventListener('click', async (e: any) => {
      e.stopPropagation();
    });

    setInterval(() => AnalyzerExtensionCommon.updateTimeSince(document.body), 500);

    // list for changes to local storage and update the UI
    chrome.storage.local.onChanged.addListener(() => {
      this.paint();
    });
    this.paint();
  }
  load() {
    const sidepanel_history_result_view = document.querySelector('.sidepanel_history_result_view') as HTMLDivElement;
    this.lastRunResult = React.createElement(LastRunResult, {
      hooks: {},
    });
    createRoot(sidepanel_history_result_view).render(this.lastRunResult);
  }
  async paint() {
    let lastPanelToggleDate = await chrome.storage.local.get('lastPanelToggleDate');
    if (lastPanelToggleDate && lastPanelToggleDate.lastPanelToggleDate) lastPanelToggleDate = lastPanelToggleDate.lastPanelToggleDate;

    let lastPanelToggleWindowId = await chrome.storage.local.get('lastPanelToggleWindowId');
    if (lastPanelToggleWindowId && lastPanelToggleWindowId.lastPanelToggleWindowId) lastPanelToggleWindowId = lastPanelToggleWindowId.lastPanelToggleWindowId;

    let currentWindow = await chrome.windows.getCurrent();
    if (lastPanelToggleDate > this.lastPanelToggleDate && lastPanelToggleWindowId === currentWindow.id) {
      window.close();
      return;
    }

    let metrics_running = await this.extCommon.getStorageField('metrics_running');
    if (metrics_running) {
      document.body.classList.add("metrics_running");
      document.body.classList.remove("metrics_not_running");
    } else {
      document.body.classList.remove("metrics_running");
      document.body.classList.add("metrics_not_running");
    }
    this.extCommon.updateSessionKeyStatus();

    let type = await this.extCommon.getStorageField("sidePanelScrapeType");
    if (type) {
      this.scrape_type_radios.forEach((radio) => {
        if (radio.value === type) {
          radio.checked = true;
          document.body.classList.add("scrape_type_" + radio.value.replace(" ", "_"));
        } else {
          document.body.classList.remove("scrape_type_" + radio.value.replace(" ", "_"));
        }
      });
    }

    this.renderResultsPanel();
    this.renderSlimSelect();
    this.renderSourceDetails();
  }
  async renderSlimSelect() {
    const setNames = await this.extCommon.getAnalysisSetNames();
    let html = "";
    setNames.forEach((setName) => {
      html += `<option value="${setName}">${setName}</option>`;
    });
    let selectedAnalysisSets = await chrome.storage.local.get("selectedAnalysisSets");
    let slimOptions: any[] = [];
    setNames.forEach((setName) => {
      slimOptions.push({ text: setName, value: setName });
    });
    const slimOptionsString = JSON.stringify(slimOptions);
    let dataChange = false;
    if (this.previousSlimOptions !== slimOptionsString) {
      this.analysisSetsSlimSelect?.setData(slimOptions);
      this.previousSlimOptions = slimOptionsString;
      dataChange = true;
    }

    if (selectedAnalysisSets && selectedAnalysisSets.selectedAnalysisSets) {
      let setCache = JSON.stringify(selectedAnalysisSets.selectedAnalysisSets);
      if (setCache !== this.lastSlimSelections || dataChange) {
        this.lastSlimSelections = setCache;
        this.analysisSetsSlimSelect?.setSelected(selectedAnalysisSets.selectedAnalysisSets);
        let domSelections = this.analysisSetsSlimSelect?.render.main.values.querySelectorAll('.ss-value') as NodeListOf<HTMLElement>;
        let indexMap: any = {};
        domSelections.forEach((item: any, index: any) => {
          indexMap[item.innerText] = index;
        });
        let setOrder = selectedAnalysisSets.selectedAnalysisSets;
        setOrder.forEach((setName: any, index: any) => {
          let domIndex = indexMap[setName];
          if (domSelections[domIndex]) {
            this.analysisSetsSlimSelect?.render.main.values.appendChild(domSelections[domIndex]);
          }
        });
      }
    }
    if (this.analysisSetsSlimSelect?.getSelected().length === 0) {
      this.analysisSetsSlimSelect.setSelected([setNames[0]]);
    }
  }
  async renderSourceDetails() {
    this.extCommon.getFieldFromStorage(this.analysis_run_label, "analysisRunLabel", "sidePanelUrlSource");
    this.extCommon.getFieldFromStorage(this.url_source_input, "sidePanelUrlSource");
    this.extCommon.getFieldFromStorage(this.url_source_options, "sidePanelUrlSourceOptions");
    this.extCommon.getFieldFromStorage(this.url_scrape_results, "sidePanelScrapeContent");
    this.extCommon.getFieldFromStorage(this.user_text_content_field, "sidePanelTextSource");

    let value = await this.extCommon.getStorageField("sidePanelSource");
    if (value === 'scrape') {
      this["tabs-input-url-tab"].classList.add('active');
      this["tabs-input-url-tab"].checked = true;
      this["tabs-input-textarea-tab"].classList.remove('active');
      this["tabs-input-url-panel"].style.display = "";
      this["tabs-input-textarea-panel"].style.display = "none";
    } else {
      this["tabs-input-url-tab"].classList.remove('active');
      this["tabs-input-textarea-tab"].classList.add('active');
      this["tabs-input-textarea-tab"].checked = true;
      this["tabs-input-url-panel"].style.display = "none";
      this["tabs-input-textarea-panel"].style.display = "";
    }

    let text = await this.metricCommon.getTextContentSource();
    this.source_text_length.innerText = text.length + ' characters';

    let tokenCount = "N/A";
    try {
      tokenCount = encode(text).length.toString() + " tokens";
    } catch (err) {
      let cleanText = "";
      if (text) cleanText = text;
      cleanText = cleanText.replace(/[^a-z0-9\s]/gi, "");

      tokenCount = encode(text).length.toString() + " tokens";
    }
    this.source_tokens_length.innerText = tokenCount;
  }
  async renderResultsPanel() {
    let history = await chrome.storage.local.get('history');
    history = history.history || [];
    let entry = history[0];

    this.lastRunResult?.props.hooks.setHistoryEntry(entry);
    this.lastRunResult?.props.hooks.setShow(true);

    this.sidepanel_history_result_view.querySelectorAll('.download_compact_results_btn').forEach((btn: any) => {
      btn.addEventListener('click', async (e: any) => {
        e.preventDefault();
        const historyIndex = Number(btn.dataset.historyindex);
        const entry = history[historyIndex];
        let compactData = this.extCommon.processRawResultstoCompact(entry.results);
        let csvData = Papa.unparse(compactData);
        let blob = new Blob([csvData], { type: "text/csv" });
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        document.body.appendChild(a);
        a.href = url;
        a.download = 'results.csv';
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
    });
    this.sidepanel_history_result_view.querySelectorAll('.download_full_results_btn').forEach((btn: any) => {
      btn.addEventListener('click', async (e: any) => {
        e.preventDefault();
        const historyIndex = Number(btn.dataset.historyindex);
        const entry = history[historyIndex];
        let blob = new Blob([JSON.stringify(entry)], { type: "application/json" });
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        document.body.appendChild(a);
        a.href = url;
        a.download = 'results.json';
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
    });
  }
}
