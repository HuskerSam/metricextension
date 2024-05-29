import { AnalyzerExtensionCommon } from './extensioncommon';
import MainPageApp from "./mainpageapp";

declare const chrome: any;
export default class FeedHelper {
    app: MainPageApp;
    extCommon: AnalyzerExtensionCommon;
    setup_default_session_keys = document.querySelector('.setup_default_session_keys') as HTMLButtonElement;

    constructor(app: MainPageApp) {
        this.app = app;
        this.extCommon = app.extCommon;

        this.setup_default_session_keys.addEventListener('click', () => {
            chrome.storage.local.set({
                'sessionId': "lnwmsjsv8652",
                'apiToken': "cf3dfde9-a142-4c65-aea6-0688b125041f",
            });
        });
    }
}