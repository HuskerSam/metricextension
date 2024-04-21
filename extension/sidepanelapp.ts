import { AnalyzerExtensionCommon } from './extensioncommon';
import SlimSelect from 'slim-select';
declare const chrome: any;

export default class SidePanelApp {
    extCommon = new AnalyzerExtensionCommon(chrome);
    analysisSetsSlimSelect: SlimSelect;
    analysis_set_select = document.querySelector('.analysis_set_select') as HTMLSelectElement;
    show_main_page_btn = document.querySelector('.show_main_page_btn') as HTMLButtonElement;
    lastPanelToggleDate = new Date().toISOString();

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
        this.extCommon.initCommonDom(this.analysisSetsSlimSelect);
        chrome.storage.local.onChanged.addListener(() => {
            this.handleStorageChange();
        });
        this.handleStorageChange();

        this.show_main_page_btn.addEventListener('click', () => {
            chrome.tabs.create({ url: 'main.html', active: true });
        });
    }
    async handleStorageChange() {
        let lastPanelToggleDate = await chrome.storage.local.get('lastPanelToggleDate');
        if (lastPanelToggleDate && lastPanelToggleDate.lastPanelToggleDate) lastPanelToggleDate = lastPanelToggleDate.lastPanelToggleDate;

        if (lastPanelToggleDate > this.lastPanelToggleDate) {
            window.close();
            return;
        }
        this.extCommon.paintAnalysisTab();
    }
}
