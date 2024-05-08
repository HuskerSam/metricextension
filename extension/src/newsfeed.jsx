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
        const [metricName, metricSetName] = col.split('_');
        columnMaps.push({ name: metricName, type: 'string', key: index, setName: metricSetName });
    });
    json.newsItems[0].columnMaps = columnMaps;
    json.newsItems[0].fullJSONData = await fullJsonQuery.json();

    setNewsItem(json.newsItems);
    console.log('columnMaps', columnMaps);
  };

  if (!loaded) {
    load();
    loaded = true;
  }

  return (
    <div className="grid grid-rows-1 sm:grid-rows-2 md:grid-rows-3 lg:grid-rows-4 gap-4">
      {newsItems.map((doc) => (
        <div key={doc.id}>
          {doc.csvResultData.data.map((row, index) => (
            <div className="bg-gray-100 p-4 rounded shadow" key={index}>
              <a className="text-lg font-bold mb-2 text-gray-800 hover:text-blue-500" target="_blank" href={row.url}>
                {row.title}
              </a>
              <p className="mb-2">{row.summary}</p>
              <div className="flex flex-wrap">
                {doc.columnMaps
                  .filter((col) => col.setName)
                  .map((col) => (
                    <div className="mr-4 mb-1" key={col.key}>
                      <span className="font-bold">{col.name}</span>
                      <span className="ml-1">{row[`${col.name}_${col.setName}`]}</span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}