import { AnalyzerExtensionCommon } from './extensioncommon';
import SlimSelect from 'slim-select';
declare const chrome: any;

export default class BulkPageApp {
    previousSlimOptions = "";
    extCommon = new AnalyzerExtensionCommon(chrome);
    bulk_analysis_sets_select: any = document.querySelector('.bulk_analysis_sets_select');
    bulkSelected: SlimSelect;

    constructor() {
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

        this.paint();
    }

    async paint() {
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
