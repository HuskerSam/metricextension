import { AnalyzerExtensionCommon } from './extensioncommon';

declare const chrome: any;
export default class DataMillHelper {
    extCommon = new AnalyzerExtensionCommon(chrome);
}