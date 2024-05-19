import { AnalyzerExtensionCommon } from './extensioncommon';
import { SemanticCommon } from './semanticcommon';
import { MetricCommon } from './metriccommon';
import BulkHelper from './bulkhelper';
import PromptHelper from './prompthelper';
import HistoryHelper from './historyhelper';
import SettingsHelper from './settingshelper';
import SemanticHelper from './semantichelper';
import NewsFeedView from "./newsfeed.jsx";
import HistoryResult from './historyresult.jsx';
import Papa from 'papaparse';
import {
    createRoot,
} from "react-dom/client";
import React from "react";
declare const chrome: any;

export default class MainPageApp {
    extCommon = new AnalyzerExtensionCommon(chrome);
    semanticCommon = new SemanticCommon(chrome);
    metricCommon = new MetricCommon(chrome);
    bulkHelper: BulkHelper | null = null;
    promptHelper: PromptHelper | null = null;
    historyHelper: HistoryHelper | null = null;
    settingsHelper: SettingsHelper | null = null;
    dataMillHelper: SemanticHelper | null = null;
    newsFeedContainer: React.ReactElement | null = null;
    historyResult: React.ReactElement | null = null;
    historyResultPrevious: React.ReactElement | null = null;
    open_side_panel_from_main = document.querySelector('.open_side_panel_from_main') as HTMLButtonElement;
    main_history_tab_view = document.querySelector('#main_history_tab_view') as HTMLDivElement;
    main_prompt_manager_tab_view = document.querySelector('#main_prompt_manager_tab_view') as HTMLDivElement;
    main_bulk_tab_view = document.querySelector('#main_bulk_tab_view') as HTMLDivElement;
    main_options_tab_view = document.querySelector('#main_options_tab_view') as HTMLDivElement;
    main_datamill_tab_view = document.querySelector('#main_datamill_tab_view') as HTMLDivElement;
    main_feed_tab_view = document.querySelector('#main_feed_tab_view') as HTMLDivElement;
    main_feed_tab_btn = document.querySelector('#main_feed_tab_btn') as HTMLButtonElement;
    main_history_tab_btn = document.querySelector('#main_history_tab_btn') as HTMLButtonElement;
    main_prompt_manager_tab_btn = document.querySelector('#main_prompt_manager_tab_btn') as HTMLButtonElement;
    main_datamill_tab_btn = document.querySelector('#main_datamill_tab_btn') as HTMLButtonElement;
    main_bulk_tab_btn = document.querySelector('#main_bulk_tab_btn') as HTMLButtonElement;
    main_options_tab_btn = document.querySelector('#main_options_tab_btn') as HTMLButtonElement;


