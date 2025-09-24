// ルート・スポット処理のプレースホルダー
import { Logger } from './utils/logger.js';

export class RouteSpotHandler {
    constructor(mapCore, imageOverlay) {
        this.logger = new Logger('RouteSpotHandler');
        this.mapCore = mapCore;
        this.imageOverlay = imageOverlay;
        this.routeMarkers = [];
        this.spotMarkers = [];
    }

    detectJsonType(data) {
        if (data.routes) return 'route';
        if (data.spots) return 'spot';
        if (data.points) return 'point';
        return 'unknown';
    }

    async handleRouteSpotJsonLoad(files, type) {
        this.logger.info('ルート・スポットJSON読み込み（未実装）');
        return { success: true };
    }
}