import React from 'react';
import { AnalyzerExtensionCommon } from './extensioncommon';
import Papa from 'papaparse';

export default function HistoryResult(props) {
    const [historyEntry, setHistoryEntry] = React.useState({});
    const [show, setShow] = React.useState(false);

    props.hooks.setHistoryEntry = setHistoryEntry;
    props.hooks.setShow = setShow;

    const extCommon = new AnalyzerExtensionCommon();
    let allResults = historyEntry.results;
    let usageCreditTotal = 0;
    let setBasedResults = {};
    let setNamesArray = null;
    if (show) {
        allResults.forEach((result) => {
            if (!setBasedResults[result.prompt.setName]) {
                setBasedResults[result.prompt.setName] = [];
            }
            setBasedResults[result.prompt.setName].push(result);
            try {
                usageCreditTotal += result.result.promptResult.ticketResults.usage_credits;
            } catch (err) {
                console.log("Usage total credit summming error", err);
            }

        });
        historyEntry.usageCreditTotal = usageCreditTotal;

        setNamesArray = Object.keys(setBasedResults);
        if (setNamesArray.length === 0) {
            setNamesArray = [];
        }
        setNamesArray.forEach((setName) => {
            setBasedResults[setName].map((result, index) => {
                result.id = index;
                return result;
            });
        });
        setNamesArray = setNamesArray.map((setName, index) => {
            return { setName, id: index };
        });
    }

    const getSetUsageTotal = (setName) => {
        let usageCreditTotal = 0;
        let promptSetResults = setBasedResults[setName];
        promptSetResults.forEach((result) => {
          try {
            usageCreditTotal += result.result.promptResult.ticketResults.usage_credits;
          } catch (err) {
            console.log("Usage total credit summming error", err);
          }
        }); 
        return usageCreditTotal.toFixed();
    };

    const copyCompactResultsToClipboard = async () => {
        let compactData = extCommon.processRawResultstoCompact([historyEntry]);
        let csvData = Papa.unparse(compactData);
        navigator.clipboard.writeText(csvData);
    };

    const downloadCompactResults = async () => {
        let compactData = extCommon.processRawResultstoCompact([historyEntry]);
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
    };

    const downloadFullResults = async () => {
        let blob = new Blob([JSON.stringify(historyEntry)], { type: "application/json" });
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        document.body.appendChild(a);
        a.href = url;
        a.download = 'results.json';
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const getMetricsResultValue = (resultMessage) => {
        try {
            let json = JSON.parse(resultMessage);
            let metric = json.contentRating;
            return metric;
        } catch (err) {
            //       console.log("Error parsing metric result", err, resultMessage);
            return -1;
        }
    }

    const getHistoryIndexDisplay = (historyIndex, setIndex, results) => {
        let historyIndexDisplay = (historyIndex + 1).toString();
        if (results.length > 1) {
            historyIndexDisplay += String.fromCharCode(97 + setIndex);
        }
        return historyIndexDisplay;
    };
    if (!show) {
        return (
            <div className="border-l-4 border-yellow-400 bg-yellow-50 p-4 side_panel_no_result_display">
                <div className="flex ml-3">
                    No results to display. Use the right click menu to analyze a webpage or input text manually and run analysis to begin.
                </div>
            </div>
        );
    }
    return (
        <div>
            <div className="flex-col items-start mx-1">
                <div className="flex flex-1 justify-between">
                    <a className="history_source_url text-blue-500 truncate flex-1 active:text-purple-500 focus:text-purple-500 self-center overflow-ellipsis" href={historyEntry.url}
                        target="_blank">{historyEntry.url}</a>
                    <span className="time_since text-sm text-gray-800 history_long_date self-end" data-timesince={historyEntry.runDate} data-timestyle="gmail"></span>
                </div>
            </div>
            <div className="p-2 flex-1 text-sm history_entry_text form-textarea-ts rounded overflow-y-auto whitespace-pre-wrap h-[125px] mb-2 px-1">
                {historyEntry.text}
            </div>
            <div>
                {setNamesArray && setNamesArray.length > 0 && setNamesArray.map((promptSet, setIndex) => (
                    <div key={promptSet.id} className="flex flex-col shadow-md rounded-b-md mb-3">
                        <div className='flex flex-col bg-gray-50 text-gray-800 mb-1'>
                            <div className="flex flex-row">
                                <h3 className="p-2 flex-1 fs-5 rounded-md">{promptSet.setName}</h3>
                                <span className="usage_credits inline-block pt-3 pr-1 text-xs">{getSetUsageTotal(promptSet.setName)} credits </span>
                                <span className="history_index px-2 font-bold inline-block w-[30px] text-right text-slate-500 self-center">{getHistoryIndexDisplay(historyEntry.historyIndex, setIndex, setNamesArray)}</span>
                            </div>
                        </div>
                        {setBasedResults[promptSet.setName].length > 0 && setBasedResults[promptSet.setName].map((result, resultIndex) => (
                            <div key={result.id}>
                                {result.prompt.metricType === 'score 0 - 10' && (
                                    <div className="prompt_result metric_result px-2 py-2">
                                        <span className="prompt_id">{result.prompt.name}</span>
                                        <span className="metric_score">{getMetricsResultValue(result.result.resultMessage)}<span className="outofscore">/10</span></span>
                                        <div className="metric_bar">
                                            <div className="metric_fill" style={{ width: getMetricsResultValue(result.result.resultMessage) * 10 + "%" }}></div>
                                        </div>
                                    </div>
                                )}
                                {result.prompt.metricType === 'json' && (
                                    <div className="prompt_result json_result mx-2 py-2">
                                        <div className="prompt_header">
                                            <span className="prompt_id">{result.prompt.name}</span>
                                        </div>
                                        <div className="result_content">{resultDisplay}</div>
                                    </div>
                                )}
                                {(result.prompt.metricType === 'text') && (
                                    <div className="prompt_result text_result mx-2 py-2">
                                        <div className="prompt_header">
                                            <span className="prompt_id">{result.prompt.name}</span>
                                        </div>
                                        <div className="result_content">{result.result.resultMessage}</div>
                                    </div>
                                )}
                            </div>
                        ))}
                        <div className="flex flex-row justify-end gap-2 p-2 bg-gray-50 shadow-sm">
                            <button type="button" className="btn-ts-secondary history_copy_url_btn text-xs px-2 py-1" onClick={copyCompactResultsToClipboard}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5"
                                    stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" nejoin="round"
                                        d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z" />
                                </svg> copy
                            </button>
                            <button className="download_compact_results_btn btn-ts-secondary text-xs px-2 py-1" onClick={downloadCompactResults}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15M9 12l3 3m0 0 3-3m-3 3V2.25" />
                                </svg> csv
                            </button>
                            <button className="download_full_results_btn btn-ts-secondary text-xs px-2 py-1" onClick={downloadFullResults}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15M9 12l3 3m0 0 3-3m-3 3V2.25" />
                                </svg> json
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex-col items-start mx-1">
                <div className='flex flex-1 justify-between'>
                    <span className="text-xxs text-end mr-2">Credits: {Math.round(historyEntry.usageCreditTotal)}</span>
                    <span className="text-gray-800 history_short_date text-xxs time_since text-nowrap inline-block min-w-18" data-timesince={historyEntry.runDate}></span>
                </div>
            </div>
        </div>
    );
}