    constructor() {
        this.load();
        setInterval(() => AnalyzerExtensionCommon.updateTimeSince(document.body), 500);
    }
    async loadHTMLTemplate(path: string, dom: any) {
        let htmlRequest = await fetch(path);
        let html = await htmlRequest.text();
        dom.innerHTML = html;
    }
    async load() {
        await this.loadHTMLTemplate("pages/history.html", this.main_history_tab_view);
        await this.loadHTMLTemplate("pages/bulk.html", this.main_bulk_tab_view);
        await this.loadHTMLTemplate("pages/prompts.html", this.main_prompt_manager_tab_view);
        await this.loadHTMLTemplate("pages/settings.html", this.main_options_tab_view);
        await this.loadHTMLTemplate("pages/semantic.html", this.main_datamill_tab_view);
        await this.loadHTMLTemplate("pages/news.html", this.main_feed_tab_view);

        await this.semanticCommon.semanticLoad();

        this.settingsHelper = new SettingsHelper(this);
        this.bulkHelper = new BulkHelper(this);
        this.promptHelper = new PromptHelper(this);
        this.historyHelper = new HistoryHelper(this);
        this.dataMillHelper = new SemanticHelper(this);
        this.initEventHandlers();

        this.newsFeedContainer = React.createElement(NewsFeedView, {
            hooks: {},
        });
        createRoot(this.main_feed_tab_view).render(this.newsFeedContainer);

        let query = await fetch('https://firebasestorage.googleapis.com/v0/b/promptplusai.appspot.com/o/KlydeNews%2Fnewsfeed.json?alt=media');
        let json = await query.json();
        let compactCSV = json.newsItems[0].csvDocPath;
        let fullJSON = json.newsItems[0].jsonDocPath;
        let csvQuery = await fetch(compactCSV);
        let fullJsonQuery = await fetch(fullJSON);
        json.newsItems[0].compactCSVData = await csvQuery.text();
        let columnMaps: any[] = [];
        json.newsItems[0].csvResultData = Papa.parse(json.newsItems[0].compactCSVData, { header: true });
        let columnNames = Object.keys(json.newsItems[0].csvResultData.data[0]);
        columnNames.forEach((col, index) => {
            const [metricName, metricSetName] = col.split('_');
            columnMaps.push({
                name: metricName,
                type: 'string',
                key: index,
                setName: metricSetName
            });
        });
        json.newsItems[0].columnMaps = columnMaps;
        json.newsItems[0].fullJSONData = await fullJsonQuery.json();

        this.newsFeedContainer.props.hooks.setNewsItem(json.newsItems);
        this.newsFeedContainer.props.hooks.setShow(true);

        const history_result_view = document.querySelector('.history_result_view') as HTMLDivElement;
        const history_result_previous_view = document.querySelector('.history_result_previous_view') as HTMLDivElement;
        this.historyResult = React.createElement(HistoryResult, {
            hooks: {},
        });
        createRoot(history_result_view).render(this.historyResult);

        this.historyResultPrevious = React.createElement(HistoryResult, {
            hooks: {},
        });
        createRoot(history_result_previous_view).render(this.historyResultPrevious);

        window.addEventListener('hashchange', () => this.navigateHashtag());
        this.navigateHashtag();

        // list for changes to local storage and update the UI
        chrome.storage.local.onChanged.addListener(() => {
            this.paintData();
        });
        this.paintData(true);
    }
    navigateHashtag() {
        if (window.location.hash.trim() === "#semantic") {
            document.getElementById("main_datamill_tab_btn")?.click();
        }
        if (window.location.hash.trim() === "#bulk") {
            document.getElementById("main_bulk_tab_btn")?.click();
        }
        if (window.location.hash.trim() === "#prompts") {
            document.getElementById("main_prompt_manager_tab_btn")?.click();
        }
        if (window.location.hash.trim() === "#settings") {
            document.getElementById("main_options_tab_btn")?.click();
        }
        if (window.location.hash.trim() === "#history") {
            document.getElementById("main_history_tab_btn")?.click();
        }
        if (window.location.hash.trim() === "") {
            document.getElementById("main_feed_tab_btn")?.click();
        }
    }

    initEventHandlers() {
        this.open_side_panel_from_main.addEventListener('click', async () => this.extCommon.toggleSidePanel());
        this.main_history_tab_btn.addEventListener('click', () => {
            window.location.hash = "history"
        });
        this.main_prompt_manager_tab_btn.addEventListener('click', () => {
            window.location.hash = "prompts"
        });
        this.main_bulk_tab_btn.addEventListener('click', () => {
            window.location.hash = "bulk"
        });
        this.main_options_tab_btn.addEventListener('click', () => {
            window.location.hash = "settings"
        });
        this.main_datamill_tab_btn.addEventListener('click', () => {
            window.location.hash = "semantic"
        });
        this.main_feed_tab_btn.addEventListener('click', () => {
            window.location.hash = ""
        });
    }
    async paintData(forceUpdate = false) {
        this.historyHelper?.renderHistoryDisplay();
        this.bulkHelper?.paint();
        this.dataMillHelper?.paintData();
        this.extCommon.updateSessionKeyStatus();
        this.promptHelper?.paintPromptTab();
        this.settingsHelper?.paintData();
    }
}
