
import React from 'react';


export default function DialogVectorInspect(props) {
    const [newsItems, setNewsItem] = React.useState([]);
    let loaded = false;
    const load = async () => {
        let query = await fetch('https://firebasestorage.googleapis.com/v0/b/promptplusai.appspot.com/o/KlydeNews%2Fnewsfeed.json?alt=media');
        let json = await query.json();
        setNewsItem(json.newsItems);
    };
    if (!loaded) {
        load();
        loaded = true;
    }

    return (
        <div>
        {
            newsItems.map((doc) => (
                <a key={doc.url} className="connected_session_row" target="_blank"
                    href={doc.url}>{doc.url}
                </a>
            ))
        }
    </div>);
}