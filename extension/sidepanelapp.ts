import { AnalyzerExtensionCommon } from './extensioncommon';
import SlimSelect from 'slim-select';
import Split from 'split.js';
import {
  encode,
} from 'gpt-tokenizer';
declare const chrome: any;

export default class SidePanelApp {
  extCommon = new AnalyzerExtensionCommon(chrome);
  analysisSetsSlimSelect: SlimSelect;
  analysis_set_select = document.querySelector('.analysis_set_select') as HTMLSelectElement;
  show_main_page_btn = document.querySelector('.show_main_page_btn') as HTMLButtonElement;
  lastPanelToggleDate = new Date().toISOString();
  run_analysis_btn = document.querySelector('.run_analysis_btn') as HTMLButtonElement;
  user_text_content_field = document.querySelector(".user_text_content_field") as HTMLTextAreaElement;
  source_text_length = document.querySelector('.source_text_length') as HTMLElement;
  source_tokens_length = document.querySelector('.source_tokens_length') as HTMLElement;
  top_history_view_splitter = document.querySelector('.top_history_view_splitter') as HTMLDivElement;
  bottom_history_view_splitter = document.querySelector('.bottom_history_view_splitter') as HTMLDivElement;
  analysis_run_label = document.querySelector('.analysis_run_label') as HTMLInputElement;
  ["tabs-input-url-tab"] = document.querySelector('#tabs-input-url-tab') as HTMLDivElement;
  ["tabs-input-textarea-tab"] = document.querySelector('#tabs-input-textarea-tab') as HTMLDivElement;
  url_source_input = document.querySelector('.url_source_input') as HTMLInputElement;
  url_scrape_results = document.querySelector('.url_scrape_results') as HTMLTextAreaElement;
  lastSlimSelections = "";
  viewSplitter: Split.Instance;
  analysis_display: any;
  previousSlimOptions = '';

  constructor() {
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
        gutterSize: 24,
      });

    this.show_main_page_btn.addEventListener('click', () => {
      this.extCommon.toggleExentionPage("main.html");
    });

    this.run_analysis_btn.addEventListener('click', async () => {
      let isAlreadyRunning = await this.extCommon.setRunning(true);
      console.log("isAlreadyRunning", isAlreadyRunning);
      if (isAlreadyRunning) {
          if (confirm("A previous analysis is still running. Do you want to cancel it and start a new one?") === false)
            return;
      }
      let label = await this.extCommon.getStorageField("analysisRunLabel");
      let text = await this.extCommon.getSourceText(true); // force a scrape here
      let type = await this.extCommon.getSourceType();
      if (type === 'scrape') {
        await chrome.storage.local.set({ sidePanelScrapeContent: text });
      }

      await this.extCommon.runAnalysisPrompts(text, label);
    });
    this.user_text_content_field.addEventListener('input',
      async () => this.extCommon.setFieldToStorage(this.user_text_content_field, "sidePanelTextSource"));
    this.analysis_run_label.addEventListener('input',
      async () => this.extCommon.setFieldToStorage(this.analysis_run_label, "analysisRunLabel"));
    this.url_source_input.addEventListener('input',
      async () => this.extCommon.setFieldToStorage(this.url_source_input, "sidePanelUrlSource"));
    this["tabs-input-url-tab"].addEventListener('click',
      async () => chrome.storage.local.set({ sidePanelSource: 'scrape' }));
    this["tabs-input-textarea-tab"].addEventListener('click',
      async () => chrome.storage.local.set({ sidePanelSource: 'text' }));

    this.analysis_display = document.querySelector(".analysis_display");
    chrome.storage.local.onChanged.addListener(() => {
      this.paint();
    });
    this.paint();
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

    let running = await chrome.storage.local.get('running');
    if (running && running.running) {
      document.body.classList.add("extension_running");
      document.body.classList.remove("extension_not_running");
    } else {
      document.body.classList.remove("extension_running");
      document.body.classList.add("extension_not_running");
    }
    this.extCommon.updateSessionKeyStatus();

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
    this.extCommon.getFieldFromStorage(this.analysis_run_label, "analysisRunLabel");
    this.extCommon.getFieldFromStorage(this.url_source_input, "sidePanelUrlSource");
    this.extCommon.getFieldFromStorage(this.url_scrape_results, "sidePanelScrapeContent");
    this.extCommon.getFieldFromStorage(this.user_text_content_field, "sidePanelTextSource");

    let value = await chrome.storage.local.get("sidePanelSource");
    value = value["sidePanelSource"] || '';
    if (value === 'scrape') {
      this["tabs-input-url-tab"].click();
    } else {
      this["tabs-input-textarea-tab"].click();
    }

    let text = await this.extCommon.getSourceText();
    this.source_text_length.innerHTML = text.length + ' characters';

    let tokenCount = "N/A";
    try {
      tokenCount = encode(text).length.toString() + " tokens";
    } catch (err) {
      let cleanText = "";
      if (text) cleanText = text;
      cleanText = cleanText.replace(/[^a-z0-9\s]/gi, "");

      tokenCount = encode(text).length.toString() + " tokens";
    }
    this.source_tokens_length.innerHTML = tokenCount;
  }
  async renderResultsPanel() {
    let history = await chrome.storage.local.get('history');
    history = history.history || [];
    let entry = history[0];
    let html = '';
    if (entry && entry.results) {
      entry.results.forEach((result: any) => {
        html += this.extCommon.getHTMLforPromptResult(result);
      });
    }

    if (this.analysis_display) {
      this.analysis_display.innerHTML = html;
    }
  }
}
