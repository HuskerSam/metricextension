
import React from 'react';


export default function DialogVectorInspect(props) {
    const [newsItems, setNewsItem] = React.useState([]);
    let dataItems = [];
    let loaded = false;
    const load = async () => {
        let query = await fetch('https://firebasestorage.googleapis.com/v0/b/promptplusai.appspot.com/o/KlydeNews%2Fnewsfeed.json?alt=media');
        let json = await query.json();
        dataItems = json;
        setNewsItem(json);
    };
    if (!loaded) {
        load();
        loaded = true;
    }

    return (
        <ul>
        {
            dataItems.map((doc) => (
                <li key={doc.url} className="connected_session_row" target="_blank"
                    href={doc.url}>{doc.url}
                </li>
            ))
        }
    </ul>);
}