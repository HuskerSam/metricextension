
import React from 'react';
import Papa from 'papaparse';


export default function DialogVectorInspect(props) {
    const [newsItems, setNewsItem] = React.useState([]);
    let columnNames = [];
    let loaded = false;
    const load = async () => {
        let query = await fetch('https://firebasestorage.googleapis.com/v0/b/promptplusai.appspot.com/o/KlydeNews%2Fnewsfeed.json?alt=media');
        let json = await query.json();
        let compactCSV = json.newsItems[0].csvDocPath;
        let fullJSON = json.newsItems[0].jsonDocPath;
        let csvQuery = await fetch(compactCSV);
        let fullJsonQuery = await fetch(fullJSON);
        json.newsItems[0].compactCSVData = await csvQuery.text();
        let columnMaps = [];
        json.newsItems[0].csvResultData = Papa.parse(json.newsItems[0].compactCSVData, { header: true });
        columnNames = Object.keys(json.newsItems[0].csvResultData.data[0]);
        columnNames.forEach((col, index) => {
            columnMaps.push({ name: col, type: 'string', key: index});
        });
        json.newsItems[0].columnMaps = columnMaps;
        json.newsItems[0].fullJSONData = await fullJsonQuery.json();

        
        setNewsItem(json.newsItems);
        console.log('columnMaps', columnMaps);

    };
    if (!loaded) {
     //   if (newsItems.length !== 0) {
     //       return
     //   }
        load();
        loaded = true;
    }

    return (
        <div>
        {
            newsItems.map((doc) => (
                <div key={doc.id}>
                    <a key={doc.url} className="connected_session_row" target="_blank"
                        href={doc.url}>{doc.url}
                    </a>
                    <div>{
                        doc.csvResultData.data.map((row) => (
                            <div>
                                {doc.columnMaps.map((col) => (
                                    <div>
                                        <span>{col.name}</span>
                                        <span>{row[col.name]}</span>
                                    </div>
                                ))}
                            </div>
                        ))
                        }</div>
                </div>
            ))
        }
    </div>);
}