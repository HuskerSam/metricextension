import { AnalyzerExtensionCommon } from './extensioncommon';
import { MetricCommon } from './metriccommon';
declare const chrome: any;

export default class NewsAggregator {
    extCommon = new AnalyzerExtensionCommon(chrome);
    metricCommon = new MetricCommon(chrome);
    klyde_helper_news_feed_btn = document.querySelector('.klyde_helper_news_feed_btn') as HTMLButtonElement;

    constructor() {
        this.klyde_helper_news_feed_btn.addEventListener('click', async () => {
            this.runShit();
        });
    }
    async runShit() {
        let newsSiteList = ["url=https://apnews.com||clipCount=10||urlScrape=true||htmlElementsSelector=.Page-content .PagePromo-title a",
            "url=https://cnn.com||clipCount=5||urlScrape=true||htmlElementsSelector=.stack_condensed a",
            "url=https://english.news.cn/world/index.htm||clipCount=5||urlScrape=true||htmlElementsSelector=.part01 a",
        ];
        const promises: any[] = [];
        newsSiteList.forEach((newsSite: string) => {
            const newsSiteOptions = AnalyzerExtensionCommon.processOptions(newsSite);

            promises.push((async () => {
                try {
                    const response = await this.metricCommon.serverScrapeUrl(newsSiteOptions.url, newsSite);
                    return { response, url: newsSiteOptions.url };
                } catch (e: any) {
                    console.log("serverScrapeUrl error", e.message);
                    return {
                        success: false,
                        message: e.message,
                    };
                }
            })());

        });

        const results = await Promise.all(promises);
        const promptsList: any[] = [];
        results.forEach((result: any) => {
            if (result.response) {
                const pageUrls = result.response.text.split("\n").slice(0, 5);
                pageUrls.forEach((url: string) => {
                    promptsList.push({
                        url,
                        siteUrl: result.url,
                        title: result.title,
                    });
                });
            }
        });
        console.log("promptsList", promptsList);
        const metricRows: any[] = [];
        promptsList.forEach((prompt: any) => {

            //   const packet = { specialAction: "runMetricAnalysis", url: prompt.url, 
            // promptSet: "International Articles", title: prompt.title };
            metricRows.push({
                url: prompt.url,
                scrape: "broswer scrape",
            });
        });
        console.log("metricRows", metricRows);

        const bulkResults = await this.metricCommon.runBulkAnalysis(metricRows);
        console.log("bulkResults", bulkResults);
    }
}