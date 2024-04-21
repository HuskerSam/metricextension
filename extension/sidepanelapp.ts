import { AnalyzerExtensionCommon } from './extensioncommon';
import SlimSelect from 'slim-select';
import Split from 'split.js';
declare const chrome: any;

export default class SidePanelApp {
  extCommon = new AnalyzerExtensionCommon(chrome);
  analysisSetsSlimSelect: SlimSelect;
  analysis_set_select = document.querySelector('.analysis_set_select') as HTMLSelectElement;
  show_main_page_btn = document.querySelector('.show_main_page_btn') as HTMLButtonElement;
  lastPanelToggleDate = new Date().toISOString();
  run_analysis_btn = document.querySelector('.run_analysis_btn') as HTMLButtonElement;
  copy_to_clipboard_btn = document.querySelector('.copy_to_clipboard_btn') as HTMLButtonElement;
  query_source_text = document.querySelector(".query_source_text") as HTMLTextAreaElement;
  query_source_text_length = document.querySelector('.query_source_text_length') as HTMLElement;
  query_source_tokens_length = document.querySelector('.query_source_tokens_length') as HTMLElement;
  top_history_view_splitter = document.querySelector('.top_history_view_splitter') as HTMLDivElement;
  bottom_history_view_splitter = document.querySelector('.bottom_history_view_splitter') as HTMLDivElement;
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
    chrome.storage.local.onChanged.addListener(() => {
      this.handleStorageChange();
    });
    this.handleStorageChange();

    this.viewSplitter = Split([this.top_history_view_splitter, this.bottom_history_view_splitter],
      {
        sizes: [50, 50],
        direction: 'vertical',
        minSize: 200, // min size of both panes
        gutterSize: 16,
      });

    this.show_main_page_btn.addEventListener('click', () => {
      this.extCommon.toggleExentionPage("main.html");
    });

    this.run_analysis_btn.addEventListener('click', async () => {
      let text = this.extCommon.query_source_text.value;
      let result: any = await this.extCommon.runAnalysisPrompts(text, 'Manual');
      let html = '';
      for (let promptResult of result.results) {
        html += this.extCommon.getHTMLforPromptResult(promptResult);
      }
    });
    this.copy_to_clipboard_btn.addEventListener('click', async () => {
      let text = this.extCommon.query_source_text.value;
      navigator.clipboard.writeText(text);
    });


    this.query_source_text.addEventListener('input', async (e: Event) => {
      this.updateQuerySourceDetails();
    });

    this.analysis_display = document.querySelector(".analysis_display");
  }
  async handleStorageChange() {
    let lastPanelToggleDate = await chrome.storage.local.get('lastPanelToggleDate');
    if (lastPanelToggleDate && lastPanelToggleDate.lastPanelToggleDate) lastPanelToggleDate = lastPanelToggleDate.lastPanelToggleDate;
    
    let lastPanelToggleWindowId = await chrome.storage.local.get('lastPanelToggleWindowId');
    if (lastPanelToggleWindowId && lastPanelToggleWindowId.lastPanelToggleWindowId) lastPanelToggleWindowId = lastPanelToggleWindowId.lastPanelToggleWindowId;

    let currentWindow = await chrome.windows.getCurrent();
    if (lastPanelToggleDate > this.lastPanelToggleDate && lastPanelToggleWindowId === currentWindow.id) {
      window.close();
      return;
    }
    this.paintAnalysisTab();
  }
  async paintAnalysisTab() {
    let running = await chrome.storage.local.get('running');
    if (running && running.running) {
      document.body.classList.add("extension_running");
      document.body.classList.remove("extension_not_running");
    } else {
      document.body.classList.remove("extension_running");
      document.body.classList.add("extension_not_running");
    }

    let lastSelection = await chrome.storage.local.get('lastSelection');
    lastSelection = lastSelection.lastSelection || "";
    this.updateContentTextonSidePanel(lastSelection);
    this.updateQuerySourceDetails();

    this.renderDisplay();

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
    if (this.previousSlimOptions !== slimOptionsString) {
      this.analysisSetsSlimSelect?.setData(slimOptions);
      this.previousSlimOptions = slimOptionsString;
    }

    if (selectedAnalysisSets && selectedAnalysisSets.selectedAnalysisSets) {
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
    if (this.analysisSetsSlimSelect?.getSelected().length === 0) {
      this.analysisSetsSlimSelect.setSelected([setNames[0]]);
    }
  }
  async updateContentTextonSidePanel(text: string) {
    let running = await chrome.storage.local.get('running');
    if (running && running.running) {
      this.query_source_text.value = "Running...";
    } else {
      this.query_source_text.value = text;
    }
  }
  updateQuerySourceDetails() {
    let lastSelection = this.query_source_text.value;
    this.query_source_text_length.innerHTML = lastSelection.length + ' characters';

    /*
let tokenCount = "N/A";
try {
tokenCount = encode(text).length.toString() + " tokens";
} catch (err) {
let cleanText = "";
if (text) cleanText = text;
cleanText = cleanText.replace(/[^a-z0-9\s]/gi, "");
 
tokenCount = encode(text).length.toString() + " tokens";
}
this.query_source_tokens_length.innerHTML = tokenCount;
*/
  }

  async renderDisplay() {
    let history = await chrome.storage.local.get('history');
    history = history.history || [];
    let entry = history[0];
    let lastResult = null;
    let lastSelection = '';
    if (entry) {
      lastResult = entry.results;
      lastSelection = entry.text;
    }
    await this.updateContentTextonSidePanel(lastSelection);
    let html = '';
    if (lastResult) {
      lastResult.forEach((result: any) => {
        html += this.extCommon.getHTMLforPromptResult(result);
      });
    }
    if (this.analysis_display) {
      this.analysis_display.innerHTML = html;
    }
  }
  async runMetrics() {
    let text = this.query_source_text.value;
    await this.extCommon.runAnalysisPrompts(text, 'user input');
  }
}
