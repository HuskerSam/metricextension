import React from 'react';

export default function NewsFeedContainer(props) {
  const [newsItems, setNewsItem] = React.useState([]);
  const [show, setShow] = React.useState(false);

  props.hooks.setNewsItem = setNewsItem;
  props.hooks.setShow = setShow;
  
  if (!show) {
    return (
      <div>
        loading...
      </div>
    )
  }
  return (
    <div className="">
      {newsItems.map((doc) => (
        <div key={doc.id}>
          {doc.csvResultData.data.map((row, index) => (
            <div className="p-4 rounded" key={index}>
              <a className="border-b border-gray-900/5 text-lg font-bold mb-2 hover:text-blue-500" target="_blank" href={row.url}>
                {row.title}
              </a>
              <p className="mb-2">{row.summary}</p>
              <div className="">
                {doc.columnMaps
                  .filter((col) => col.setName)
                  .map((col) => (
                    <div className="mr-4 mb-1 inline-block" key={col.key}>
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