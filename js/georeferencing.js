// ジオリファレンス機能のプレースホルダー
import { Logger } from './utils/logger.js';

export class Georeferencing {
    constructor(mapCore, imageOverlay, gpsData) {
        this.logger = new Logger('Georeferencing');
        this.mapCore = mapCore;
        this.imageOverlay = imageOverlay;
        this.gpsData = gpsData;
        this.coordinateDisplay = null;
        this.routeSpotHandler = null;
        this.pointJsonData = null;
        this.imageCoordinateMarkers = [];
    }

    setCoordinateDisplay(coordinateDisplay) {
        this.coordinateDisplay = coordinateDisplay;
    }

    setRouteSpotHandler(routeSpotHandler) {
        this.routeSpotHandler = routeSpotHandler;
    }

    setPointJsonData(data) {
        this.pointJsonData = data;
    }

    addImageCoordinateMarker(markerInfo) {
        this.imageCoordinateMarkers.push(markerInfo);
    }

    clearImageCoordinateMarkers(type) {
        // プレースホルダー実装
        this.imageCoordinateMarkers = [];
    }

    async executeGeoreferencing() {
        this.logger.info('ジオリファレンス処理（未実装）');
        return { success: true, message: '機能は未実装です' };
    }

    setupGeoreferencingUI() {
        this.logger.info('ジオリファレンスUI設定（未実装）');
    }

    async performGeoreferencingCalculations() {
        this.logger.info('ジオリファレンス計算（未実装）');
        return { matchedPairs: [], unmatchedPoints: [] };
    }

    matchPointJsonWithGPS(gpsPoints) {
        return { matchedPairs: [], unmatchedPoints: [] };
    }
}