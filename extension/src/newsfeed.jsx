import React from 'react';

export default function NewsFeedContainer(props) {
  const [newsItems, setNewsItem] = React.useState([]);
  const [show, setShow] = React.useState(false);

  props.hooks.setNewsItem = setNewsItem;
  props.hooks.setShow = setShow;
  
  if (!show) {
    return (
      <div>
        no news today
      </div>
    )
  }
  return (
    <div className="grid grid-rows-1 sm:grid-rows-2 md:grid-rows-3 lg:grid-rows-4 gap-4">
      {newsItems.map((doc) => (
        <div key={doc.id}>
          {doc.csvResultData.data.map((row, index) => (
            <div className="p-4 rounded" key={index}>
              <a className="gap-x-4 border-b border-gray-900/5 text-lg font-bold mb-2 hover:text-blue-500" target="_blank" href={row.url}>
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