import React from 'react';

export default function HistoryResult(props) {
    const [historyEntry, setHistoryEntry] = React.useState({
        results: [{
            id: 'acb',
            prompt: {
                setName: 'abc'
            },
            results: [{
                id: 'abc',
            }]
        }],
        url: 'nada',
        historyIndex: 0,
        historyIndexDisplay: 0,
    });

    props.hooks.setHistoryEntry = setHistoryEntry;

    let allResults = historyEntry.results;
    let setBasedResults = {};
    allResults.forEach((result) => {
        if (!setBasedResults[result.prompt.setName]) {
            setBasedResults[result.prompt.setName] = [];
        }
        setBasedResults[result.prompt.setName].push(result);
    });
    let setNamesArray = Object.keys(setBasedResults);
    if (setNamesArray.length === 0) {
        setNamesArray = [''];
    }

    const getHistoryIndexDisplay = (historyIndex, setIndex, results) => {
        let historyIndexDisplay = (historyIndex + 1).toString();
        if (results.length > 1) {
            historyIndexDisplay += String.fromCharCode(97 + setIndex);
        }
        return historyIndexDisplay;
    };

    return (
        <div>
            <div className="py-1 flex items-center">
                <div className="flex flex-row">
                    <a className="flex-1 text-ellipsis text-blue-500 active:text-purple-500 focus:text-purple-500 self-center"
                        target="_blank">{historyEntry.url}</a>
                </div>
                <div className="inline-flex relative ml-2 items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"
                        className="w-4 h-4 mr-1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <span className="text-gray-800 text-xs history_date"></span>
                </div>
            </div>
            {setNamesArray.length > 0 && (
            <div>
                {setNamesArray.map((setName, setIndex) => (
                    <div className="history_entry_set_wrapper mx-1 my-1 flex flex-col">
                        <div className="flex flex-row">
                            <h6 className="pl-2 pr-1 flex-1 py-2 fs-5">{setName}</h6>
                            <div className="whitespace-nowrap">
                                <button className="download_compact_results_btn btn_icon text-sm inline-flex m-1 p-2" data-historyindex={historyEntry.historyIndex}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15M9 12l3 3m0 0 3-3m-3 3V2.25" />
                                    </svg>
                                    CSV</button>
                                <button className="download_full_results_btn btn_icon text-sm inline-flex m-1 mr-0 p-2" data-historyindex={historyEntry.historyIndex}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15M9 12l3 3m0 0 3-3m-3 3V2.25" />
                                    </svg>
                                    Full</button>
                                <span className="history_index pr-2 font-bold inline-block w-[30px] relative top-[-4px] text-right text-slate-500">{getHistoryIndexDisplay(historyEntry.historyIndex, setIndex, setNamesArray)}</span>
                            </div>
                        </div>
                        <div className="relative">
                            <div className="text-end">
                                <button type="button" className="btn_icon relative history_copy_url_btn top-10 right-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5"
                                        stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" nejoin="round"
                                            d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z" />
                                    </svg>
                                </button>
                            </div>
                            <div
                                className="history_text mt-2 p-2 flex-1 form-textarea-ts rounded overflow-y-auto whitespace-pre-wrap min-h-[100px]">
                            </div>
                        </div>
                        <hr className="history_separator" />
                    </div>
                ))}
            </div>
            )}
        </div>
    );
}