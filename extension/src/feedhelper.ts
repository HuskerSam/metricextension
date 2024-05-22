import Papa from 'papaparse';
import { AnalyzerExtensionCommon } from './extensioncommon';
import MainPageApp from "./mainpageapp";
import NewsFeedView from "./newsfeed.jsx";
import React from 'react';
import {
    createRoot,
} from "react-dom/client";

declare const chrome: any;
export default class FeedHelper {
    app: MainPageApp;
    extCommon: AnalyzerExtensionCommon;
    newsFeedContainer: React.ReactElement = React.createElement(NewsFeedView, {
        hooks: {},
    });;
    news_viewer_container = document.querySelector('.news_viewer_container') as HTMLDivElement;

    constructor(app: MainPageApp) {
        this.app = app;
        this.extCommon = app.extCommon;
        createRoot(this.news_viewer_container).render(this.newsFeedContainer);
        this.load();
    }
    async load() {
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
    }
}