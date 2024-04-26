import SidePanelApp from "./sidepanelapp";
import MainPageApp from "./mainpageapp";

window.addEventListener("load", async () => {
    let fileName: string = window.location.pathname.split("/").slice(-1)[0];
    fileName = fileName.split("#")[0];
    fileName = fileName.split("?")[0];
    if (fileName === "sidepanel.html") {
        new SidePanelApp();
    } else if (fileName === "main.html") {
        new MainPageApp();
    }
});
