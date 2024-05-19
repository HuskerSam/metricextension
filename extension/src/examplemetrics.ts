export const exampleMetrics = () => {
    return [
        {
            metricType: "score 0-10",
            title: "Score 0 - 10",
            template: `Describe language suitability for under age audiences.
            Please respond with a number between 0 and 10.
            
            Please respond with json and only json in this format:
            {
                "contentRating": 0
            }
            
            Here is the content to analyze:
            {{query}}`,
        }, {
            metricType: "text",
            title: "Keywords",
            template: `Use the following format to answer, include up to 5: 
Keywords: [keyword1], [keyword2], [keyword3], ...

Here is the content to analyze:
{{query}}`,
        }, {
            metricType: "text",
            title: "Summary",
            template: `This summary should be no longer than 50 or more words. Use the following format to answer:
Summary: [summary of content]

Here is the content to analyze:
{{query}}`,
        }, {
            metricType: "json",
            title: "JSON repsonse",
            template: `Here is the content to analyze:
{{query}}

Please respond with json and only json in this format:
{
    "contentRating": 0,
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "summary": "summary of content"
}`,
        }
    ];
}